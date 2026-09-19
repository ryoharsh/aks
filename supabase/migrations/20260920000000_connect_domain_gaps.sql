-- Connect remaining domain gaps.
-- 1. Check-ins become first-class observations (signals) so memory/pattern
--    engines can use them without fabricating data.
-- 2. Check-ins gain an idempotency key so retries and double taps never
--    duplicate source records (timeline trigger fires once per row).
-- 3. ai_runs can claim idempotent runs for reflection-sourced processing.
-- 4. Notification preferences become persisted server state (the existing
--    screen keeps its exact appearance).
-- 5. Starting an experiment emits a Timeline "EXPERIMENT ACTIVE/STARTED" event.

-- ---------------------------------------------------------------------------
-- 1. Check-in observations
-- ---------------------------------------------------------------------------

create or replace function public.emit_check_in_signal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.signals (user_id, source_type, source_id, signal_type, value, observed_at)
    values (
        new.user_id,
        'check_in',
        new.id,
        'mood_observation',
        jsonb_build_object(
            'mood', new.mood,
            'energy', new.energy,
            'focus', new.focus,
            'stress', new.stress
        ),
        new.created_at
    );
    return new;
end;
$$;

create trigger check_ins_emit_signal
after insert on public.check_ins
for each row execute function public.emit_check_in_signal();

-- Backfill observations for check-ins recorded before this migration.
insert into public.signals (user_id, source_type, source_id, signal_type, value, observed_at)
select c.user_id, 'check_in', c.id, 'mood_observation',
    jsonb_build_object('mood', c.mood, 'energy', c.energy, 'focus', c.focus, 'stress', c.stress),
    c.created_at
from public.check_ins c
where not exists (
    select 1 from public.signals s
    where s.source_type = 'check_in' and s.source_id = c.id
);

-- The existing unique (source_message_id, signal_type) constraint cannot
-- deduplicate reflection/check-in signals because source_message_id is null
-- for those sources. This partial index makes one observation per source
-- signal type enforceable at the database level.
create unique index signals_source_signal_unique_idx
    on public.signals (source_type, source_id, signal_type)
    where source_message_id is null;

-- ---------------------------------------------------------------------------
-- 2. Check-in idempotency
-- ---------------------------------------------------------------------------

alter table public.check_ins add column client_request_id text;

-- Historical rows have no request key; new writes always provide one.
create index check_ins_user_client_request_idx on public.check_ins (user_id, client_request_id)
where client_request_id is not null;

create or replace function public.create_check_in(
    check_in_user_id uuid,
    check_in_values jsonb,
    request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    existing_id uuid;
    existing_created_at timestamptz;
    new_id uuid;
    new_created_at timestamptz;
begin
    if check_in_user_id is null or (select auth.uid()) is null or check_in_user_id <> (select auth.uid()) then
        raise exception 'Authentication required';
    end if;
    if request_id is null or char_length(request_id) not between 1 and 100 then
        raise exception 'Invalid request id';
    end if;
    if jsonb_typeof(check_in_values) <> 'object' then raise exception 'Invalid check-in'; end if;
    if exists (select 1 from jsonb_object_keys(check_in_values) as key where key not in ('mood', 'energy', 'focus', 'stress', 'notes', 'metadata')) then
        raise exception 'Invalid check-in';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(check_in_user_id::text || request_id, 0));

    select id, created_at into existing_id, existing_created_at
    from public.check_ins
    where user_id = check_in_user_id and client_request_id = request_id;

    if existing_id is not null then
        return jsonb_build_object('id', existing_id, 'created_at', existing_created_at, 'replayed', true);
    end if;

    insert into public.check_ins (user_id, client_request_id, mood, energy, focus, stress, notes, metadata)
    values (
        check_in_user_id,
        request_id,
        nullif(trim(check_in_values->>'mood'), ''),
        (check_in_values->>'energy')::numeric,
        (check_in_values->>'focus')::numeric,
        (check_in_values->>'stress')::numeric,
        nullif(trim(check_in_values->>'notes'), ''),
        coalesce(check_in_values->'metadata', '{}'::jsonb)
    )
    returning id, created_at into new_id, new_created_at;

    return jsonb_build_object('id', new_id, 'created_at', new_created_at, 'replayed', false);
end;
$$;

revoke all on function public.create_check_in(uuid, jsonb, text) from public;
grant execute on function public.create_check_in(uuid, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. AI runs for reflection-sourced processing
-- ---------------------------------------------------------------------------

alter table public.ai_runs add column reflection_id uuid references public.reflections(id) on delete cascade;

alter table public.ai_runs drop constraint ai_runs_source_check;
alter table public.ai_runs add constraint ai_runs_source_check check (
    (experiment_id is null and reflection_id is null and conversation_id is not null and user_message_id is not null)
    or (experiment_id is not null and reflection_id is null and conversation_id is null and user_message_id is null)
    or (reflection_id is not null and experiment_id is null and conversation_id is null and user_message_id is null)
);
create unique index ai_runs_reflection_task_unique_idx on public.ai_runs (reflection_id, task) where reflection_id is not null;

create or replace function public.claim_reflection_ai_run(
    run_user_id uuid,
    run_reflection_id uuid,
    run_task text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    run_id uuid;
    run_status text;
    run_attempts integer;
    run_attempted_at timestamptz;
begin
    perform pg_advisory_xact_lock(hashtextextended(run_user_id::text, 0));
    if run_task not in ('signal_extraction', 'memory_evaluation', 'pattern_analysis') then
        raise exception 'INVALID_AI_RUN_TASK';
    end if;
    if not exists (
        select 1 from public.reflections
        where id = run_reflection_id and user_id = run_user_id
    ) then
        raise exception 'INVALID_AI_RUN_SOURCE';
    end if;

    select id, status, attempt_count, attempted_at
    into run_id, run_status, run_attempts, run_attempted_at
    from public.ai_runs
    where reflection_id = run_reflection_id and task = run_task
    for update;

    if run_id is not null then
        if run_status = 'succeeded' then
            return jsonb_build_object('id', run_id, 'status', run_status);
        end if;
        if run_status = 'started' and run_attempted_at > now() - interval '45 seconds' then
            raise exception 'MIRROR_IN_PROGRESS';
        end if;
        if run_attempts >= 5 then raise exception 'MIRROR_ATTEMPTS_EXHAUSTED'; end if;
        if (select count(*) from public.ai_run_attempts where user_id = run_user_id and attempted_at > now() - interval '1 minute') >= 20 then
            raise exception 'MIRROR_RATE_LIMITED';
        end if;

        update public.ai_runs
        set status = 'started', attempted_at = now(), attempt_count = attempt_count + 1,
            completed_at = null, error_code = null
        where id = run_id;
        insert into public.ai_run_attempts (run_id, user_id, task) values (run_id, run_user_id, run_task);
        return jsonb_build_object('id', run_id, 'status', 'started');
    end if;

    if (select count(*) from public.ai_run_attempts where user_id = run_user_id and attempted_at > now() - interval '1 minute') >= 20 then
        raise exception 'MIRROR_RATE_LIMITED';
    end if;

    insert into public.ai_runs (user_id, reflection_id, task)
    values (run_user_id, run_reflection_id, run_task)
    returning id into run_id;
    insert into public.ai_run_attempts (run_id, user_id, task) values (run_id, run_user_id, run_task);
    return jsonb_build_object('id', run_id, 'status', 'started');
end;
$$;

revoke all on function public.claim_reflection_ai_run(uuid, uuid, text) from public;
grant execute on function public.claim_reflection_ai_run(uuid, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Notification preferences (persisted behind the existing screen)
-- ---------------------------------------------------------------------------

alter table public.user_preferences
    add column notifications_enabled boolean not null default true,
    add column notification_categories jsonb not null default '{}'::jsonb
        check (jsonb_typeof(notification_categories) = 'object'),
    add column quiet_hours_enabled boolean not null default true;

-- ---------------------------------------------------------------------------
-- 5. Timeline: experiment started
-- ---------------------------------------------------------------------------

create or replace function public.emit_experiment_started_timeline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.status = 'active' and old.status is distinct from 'active' then
        insert into public.timeline_events (user_id, event_type, title, description, reference_id, metadata, created_at)
        values (
            new.user_id,
            'experiment',
            'You started an experiment',
            nullif(trim(new.title), ''),
            new.id,
            jsonb_build_object('status', 'started'),
            coalesce(new.start_date, new.updated_at, now())::timestamptz
        );
    end if;
    return new;
end;
$$;

create trigger experiments_emit_timeline_started
after update of status on public.experiments
for each row execute function public.emit_experiment_started_timeline();

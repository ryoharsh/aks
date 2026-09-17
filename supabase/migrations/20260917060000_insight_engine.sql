alter table public.experiments add column insight_status text check (insight_status is null or insight_status in ('pending', 'succeeded', 'failed', 'exhausted', 'not_applicable'));

create table public.insights (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    type text not null check (type ~ '^[a-z][a-z0-9_]{1,49}$'),
    title text not null check (char_length(trim(title)) between 5 and 160),
    content text not null check (char_length(trim(content)) between 10 and 1000),
    pattern_id uuid references public.patterns(id) on delete set null,
    experiment_id uuid references public.experiments(id) on delete set null,
    learning_id uuid references public.learnings(id) on delete cascade,
    confidence numeric check (confidence is null or confidence between 0 and 1),
    status text not null default 'new' check (status in ('new', 'seen', 'dismissed', 'archived')),
    seen_at timestamptz,
    metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 8192),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (num_nonnulls(pattern_id, experiment_id, learning_id) >= 1)
);

create index insights_user_created_idx on public.insights (user_id, created_at desc, id);
create index insights_user_status_created_idx on public.insights (user_id, status, created_at desc, id);
create index insights_pattern_idx on public.insights (pattern_id) where pattern_id is not null;
create index insights_experiment_idx on public.insights (experiment_id) where experiment_id is not null;
create unique index insights_learning_current_unique on public.insights (learning_id) where learning_id is not null and status in ('new', 'seen');

create trigger insights_set_updated_at
before update on public.insights
for each row execute function public.set_updated_at();

create or replace function public.validate_insight_sources()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    source_owner uuid;
begin
    if new.learning_id is not null then
        select user_id into source_owner from public.learnings where id = new.learning_id for key share;
        if source_owner is null then raise exception 'Insight learning source unavailable'; end if;
        new.user_id = source_owner;
    end if;
    if new.experiment_id is not null and not exists (select 1 from public.experiments where id = new.experiment_id and user_id = new.user_id) then raise exception 'Insight experiment owner mismatch'; end if;
    if new.pattern_id is not null and not exists (select 1 from public.patterns where id = new.pattern_id and user_id = new.user_id) then raise exception 'Insight pattern owner mismatch'; end if;
    if new.learning_id is null and new.experiment_id is null and new.pattern_id is null then raise exception 'Insight requires a source'; end if;
    return new;
end;
$$;

create trigger insights_validate_sources
before insert or update of user_id, pattern_id, experiment_id, learning_id on public.insights
for each row execute function public.validate_insight_sources();

create or replace function public.archive_stale_learning_insights()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.status = 'archived' or new.title is distinct from old.title or new.description is distinct from old.description then
        update public.insights set status = 'archived'
        where learning_id = new.id and status in ('new', 'seen');
    end if;
    return new;
end;
$$;

create trigger learnings_archive_stale_insights
after update on public.learnings
for each row execute function public.archive_stale_learning_insights();

alter table public.insights enable row level security;
create policy "Users can read their insights" on public.insights for select to authenticated using ((select auth.uid()) = user_id);

alter table public.ai_runs drop constraint ai_runs_task_check;
alter table public.ai_runs add constraint ai_runs_task_check check (task in ('conversation_response', 'signal_extraction', 'memory_evaluation', 'pattern_analysis', 'experiment_analysis', 'learning_synthesis', 'insight_generation'));

create or replace function public.claim_insight_ai_run(run_user_id uuid, run_experiment_id uuid)
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
    run_token uuid;
begin
    perform pg_advisory_xact_lock(hashtextextended(run_user_id::text, 6));
    if not exists (
        select 1 from public.learning_evidence le join public.learnings l on l.id = le.learning_id
        where le.experiment_id = run_experiment_id and l.user_id = run_user_id and l.status in ('active', 'revised') and l.evidence_count >= 3
    ) then raise exception 'INVALID_INSIGHT_RUN_SOURCE'; end if;
    select id, status, attempt_count, attempted_at, attempt_token into run_id, run_status, run_attempts, run_attempted_at, run_token
    from public.ai_runs where experiment_id = run_experiment_id and task = 'insight_generation' for update;
    if run_id is not null then
        if run_status = 'succeeded' then return jsonb_build_object('id', run_id, 'status', run_status, 'attemptToken', run_token); end if;
        if run_status = 'started' and run_attempted_at > now() - interval '45 seconds' then raise exception 'INSIGHT_GENERATION_IN_PROGRESS'; end if;
        if run_attempts >= 5 then raise exception 'INSIGHT_GENERATION_ATTEMPTS_EXHAUSTED'; end if;
        if (select count(*) from public.ai_run_attempts where user_id = run_user_id and attempted_at > now() - interval '1 minute') >= 20 then raise exception 'INSIGHT_GENERATION_RATE_LIMITED'; end if;
        run_token := gen_random_uuid();
        update public.ai_runs set status = 'started', attempted_at = now(), attempt_count = attempt_count + 1, completed_at = null, error_code = null, attempt_token = run_token where id = run_id;
        insert into public.ai_run_attempts (run_id, user_id, task) values (run_id, run_user_id, 'insight_generation');
        return jsonb_build_object('id', run_id, 'status', 'started', 'attemptToken', run_token);
    end if;
    if (select count(*) from public.ai_run_attempts where user_id = run_user_id and attempted_at > now() - interval '1 minute') >= 20 then raise exception 'INSIGHT_GENERATION_RATE_LIMITED'; end if;
    insert into public.ai_runs (user_id, experiment_id, task) values (run_user_id, run_experiment_id, 'insight_generation') returning id, attempt_token into run_id, run_token;
    insert into public.ai_run_attempts (run_id, user_id, task) values (run_id, run_user_id, 'insight_generation');
    return jsonb_build_object('id', run_id, 'status', 'started', 'attemptToken', run_token);
end;
$$;

create or replace function public.apply_insight_generation(
    insight_user_id uuid,
    source_pattern_id uuid,
    source_experiment_id uuid,
    source_learning_id uuid,
    insight_type text,
    insight_title text,
    insight_content text,
    insight_confidence numeric,
    insight_metadata jsonb,
    source_learning_updated_at timestamptz,
    source_learning_evidence_count integer,
    source_experiment_result text,
    source_experiment_observation_count integer,
    source_pattern_updated_at timestamptz,
    generation_run_id uuid,
    generation_attempt_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    insight_id uuid;
begin
    if insight_confidence is not null and (insight_confidence < 0 or insight_confidence > 1) then raise exception 'Invalid confidence'; end if;
    if not exists (select 1 from public.learnings where id = source_learning_id and user_id = insight_user_id and status in ('active', 'revised') and updated_at = source_learning_updated_at and evidence_count = source_learning_evidence_count) then raise exception 'STALE_INSIGHT_SOURCE'; end if;
    if source_experiment_id is not null and not exists (select 1 from public.experiments where id = source_experiment_id and user_id = insight_user_id and status = 'completed' and result = source_experiment_result and observation_count = source_experiment_observation_count) then raise exception 'STALE_INSIGHT_SOURCE'; end if;
    if source_pattern_id is not null and not exists (select 1 from public.patterns where id = source_pattern_id and user_id = insight_user_id and status <> 'archived' and updated_at = source_pattern_updated_at) then raise exception 'STALE_INSIGHT_SOURCE'; end if;
    perform pg_advisory_xact_lock(hashtextextended(insight_user_id::text, 6));
    if not exists (
        select 1 from public.ai_runs where id = generation_run_id and user_id = insight_user_id and experiment_id = source_experiment_id
          and task = 'insight_generation' and status = 'started' and error_code is null and attempt_token = generation_attempt_token
    ) then raise exception 'INSIGHT_GENERATION_SUPPRESSED'; end if;

    select id into insight_id from public.insights where learning_id = source_learning_id and status in ('new', 'seen') for update;
    if insight_id is null then
        insert into public.insights (user_id, type, title, content, pattern_id, experiment_id, learning_id, confidence, metadata)
        values (insight_user_id, insight_type, insight_title, insight_content, source_pattern_id, source_experiment_id, source_learning_id, insight_confidence, insight_metadata)
        returning id into insight_id;
        return jsonb_build_object('action', 'created', 'insightId', insight_id);
    end if;
    return jsonb_build_object('action', 'skipped', 'insightId', insight_id);
end;
$$;

create or replace function public.mark_insight_seen(target_insight_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
    update public.insights set status = 'seen', seen_at = coalesce(seen_at, now()) where id = target_insight_id and user_id = auth.uid() and status = 'new';
    return found;
end;
$$;
create or replace function public.dismiss_insight(target_insight_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
    update public.insights set status = 'dismissed' where id = target_insight_id and user_id = auth.uid() and status in ('new', 'seen');
    return found;
end;
$$;
create or replace function public.archive_insight(target_insight_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
    update public.insights set status = 'archived' where id = target_insight_id and user_id = auth.uid();
    return found;
end;
$$;
create or replace function public.delete_insight(target_insight_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
    delete from public.insights where id = target_insight_id and user_id = auth.uid();
    return found;
end;
$$;

create or replace function public.set_experiment_insight_status(experiment_user_id uuid, target_experiment_id uuid, new_status text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
    if new_status not in ('pending', 'succeeded', 'failed', 'exhausted', 'not_applicable') then raise exception 'Invalid insight status'; end if;
    update public.experiments set insight_status = new_status where id = target_experiment_id and user_id = experiment_user_id and status = 'completed'
      and (insight_status is null or insight_status not in ('succeeded', 'exhausted', 'not_applicable') or new_status is not distinct from insight_status);
    return found;
end;
$$;

revoke all on function public.claim_insight_ai_run(uuid, uuid) from public;
grant execute on function public.claim_insight_ai_run(uuid, uuid) to service_role;
revoke all on function public.apply_insight_generation(uuid, uuid, uuid, uuid, text, text, text, numeric, jsonb, timestamptz, integer, text, integer, timestamptz, uuid, uuid) from public;
grant execute on function public.apply_insight_generation(uuid, uuid, uuid, uuid, text, text, text, numeric, jsonb, timestamptz, integer, text, integer, timestamptz, uuid, uuid) to service_role;
revoke all on function public.mark_insight_seen(uuid) from public;
grant execute on function public.mark_insight_seen(uuid) to authenticated;
revoke all on function public.dismiss_insight(uuid) from public;
grant execute on function public.dismiss_insight(uuid) to authenticated;
revoke all on function public.archive_insight(uuid) from public;
grant execute on function public.archive_insight(uuid) to authenticated;
revoke all on function public.delete_insight(uuid) from public;
grant execute on function public.delete_insight(uuid) to authenticated;
revoke all on function public.set_experiment_insight_status(uuid, uuid, text) from public;
grant execute on function public.set_experiment_insight_status(uuid, uuid, text) to service_role;

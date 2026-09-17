alter table public.experiments add column completed_at timestamptz;
alter table public.experiments add column learning_status text check (learning_status is null or learning_status in ('pending', 'succeeded', 'failed', 'not_applicable'));
alter table public.ai_runs add column attempt_token uuid not null default gen_random_uuid();

create table public.learnings (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null check (char_length(trim(title)) between 5 and 200),
    description text not null check (char_length(trim(description)) between 10 and 1000),
    canonical_key text not null check (char_length(trim(canonical_key)) between 3 and 300),
    confidence numeric check (confidence is null or confidence between 0 and 1),
    evidence_count integer not null default 0 check (evidence_count >= 0),
    source_experiment_id uuid references public.experiments(id) on delete set null,
    status text not null default 'active' check (status in ('active', 'revised', 'archived')),
    metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 16384),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.learning_evidence (
    id uuid primary key default gen_random_uuid(),
    learning_id uuid not null references public.learnings(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    experiment_id uuid not null references public.experiments(id) on delete cascade,
    relationship text not null check (relationship in ('supports', 'mixed', 'contradicts')),
    observed_at timestamptz not null,
    created_at timestamptz not null default now(),
    unique (learning_id, experiment_id),
    unique (experiment_id)
);

create index learnings_user_status_updated_idx on public.learnings (user_id, status, updated_at desc, id);
create unique index learnings_user_canonical_active_unique on public.learnings (user_id, canonical_key) where status in ('active', 'revised');
create index learning_evidence_learning_observed_idx on public.learning_evidence (learning_id, observed_at desc, id);

create trigger learnings_set_updated_at
before update on public.learnings
for each row execute function public.set_updated_at();

create or replace function public.validate_learning_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    learning_owner uuid;
    experiment_owner uuid;
    experiment_status text;
    experiment_result text;
    experiment_observed_at timestamptz;
begin
    select user_id into learning_owner from public.learnings where id = new.learning_id for key share;
    select user_id, status, result, coalesce(completed_at, updated_at) into experiment_owner, experiment_status, experiment_result, experiment_observed_at
    from public.experiments where id = new.experiment_id for key share;
    if learning_owner is null or experiment_owner is null then raise exception 'Learning evidence does not exist'; end if;
    if learning_owner is distinct from experiment_owner then raise exception 'Learning evidence owner mismatch'; end if;
    if experiment_status <> 'completed' or experiment_result is null or experiment_result = 'insufficient_data' then raise exception 'Experiment is not eligible for learning'; end if;
    new.user_id = learning_owner;
    new.observed_at = experiment_observed_at;
    return new;
end;
$$;

create trigger learning_evidence_validate_source
before insert or update of learning_id, user_id, experiment_id on public.learning_evidence
for each row execute function public.validate_learning_evidence();

create or replace function public.refresh_learning_evidence_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    target_learning_id uuid;
    linked_count integer;
begin
    target_learning_id := case when tg_op = 'DELETE' then old.learning_id else new.learning_id end;
    select count(*) into linked_count from public.learning_evidence where learning_id = target_learning_id;
    if linked_count = 0 then
        delete from public.learnings where id = target_learning_id;
    else
        update public.learnings
        set evidence_count = (
                select coalesce(sum(e.observation_count), 0)::integer
                from public.learning_evidence le join public.experiments e on e.id = le.experiment_id
                where le.learning_id = target_learning_id
            ),
            metadata = jsonb_set(
                jsonb_set(metadata, '{experiment_count}', to_jsonb(linked_count)),
                '{result_counts}', jsonb_build_object(
                    'supports', (select count(*) from public.learning_evidence le join public.experiments e on e.id = le.experiment_id where le.learning_id = target_learning_id and e.result = 'supports'),
                    'mixed', (select count(*) from public.learning_evidence le join public.experiments e on e.id = le.experiment_id where le.learning_id = target_learning_id and e.result = 'mixed'),
                    'does_not_support', (select count(*) from public.learning_evidence le join public.experiments e on e.id = le.experiment_id where le.learning_id = target_learning_id and e.result = 'does_not_support')
                )
            ) || case when tg_op = 'DELETE' then '{"needs_resynthesis":true}'::jsonb else '{}'::jsonb end,
            title = case when tg_op = 'DELETE' and status <> 'archived' then 'Learning needs review' else title end,
            description = case when tg_op = 'DELETE' and status <> 'archived' then 'The available evidence changed after a source experiment was removed. This learning may need to be reviewed.' else description end,
            confidence = case when tg_op = 'DELETE' and status <> 'archived' then null else confidence end,
            status = case when tg_op = 'DELETE' and status <> 'archived' then 'revised' else status end
        where id = target_learning_id;
    end if;
    if tg_op = 'DELETE' then return old; end if;
    return new;
end;
$$;

create trigger learning_evidence_refresh_stats
after insert or delete on public.learning_evidence
for each row execute function public.refresh_learning_evidence_stats();

create or replace function public.require_learning_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if exists (select 1 from public.learnings where id = new.id)
       and not exists (select 1 from public.learning_evidence where learning_id = new.id) then raise exception 'Learning requires evidence'; end if;
    return new;
end;
$$;

create constraint trigger learnings_require_evidence
after insert on public.learnings
deferrable initially deferred
for each row execute function public.require_learning_evidence();

alter table public.learnings enable row level security;
alter table public.learning_evidence enable row level security;
create policy "Users can read their learnings" on public.learnings for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can read their learning evidence" on public.learning_evidence
for select to authenticated using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.learnings l where l.id = learning_id and l.user_id = (select auth.uid()))
);

alter table public.ai_runs drop constraint ai_runs_task_check;
alter table public.ai_runs add constraint ai_runs_task_check check (task in ('conversation_response', 'signal_extraction', 'memory_evaluation', 'pattern_analysis', 'experiment_analysis', 'learning_synthesis'));

create or replace function public.claim_learning_ai_run(run_user_id uuid, run_experiment_id uuid)
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
    perform pg_advisory_xact_lock(hashtextextended(run_user_id::text, 5));
    if not exists (
        select 1 from public.experiments
        where id = run_experiment_id and user_id = run_user_id and status = 'completed'
          and result is not null and result <> 'insufficient_data' and observation_count >= 3
    ) then raise exception 'INVALID_LEARNING_RUN_SOURCE'; end if;
    select id, status, attempt_count, attempted_at, attempt_token into run_id, run_status, run_attempts, run_attempted_at, run_token
    from public.ai_runs where experiment_id = run_experiment_id and task = 'learning_synthesis' for update;
    if run_id is not null then
        if run_status = 'succeeded' then return jsonb_build_object('id', run_id, 'status', run_status, 'attemptToken', run_token); end if;
        if run_status = 'started' and run_attempted_at > now() - interval '45 seconds' then raise exception 'LEARNING_SYNTHESIS_IN_PROGRESS'; end if;
        if run_attempts >= 5 then raise exception 'LEARNING_SYNTHESIS_ATTEMPTS_EXHAUSTED'; end if;
        if (select count(*) from public.ai_run_attempts where user_id = run_user_id and attempted_at > now() - interval '1 minute') >= 20 then raise exception 'LEARNING_SYNTHESIS_RATE_LIMITED'; end if;
        run_token := gen_random_uuid();
        update public.ai_runs set status = 'started', attempted_at = now(), attempt_count = attempt_count + 1, completed_at = null, error_code = null, attempt_token = run_token where id = run_id;
        insert into public.ai_run_attempts (run_id, user_id, task) values (run_id, run_user_id, 'learning_synthesis');
        return jsonb_build_object('id', run_id, 'status', 'started', 'attemptToken', run_token);
    end if;
    if (select count(*) from public.ai_run_attempts where user_id = run_user_id and attempted_at > now() - interval '1 minute') >= 20 then raise exception 'LEARNING_SYNTHESIS_RATE_LIMITED'; end if;
    insert into public.ai_runs (user_id, experiment_id, task) values (run_user_id, run_experiment_id, 'learning_synthesis') returning id, attempt_token into run_id, run_token;
    insert into public.ai_run_attempts (run_id, user_id, task) values (run_id, run_user_id, 'learning_synthesis');
    return jsonb_build_object('id', run_id, 'status', 'started', 'attemptToken', run_token);
end;
$$;

create or replace function public.apply_learning_synthesis(
    learning_user_id uuid,
    target_learning_id uuid,
    source_experiment uuid,
    synthesized_title text,
    synthesized_description text,
    synthesized_canonical_key text,
    synthesized_status text,
    synthesized_confidence numeric,
    synthesized_metadata jsonb,
    evidence_experiment_ids uuid[],
    evidence_relationship text,
    synthesis_run_id uuid,
    synthesis_attempt_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    resolved_learning_id uuid;
    created_learning boolean := false;
    evidence_id uuid;
    eligible_count integer;
    current_status text;
begin
    if synthesized_status not in ('active', 'revised') then raise exception 'Invalid learning status'; end if;
    if synthesized_confidence is not null and (synthesized_confidence < 0 or synthesized_confidence > 1) then raise exception 'Invalid confidence'; end if;
    if evidence_relationship not in ('supports', 'mixed', 'contradicts') then raise exception 'Invalid learning relationship'; end if;
    if coalesce(cardinality(evidence_experiment_ids), 0) < 1 then raise exception 'Learning requires evidence'; end if;
    select count(distinct id) into eligible_count from public.experiments
    where id = any(evidence_experiment_ids) and user_id = learning_user_id and status = 'completed' and result is not null and result <> 'insufficient_data';
    if eligible_count <> cardinality(evidence_experiment_ids) then raise exception 'Invalid learning evidence'; end if;
    if source_experiment <> all(evidence_experiment_ids) then raise exception 'Invalid source experiment'; end if;

    perform pg_advisory_xact_lock(hashtextextended(learning_user_id::text, 5));
    if not exists (
        select 1 from public.ai_runs where id = synthesis_run_id and user_id = learning_user_id
          and experiment_id = source_experiment and task = 'learning_synthesis' and status = 'started' and error_code is null
          and attempt_token = synthesis_attempt_token
    ) then raise exception 'LEARNING_SYNTHESIS_SUPPRESSED'; end if;

    if target_learning_id is not null then
        select id, status into resolved_learning_id, current_status from public.learnings where id = target_learning_id and user_id = learning_user_id for update;
        if resolved_learning_id is null then raise exception 'Learning unavailable'; end if;
        if current_status = 'archived' then raise exception 'Learning is archived'; end if;
    else
        select id into resolved_learning_id from public.learnings
        where user_id = learning_user_id and canonical_key = synthesized_canonical_key and status in ('active', 'revised')
        order by updated_at desc limit 1 for update;
    end if;

    if resolved_learning_id is null then
        insert into public.learnings (user_id, title, description, canonical_key, confidence, source_experiment_id, status, metadata)
        values (learning_user_id, synthesized_title, synthesized_description, synthesized_canonical_key, synthesized_confidence, source_experiment, synthesized_status, synthesized_metadata)
        returning id into resolved_learning_id;
        created_learning := true;
    else
        update public.learnings set
            title = case when metadata->>'latest_result' is not null and metadata->>'latest_result' is distinct from synthesized_metadata->>'latest_result' then 'Learning revised by new evidence' else synthesized_title end,
            description = case when metadata->>'latest_result' is not null and metadata->>'latest_result' is distinct from synthesized_metadata->>'latest_result' then 'Across completed experiments, the recorded effect appears inconsistent. This learning has been revised to preserve that uncertainty.' else synthesized_description end,
            canonical_key = synthesized_canonical_key,
            confidence = case
                when metadata->>'latest_result' is not null and metadata->>'latest_result' is distinct from synthesized_metadata->>'latest_result' then least(confidence, synthesized_confidence)
                else greatest(confidence, synthesized_confidence)
            end,
            status = case
                when status = 'revised' then 'revised'
                when metadata->>'latest_result' is not null and metadata->>'latest_result' is distinct from synthesized_metadata->>'latest_result' then 'revised'
                else synthesized_status
            end,
            metadata = metadata || synthesized_metadata
        where id = resolved_learning_id;
    end if;

    foreach evidence_id in array evidence_experiment_ids loop
        insert into public.learning_evidence (learning_id, user_id, experiment_id, relationship, observed_at)
        select resolved_learning_id, learning_user_id, e.id, evidence_relationship, coalesce(e.completed_at, e.updated_at)
        from public.experiments e where e.id = evidence_id and e.user_id = learning_user_id
          and not exists (select 1 from public.learning_evidence le where le.experiment_id = e.id);
    end loop;
    return jsonb_build_object('action', case when created_learning then 'created' else 'updated' end, 'learningId', resolved_learning_id, 'status', (select status from public.learnings where id = resolved_learning_id));
end;
$$;

create or replace function public.set_experiment_learning_status(experiment_user_id uuid, target_experiment_id uuid, new_status text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new_status not in ('pending', 'succeeded', 'failed', 'not_applicable') then raise exception 'Invalid learning status'; end if;
    update public.experiments set learning_status = new_status
    where id = target_experiment_id and user_id = experiment_user_id and status = 'completed'
      and (learning_status is null or learning_status not in ('succeeded', 'not_applicable') or new_status is not distinct from learning_status);
    return found;
end;
$$;

create or replace function public.archive_learning(target_learning_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
    if auth.uid() is null then raise exception 'Authentication required'; end if;
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 5));
    update public.learnings set status = 'archived' where id = target_learning_id and user_id = auth.uid();
    if found then
        update public.experiments set learning_status = 'not_applicable'
        where id in (select experiment_id from public.learning_evidence where learning_id = target_learning_id) and user_id = auth.uid();
        update public.ai_runs set status = 'succeeded', error_code = 'USER_LEARNING_RESET', completed_at = now()
        where user_id = auth.uid() and task = 'learning_synthesis' and status <> 'succeeded'
          and experiment_id in (select experiment_id from public.learning_evidence where learning_id = target_learning_id);
    end if;
    return found;
end;
$$;

create or replace function public.delete_learning(target_learning_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
    if auth.uid() is null then raise exception 'Authentication required'; end if;
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 5));
    if exists (select 1 from public.learnings where id = target_learning_id and user_id = auth.uid()) then
        update public.experiments set learning_status = 'not_applicable'
        where id in (select experiment_id from public.learning_evidence where learning_id = target_learning_id) and user_id = auth.uid();
        update public.ai_runs set status = 'succeeded', error_code = 'USER_LEARNING_RESET', completed_at = now()
        where user_id = auth.uid() and task = 'learning_synthesis' and status <> 'succeeded'
          and experiment_id in (select experiment_id from public.learning_evidence where learning_id = target_learning_id);
        delete from public.learnings where id = target_learning_id and user_id = auth.uid();
        return true;
    end if;
    return false;
end;
$$;

create or replace function public.finish_experiment(experiment_user_id uuid, target_experiment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    linked_pattern_id uuid;
    previous_pattern_status text;
    current_status text;
begin
    select status, pattern_id, metadata->>'pattern_previous_status' into current_status, linked_pattern_id, previous_pattern_status
    from public.experiments where id = target_experiment_id and user_id = experiment_user_id for update;
    if current_status is null then raise exception 'EXPERIMENT_UNAVAILABLE'; end if;
    if current_status = 'completed' then return jsonb_build_object('id', target_experiment_id, 'status', 'completed'); end if;
    if current_status <> 'active' then raise exception 'EXPERIMENT_NOT_ACTIVE'; end if;
    update public.experiments set status = 'completed', end_date = current_date, completed_at = now() where id = target_experiment_id;
    if linked_pattern_id is not null then
        update public.patterns set status = case when previous_pattern_status in ('candidate', 'possible', 'supported') then previous_pattern_status else 'possible' end
        where id = linked_pattern_id and user_id = experiment_user_id and status = 'testing';
    end if;
    return jsonb_build_object('id', target_experiment_id, 'status', 'completed');
end;
$$;

revoke all on function public.claim_learning_ai_run(uuid, uuid) from public;
grant execute on function public.claim_learning_ai_run(uuid, uuid) to service_role;
revoke all on function public.apply_learning_synthesis(uuid, uuid, uuid, text, text, text, text, numeric, jsonb, uuid[], text, uuid, uuid) from public;
grant execute on function public.apply_learning_synthesis(uuid, uuid, uuid, text, text, text, text, numeric, jsonb, uuid[], text, uuid, uuid) to service_role;
revoke all on function public.set_experiment_learning_status(uuid, uuid, text) from public;
grant execute on function public.set_experiment_learning_status(uuid, uuid, text) to service_role;
revoke all on function public.archive_learning(uuid) from public;
grant execute on function public.archive_learning(uuid) to authenticated;
revoke all on function public.delete_learning(uuid) from public;
grant execute on function public.delete_learning(uuid) to authenticated;

create table public.experiments (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    pattern_id uuid references public.patterns(id) on delete set null,
    title text not null check (char_length(trim(title)) between 3 and 120),
    hypothesis text not null check (char_length(trim(hypothesis)) between 10 and 500),
    description text not null check (char_length(trim(description)) between 10 and 1000),
    status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'cancelled')),
    start_date date,
    end_date date,
    result text check (result is null or result in ('supports', 'mixed', 'does_not_support', 'insufficient_data')),
    result_summary text check (result_summary is null or char_length(result_summary) <= 2000),
    confidence numeric check (confidence is null or confidence between 0 and 1),
    observation_count integer not null default 0 check (observation_count >= 0),
    sort_priority smallint generated always as (case status when 'active' then 0 when 'draft' then 1 when 'completed' then 2 else 3 end) stored,
    metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 16384),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (end_date is null or start_date is null or end_date >= start_date)
);

create table public.experiment_observations (
    id uuid primary key default gen_random_uuid(),
    experiment_id uuid not null references public.experiments(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    value jsonb not null check (jsonb_typeof(value) = 'object' and octet_length(value::text) <= 4096),
    notes text check (notes is null or char_length(notes) <= 2000),
    client_request_id text not null check (char_length(client_request_id) between 1 and 100),
    observed_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    unique (user_id, client_request_id)
);

create unique index experiments_user_pattern_open_unique on public.experiments (user_id, pattern_id)
where pattern_id is not null and status in ('draft', 'active');
create index experiments_user_status_updated_idx on public.experiments (user_id, sort_priority, updated_at desc, id);
create index experiments_pattern_idx on public.experiments (pattern_id) where pattern_id is not null;
create index experiment_observations_experiment_observed_idx on public.experiment_observations (experiment_id, observed_at desc, id);

create trigger experiments_set_updated_at
before update on public.experiments
for each row execute function public.set_updated_at();

create or replace function public.validate_experiment_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    pattern_owner uuid;
begin
    if new.pattern_id is null then
        if tg_op = 'INSERT' then raise exception 'Experiment requires a pattern'; end if;
        new.user_id = old.user_id;
        return new;
    end if;
    select user_id into pattern_owner from public.patterns where id = new.pattern_id for key share;
    if pattern_owner is null then raise exception 'Pattern unavailable'; end if;
    new.user_id = pattern_owner;
    return new;
end;
$$;

create trigger experiments_validate_owner
before insert or update of user_id, pattern_id on public.experiments
for each row execute function public.validate_experiment_owner();

create or replace function public.validate_experiment_observation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    experiment_owner uuid;
    experiment_status text;
begin
    select user_id, status into experiment_owner, experiment_status from public.experiments where id = new.experiment_id for update;
    if experiment_owner is null then raise exception 'Experiment unavailable'; end if;
    if experiment_status <> 'active' then raise exception 'Experiment is not active'; end if;
    new.user_id = experiment_owner;
    return new;
end;
$$;

create trigger experiment_observations_validate_owner
before insert or update of experiment_id, user_id on public.experiment_observations
for each row execute function public.validate_experiment_observation();

create or replace function public.refresh_experiment_observation_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if tg_op = 'DELETE' then
        update public.experiments set observation_count = (select count(*) from public.experiment_observations where experiment_id = old.experiment_id) where id = old.experiment_id;
        return old;
    end if;
    update public.experiments
    set observation_count = (select count(*) from public.experiment_observations where experiment_id = new.experiment_id)
    where id = new.experiment_id;
    return new;
end;
$$;

create trigger experiment_observations_refresh_count
after insert or delete on public.experiment_observations
for each row execute function public.refresh_experiment_observation_count();

alter table public.experiments enable row level security;
alter table public.experiment_observations enable row level security;
create policy "Users can read their experiments" on public.experiments for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can read their experiment observations" on public.experiment_observations
for select to authenticated using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.experiments e where e.id = experiment_id and e.user_id = (select auth.uid()))
);

alter table public.ai_runs drop constraint ai_runs_user_message_id_task_key;
alter table public.ai_runs alter column conversation_id drop not null;
alter table public.ai_runs alter column user_message_id drop not null;
alter table public.ai_runs add column experiment_id uuid references public.experiments(id) on delete cascade;
alter table public.ai_runs add constraint ai_runs_source_check check (
    (experiment_id is null and conversation_id is not null and user_message_id is not null)
    or (experiment_id is not null and conversation_id is null and user_message_id is null)
);
create unique index ai_runs_message_task_unique_idx on public.ai_runs (user_message_id, task) where user_message_id is not null;
create unique index ai_runs_experiment_task_unique_idx on public.ai_runs (experiment_id, task) where experiment_id is not null;
alter table public.ai_runs drop constraint ai_runs_task_check;
alter table public.ai_runs add constraint ai_runs_task_check check (task in ('conversation_response', 'signal_extraction', 'memory_evaluation', 'pattern_analysis', 'experiment_analysis'));

create or replace function public.claim_experiment_ai_run(run_user_id uuid, run_experiment_id uuid)
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
    perform pg_advisory_xact_lock(hashtextextended(run_user_id::text, 4));
    if not exists (select 1 from public.experiments where id = run_experiment_id and user_id = run_user_id and status = 'completed') then
        raise exception 'INVALID_EXPERIMENT_RUN_SOURCE';
    end if;
    select id, status, attempt_count, attempted_at into run_id, run_status, run_attempts, run_attempted_at
    from public.ai_runs where experiment_id = run_experiment_id and task = 'experiment_analysis' for update;
    if run_id is not null then
        if run_status = 'succeeded' then return jsonb_build_object('id', run_id, 'status', run_status); end if;
        if run_status = 'started' and run_attempted_at > now() - interval '45 seconds' then raise exception 'EXPERIMENT_ANALYSIS_IN_PROGRESS'; end if;
        if run_attempts >= 5 then raise exception 'EXPERIMENT_ANALYSIS_ATTEMPTS_EXHAUSTED'; end if;
        if (select count(*) from public.ai_run_attempts where user_id = run_user_id and attempted_at > now() - interval '1 minute') >= 20 then raise exception 'EXPERIMENT_ANALYSIS_RATE_LIMITED'; end if;
        update public.ai_runs set status = 'started', attempted_at = now(), attempt_count = attempt_count + 1, completed_at = null, error_code = null where id = run_id;
        insert into public.ai_run_attempts (run_id, user_id, task) values (run_id, run_user_id, 'experiment_analysis');
        return jsonb_build_object('id', run_id, 'status', 'started');
    end if;
    if (select count(*) from public.ai_run_attempts where user_id = run_user_id and attempted_at > now() - interval '1 minute') >= 20 then
        raise exception 'EXPERIMENT_ANALYSIS_RATE_LIMITED';
    end if;
    insert into public.ai_runs (user_id, experiment_id, task) values (run_user_id, run_experiment_id, 'experiment_analysis') returning id into run_id;
    insert into public.ai_run_attempts (run_id, user_id, task) values (run_id, run_user_id, 'experiment_analysis');
    return jsonb_build_object('id', run_id, 'status', 'started');
end;
$$;

create or replace function public.start_experiment(experiment_user_id uuid, target_experiment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    duration_days integer;
    linked_pattern_id uuid;
    previous_pattern_status text;
begin
    select coalesce((metadata->>'duration_days')::integer, 5), pattern_id into duration_days, linked_pattern_id
    from public.experiments where id = target_experiment_id and user_id = experiment_user_id and status = 'draft' for update;
    if linked_pattern_id is null then raise exception 'EXPERIMENT_UNAVAILABLE'; end if;
    select status into previous_pattern_status from public.patterns where id = linked_pattern_id and user_id = experiment_user_id for update;
    update public.experiments set status = 'active', start_date = current_date, end_date = current_date + duration_days,
        metadata = metadata || jsonb_build_object('pattern_previous_status', previous_pattern_status)
    where id = target_experiment_id and user_id = experiment_user_id and status = 'draft';
    if not found then raise exception 'EXPERIMENT_UNAVAILABLE'; end if;
    update public.patterns set status = 'testing' where id = linked_pattern_id and status in ('candidate', 'possible', 'supported');
    return jsonb_build_object('id', target_experiment_id, 'status', 'active');
end;
$$;

create or replace function public.record_experiment_observation(experiment_user_id uuid, target_experiment_id uuid, observation_value jsonb, observation_notes text, request_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    observation_id uuid;
    observation_time timestamptz;
    existing_experiment_id uuid;
    experiment_end_date date;
begin
    select id, experiment_id, observed_at into observation_id, existing_experiment_id, observation_time from public.experiment_observations where user_id = experiment_user_id and client_request_id = request_id;
    if observation_id is not null and existing_experiment_id is distinct from target_experiment_id then raise exception 'INVALID_OBSERVATION_REQUEST'; end if;
    if observation_id is not null then return jsonb_build_object('id', observation_id, 'observedAt', observation_time); end if;
    select end_date into experiment_end_date from public.experiments where id = target_experiment_id and user_id = experiment_user_id and status = 'active' for update;
    if not found then raise exception 'EXPERIMENT_NOT_ACTIVE'; end if;
    if experiment_end_date is not null and current_date > experiment_end_date then raise exception 'EXPERIMENT_ENDED'; end if;
    if observation_id is null then
        insert into public.experiment_observations (experiment_id, user_id, value, notes, client_request_id)
        values (target_experiment_id, experiment_user_id, observation_value, nullif(trim(observation_notes), ''), request_id)
        returning id, observed_at into observation_id, observation_time;
    end if;
    return jsonb_build_object('id', observation_id, 'observedAt', observation_time);
end;
$$;

create or replace function public.save_experiment_outcome(
    experiment_user_id uuid,
    target_experiment_id uuid,
    outcome_result text,
    outcome_summary text,
    outcome_confidence numeric,
    outcome_metrics jsonb,
    outcome_interpretation text,
    outcome_analysis_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_experiment public.experiments;
begin
    if outcome_result not in ('supports', 'mixed', 'does_not_support', 'insufficient_data') then raise exception 'INVALID_EXPERIMENT_OUTCOME'; end if;
    if outcome_analysis_status not in ('pending', 'not_needed', 'succeeded', 'failed') then raise exception 'INVALID_EXPERIMENT_OUTCOME'; end if;
    select * into current_experiment from public.experiments where id = target_experiment_id and user_id = experiment_user_id and status = 'completed' for update;
    if current_experiment.id is null then raise exception 'EXPERIMENT_NOT_COMPLETED'; end if;
    if current_experiment.metadata->>'analysis_status' = 'succeeded' and outcome_analysis_status <> 'succeeded' then return to_jsonb(current_experiment); end if;
    update public.experiments
    set result = outcome_result,
        result_summary = outcome_summary,
        confidence = outcome_confidence,
        metadata = metadata || jsonb_build_object('metrics', outcome_metrics, 'result', outcome_result, 'interpretation', outcome_interpretation, 'analysis_status', outcome_analysis_status, 'measurement', 'easier_same_harder')
    where id = target_experiment_id
    returning * into current_experiment;
    return to_jsonb(current_experiment);
end;
$$;

create or replace function public.delete_experiment(experiment_user_id uuid, target_experiment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform 1 from public.experiments where id = target_experiment_id and user_id = experiment_user_id and status in ('completed', 'cancelled') for update;
    if not found then return false; end if;
    delete from public.experiments where id = target_experiment_id and user_id = experiment_user_id;
    return true;
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
    update public.experiments set status = 'completed', end_date = current_date where id = target_experiment_id;
    if linked_pattern_id is not null then
        update public.patterns set status = case when previous_pattern_status in ('candidate', 'possible', 'supported') then previous_pattern_status else 'possible' end
        where id = linked_pattern_id and user_id = experiment_user_id and status = 'testing';
    end if;
    return jsonb_build_object('id', target_experiment_id, 'status', 'completed');
end;
$$;

create or replace function public.cancel_experiment(experiment_user_id uuid, target_experiment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    linked_pattern_id uuid;
    previous_pattern_status text;
begin
    select pattern_id, metadata->>'pattern_previous_status' into linked_pattern_id, previous_pattern_status
    from public.experiments where id = target_experiment_id and user_id = experiment_user_id and status in ('draft', 'active') for update;
    if not found then return false; end if;
    update public.experiments set status = 'cancelled', end_date = case when status = 'active' then current_date else end_date end where id = target_experiment_id;
    if linked_pattern_id is not null then
        update public.patterns set status = case when previous_pattern_status in ('candidate', 'possible', 'supported') then previous_pattern_status else 'possible' end
        where id = linked_pattern_id and user_id = experiment_user_id and status = 'testing';
    end if;
    return true;
end;
$$;

revoke all on function public.claim_experiment_ai_run(uuid, uuid) from public;
grant execute on function public.claim_experiment_ai_run(uuid, uuid) to service_role;
revoke all on function public.start_experiment(uuid, uuid) from public;
grant execute on function public.start_experiment(uuid, uuid) to service_role;
revoke all on function public.record_experiment_observation(uuid, uuid, jsonb, text, text) from public;
grant execute on function public.record_experiment_observation(uuid, uuid, jsonb, text, text) to service_role;
revoke all on function public.finish_experiment(uuid, uuid) from public;
grant execute on function public.finish_experiment(uuid, uuid) to service_role;
revoke all on function public.cancel_experiment(uuid, uuid) from public;
grant execute on function public.cancel_experiment(uuid, uuid) to service_role;
revoke all on function public.save_experiment_outcome(uuid, uuid, text, text, numeric, jsonb, text, text) from public;
grant execute on function public.save_experiment_outcome(uuid, uuid, text, text, numeric, jsonb, text, text) to service_role;
revoke all on function public.delete_experiment(uuid, uuid) from public;
grant execute on function public.delete_experiment(uuid, uuid) to service_role;

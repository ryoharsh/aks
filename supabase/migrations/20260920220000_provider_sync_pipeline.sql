-- Connected Providers pipeline:
-- provider sync state -> server-side observation ingestion -> signal bridge.
-- The Observation Engine still never concludes anything: it stores what a
-- source objectively observed and forwards meaningful observations to the
-- EXISTING Signal/Pattern engines via the signals bridge.

-- 1. Provider sync state on the registry ------------------------------------

alter table public.user_data_sources
    add column if not exists sync_cursor jsonb not null default '{}'::jsonb
        check (jsonb_typeof(sync_cursor) = 'object'),
    add column if not exists sync_error text,
    add column if not exists sync_failed_at timestamptz,
    add column if not exists initial_synced_at timestamptz;

-- 2. Server-side sync job queue (survives retries; claimed atomically) -------

create table public.provider_sync_jobs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    source_type text not null,
    job_key text not null,
    payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
    status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'skipped')),
    attempts integer not null default 0 check (attempts between 0 and 10),
    available_at timestamptz not null default now(),
    last_error text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, source_type, job_key)
);

create index provider_sync_jobs_due_idx on public.provider_sync_jobs (status, available_at);

alter table public.provider_sync_jobs enable row level security;

create policy "Users can read their sync jobs" on public.provider_sync_jobs
    for select to authenticated using ((select auth.uid()) = user_id);
-- Enqueue through the security-definer function below; no direct client writes.

create or replace function public.enqueue_provider_sync(
    p_user_id uuid,
    p_source_type text,
    p_job_key text,
    p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    job_id uuid;
begin
    if p_user_id is null or p_user_id <> (select auth.uid()) then
        raise exception 'SYNC_UNAUTHORIZED';
    end if;
    if not exists (
        select 1 from public.user_data_sources
        where user_id = p_user_id and source_type = p_source_type and status = 'connected'
    ) then
        return null; -- only connected sources can enqueue work
    end if;
    if char_length(p_job_key) = 0 or char_length(p_job_key) > 120 then
        raise exception 'SYNC_INVALID_JOB_KEY';
    end if;

    insert into public.provider_sync_jobs (user_id, source_type, job_key, payload)
    values (p_user_id, p_source_type, p_job_key, coalesce(p_payload, '{}'::jsonb))
    on conflict (user_id, source_type, job_key) do nothing
    returning id into job_id;

    if job_id is null then
        select id into job_id from public.provider_sync_jobs
        where user_id = p_user_id and source_type = p_source_type and job_key = p_job_key;
    end if;
    return job_id;
end;
$$;

revoke all on function public.enqueue_provider_sync(uuid, text, text, jsonb) from public;
grant execute on function public.enqueue_provider_sync(uuid, text, text, jsonb) to authenticated;

create or replace function public.claim_provider_sync_jobs(p_limit integer default 10)
returns table (job_id uuid, job_user_id uuid, source_type text, payload jsonb, attempts integer)
language sql
security definer
set search_path = ''
as $$
    with claimed as (
        select id
        from public.provider_sync_jobs
        where status = 'queued' and available_at <= now()
        order by available_at
        limit greatest(least(p_limit, 50), 1)
        for update skip locked
    )
    update public.provider_sync_jobs j
    set status = 'sending', attempts = j.attempts + 1, updated_at = now()
    from claimed c
    where j.id = c.id
    returning j.id, j.user_id, j.source_type, j.payload, j.attempts;
$$;

revoke all on function public.claim_provider_sync_jobs(integer) from public;
grant execute on function public.claim_provider_sync_jobs(integer) to service_role, authenticated;

create or replace function public.complete_provider_sync_jobs(
    p_job_ids uuid[],
    p_status text,
    p_error text default null,
    p_retry_delay_seconds integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if p_status not in ('sent', 'failed', 'skipped') then
        raise exception 'SYNC_INVALID_STATUS';
    end if;
    update public.provider_sync_jobs
    set status = p_status,
        last_error = p_error,
        available_at = case
            when p_status = 'failed' and p_retry_delay_seconds is not null
                then now() + make_interval(secs => greatest(least(p_retry_delay_seconds, 3600), 0))
            else available_at
        end,
        updated_at = now()
    where id = any(p_job_ids);
end;
$$;

revoke all on function public.complete_provider_sync_jobs(uuid[], text, text, integer) from public;
grant execute on function public.complete_provider_sync_jobs(uuid[], text, text, integer) to service_role, authenticated;

-- 3. Sync state recording (cursor / last sync / error honesty) ----------------

create or replace function public.record_sync_result(
    p_user_id uuid,
    p_source_type text,
    p_status text,           -- 'ok' | 'error' | 'temporary'
    p_cursor jsonb default null,
    p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if p_user_id is null or p_user_id <> (select auth.uid()) then
        raise exception 'SYNC_UNAUTHORIZED';
    end if;
    if p_status not in ('ok', 'error', 'temporary') then
        raise exception 'SYNC_INVALID_RESULT';
    end if;
    update public.user_data_sources
    set sync_cursor = coalesce(p_cursor, sync_cursor),
        sync_error = case when p_status = 'ok' then null else left(coalesce(p_error, 'sync failed'), 300) end,
        sync_failed_at = case when p_status = 'ok' then null else now() end,
        last_synced_at = case when p_status = 'ok' then now() else last_synced_at end,
        initial_synced_at = case
            when p_status = 'ok' and initial_synced_at is null then now()
            else initial_synced_at
        end,
        status = case
            when p_status = 'temporary' and status = 'connected' then 'error'::text
            when p_status = 'error' and status = 'connected' then 'error'::text
            else status
        end,
        updated_at = now()
    where user_id = p_user_id and source_type = p_source_type;
end;
$$;

revoke all on function public.record_sync_result(uuid, text, text, jsonb, text) from public;
grant execute on function public.record_sync_result(uuid, text, text, jsonb, text) to authenticated;

-- 4. Observation -> signal bridge ---------------------------------------------
-- Observations are objective records; signals are the EXISTING engine's input
-- vocabulary. The bridge only maps meaningful observation types onto known
-- concept signals, deterministic values, DB-level dedup, source traceability.

alter type public.signal_source_type add value if not exists 'observation';

create or replace function public.observation_signal_type(p_observation_type text, p_value jsonb)
returns text
language sql
immutable
as $$
    select case
        when p_observation_type = 'planned_event' and p_value->>'eventCategory' in ('work', 'meeting', 'focus')
            then 'schedule_density'
        when p_observation_type = 'planned_action' then 'routine_change'
        when p_observation_type = 'movement_context' and p_value->>'context' = 'travel' then 'routine_change'
        when p_observation_type = 'usage_window' and (p_value->>'category') in ('social', 'entertainment') then 'focus_difficulty'
        when p_observation_type = 'commit_activity' then 'routine_change'
        when p_observation_type = 'communication_window' then 'stress_level'
        else null
    end;
$$;

create or replace function public.observation_signal_value(p_observation_type text, p_value jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
    v jsonb;
begin
    case
        when p_observation_type = 'planned_event' then
            v := jsonb_build_object('period', case
                when extract(hour from (p_value->>'scheduledStart')::timestamptz at time zone 'utc') < 12 then 'morning'
                when extract(hour from (p_value->>'scheduledStart')::timestamptz at time zone 'utc') < 17 then 'afternoon'
                else 'evening' end);
        when p_observation_type = 'movement_context' then
            v := jsonb_build_object('changed', true);
        when p_observation_type = 'planned_action' then
            v := jsonb_build_object('changed', coalesce(p_value->>'completed', 'false') <> 'true');
        when p_observation_type = 'usage_window' then
            v := jsonb_build_object('period', case
                when extract(hour from (p_value->>'windowStart')::timestamptz at time zone 'utc') < 12 then 'morning'
                when extract(hour from (p_value->>'windowStart')::timestamptz at time zone 'utc') < 17 then 'afternoon'
                else 'evening' end);
        when p_observation_type = 'commit_activity' then
            v := jsonb_build_object('changed', true);
        when p_observation_type = 'communication_window' then
            v := jsonb_build_object('level', 'elevated');
        else
            v := '{}'::jsonb;
    end case;
    return coalesce(v, '{}'::jsonb);
end;
$$;

create or replace function public.observation_signal_concept_value(p_observation_type text, p_value jsonb)
returns text
language sql
immutable
as $$
    select case
        when p_observation_type = 'usage_window' then 'focus_difficulty'
        when p_observation_type = 'movement_context' then 'routine_change'
        when p_observation_type = 'planned_action' then 'routine_change'
        when p_observation_type = 'commit_activity' then 'routine_change'
        when p_observation_type = 'communication_window' then 'stress_level'
        else 'routine_change'
    end;
$$;

-- Server-side ingestion: validate -> dedupe -> store observation -> bridge
-- signal. Never callable for arbitrary users; service-role only.
create or replace function public.ingest_provider_observation(
    p_user_id uuid,
    p_source_type text,
    p_observation_type text,
    p_source_event_id text,
    p_observed_at timestamptz,
    p_value jsonb,
    p_confidence numeric default null,
    p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    observation_id uuid;
    signal_type text;
    signal_id uuid;
begin
    if p_user_id is null then
        raise exception 'OBSERVATION_UNAUTHORIZED';
    end if;
    if not exists (
        select 1 from public.user_data_sources
        where user_id = p_user_id and source_type = p_source_type and status = 'connected'
    ) then
        return jsonb_build_object('status', 'skipped', 'reason', 'source_not_connected');
    end if;
    if not public.validate_observation_value(p_source_type, p_observation_type, p_value) then
        raise exception 'OBSERVATION_INVALID_VALUE';
    end if;
    if char_length(p_source_event_id) = 0 or char_length(p_source_event_id) > 160 then
        raise exception 'OBSERVATION_INVALID_EVENT_ID';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || p_source_type || p_source_event_id, 0));

    insert into public.observations (user_id, source_type, observation_type, source_event_id, observed_at, value, confidence, metadata)
    values (p_user_id, p_source_type, p_observation_type, p_source_event_id, p_observed_at, p_value, p_confidence, p_metadata)
    on conflict (source_type, source_event_id) do nothing
    returning id into observation_id;

    if observation_id is null then
        select id into observation_id from public.observations
        where source_type = p_source_type and source_event_id = p_source_event_id;
        return jsonb_build_object('status', 'deduplicated', 'observation_id', observation_id);
    end if;

    -- Bridge a meaningful observation into a candidate signal for the
    -- EXISTING signal/pattern engines. Deduplicated per (source, signal).
    signal_type := public.observation_signal_type(p_observation_type, p_value);
    if signal_type is not null then
        insert into public.signals (user_id, source_type, source_id, source_message_id, signal_type, value, confidence, observed_at)
        values (
            p_user_id,
            'observation',
            observation_id,
            null,
            signal_type,
            jsonb_build_object('conceptValue', public.observation_signal_concept_value(p_observation_type, p_value))
                || public.observation_signal_value(p_observation_type, p_value),
            p_confidence,
            p_observed_at
        )
        on conflict (source_type, source_id, signal_type) where source_message_id is null do nothing
        returning id into signal_id;
    end if;

    return jsonb_build_object('status', 'created', 'observation_id', observation_id, 'signal_id', signal_id);
end;
$$;

revoke all on function public.ingest_provider_observation(uuid, text, text, text, timestamptz, jsonb, numeric, jsonb) from public;
grant execute on function public.ingest_provider_observation(uuid, text, text, text, timestamptz, jsonb, numeric, jsonb) to service_role;

-- 5. Context bundle: relevance source filter ----------------------------------
-- get_context_bundle gains an optional source filter so MirrorCore only ever
-- sees sources relevant to the current topic (never everything connected).

create or replace function public.get_context_bundle(
    p_user_id uuid,
    p_anchor timestamptz default null,
    p_window_hours numeric default 6,
    p_limit integer default 12,
    p_source_filter jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    anchor timestamptz := coalesce(p_anchor, now());
    bundle jsonb;
    connected text[];
begin
    if p_user_id is null or p_user_id <> (select auth.uid()) then
        raise exception 'CONTEXT_UNAUTHORIZED';
    end if;

    select coalesce(array_agg(source_type), '{}'::text[]) into connected
    from public.user_data_sources
    where user_id = p_user_id and status = 'connected';

    if array_length(connected, 1) is null then
        return jsonb_build_object('connectedSources', '{}'::text[], 'observations', '[]'::jsonb);
    end if;

    select coalesce(jsonb_agg(observation order by observation->>'observedAt' desc), '[]'::jsonb)
    into bundle
    from (
        select jsonb_build_object(
            'sourceType', o.source_type,
            'observationType', o.observation_type,
            'observedAt', o.observed_at,
            'value', o.value
        ) as observation
        from public.observations o
        where o.user_id = p_user_id
          and o.source_type = any(connected)
          and (p_source_filter is null or o.source_type = any (select value::text from jsonb_array_elements_text(p_source_filter)))
          and o.observed_at between anchor - (p_window_hours || ' hours')::interval and anchor
        order by o.observed_at desc
        limit least(greatest(p_limit, 1), 30)
    ) recent;

    return jsonb_build_object(
        'connectedSources', to_jsonb(connected),
        'observations', coalesce(bundle, '[]'::jsonb)
    );
end;
$$;

revoke all on function public.get_context_bundle(uuid, timestamptz, numeric, integer, jsonb) from public;
grant execute on function public.get_context_bundle(uuid, timestamptz, numeric, integer, jsonb) to authenticated, service_role;

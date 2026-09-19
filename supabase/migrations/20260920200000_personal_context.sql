-- Personal Context & Observation system.
-- A source registry (one row per user per source), a normalized observations
-- store, and a context bundle resolver for MirrorCore.
-- Collection only ever begins after the user connects a source; disconnecting
-- stops future collection and optionally removes that source's observations.

-- ---------------------------------------------------------------------------
-- Source registry
-- ---------------------------------------------------------------------------

create table public.user_data_sources (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    source_type text not null check (source_type in ('location', 'calendar', 'reminders', 'screen_time', 'contacts', 'calls', 'messages', 'notifications', 'photos', 'health', 'app_activity', 'voice_session')),
    status text not null default 'not_connected'
        check (status in ('not_connected', 'connected', 'revoked', 'error')),
    platform_support text not null default 'supported'
        check (platform_support in ('supported', 'supported_with_conditions', 'not_available', 'policy_restricted')),
    permission_state text not null default 'not_determined'
        check (permission_state in ('not_determined', 'granted', 'denied', 'restricted', 'unavailable')),
    mode text,
    timezone text,
    last_synced_at timestamptz,
    settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
    connected_at timestamptz,
    disconnected_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, source_type)
);

create index user_data_sources_user_idx on public.user_data_sources (user_id);

alter table public.user_data_sources enable row level security;

create policy "Users can read their data sources" on public.user_data_sources
    for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their data sources" on public.user_data_sources
    for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their data sources" on public.user_data_sources
    for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their data sources" on public.user_data_sources
    for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Normalized observations (never raw dumps; minimal structured values)
-- ---------------------------------------------------------------------------

create table public.observations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    source_type text not null,
    observation_type text not null check (char_length(trim(observation_type)) between 1 and 60),
    source_event_id text not null,
    observed_at timestamptz not null,
    value jsonb not null check (jsonb_typeof(value) = 'object' and octet_length(value::text) <= 2048),
    confidence numeric check (confidence is null or confidence between 0 and 1),
    metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
    created_at timestamptz not null default now(),
    unique (source_type, source_event_id)
);

create index observations_user_observed_idx on public.observations (user_id, observed_at desc);
create index observations_user_source_idx on public.observations (user_id, source_type, observed_at desc);

alter table public.observations enable row level security;

create policy "Users can read their observations" on public.observations
    for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their observations" on public.observations
    for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can delete their observations" on public.observations
    for delete to authenticated using ((select auth.uid()) = user_id);

-- Validated per-source observation schemas (the engine rejects anything else).
create or replace function public.validate_observation_value(p_source_type text, p_observation_type text, p_value jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
    keys text[];
    required text[];
begin
    if p_source_type = 'location' then
        if p_observation_type not in ('place_context', 'movement_context') then return false; end if;
        keys := jsonb_object_keys(p_value);
        if exists (select 1 from unnest(keys) k where k not in ('context', 'placeCategory', 'durationMinutes', 'distanceKm')) then return false; end if;
        if p_observation_type = 'place_context' then
            if p_value->>'context' not in ('home_area', 'work_area', 'familiar_place', 'unfamiliar_place') then return false; end if;
        else
            if p_value->>'context' not in ('stationary', 'moving', 'travel') then return false; end if;
        end if;
        return true;
    elsif p_source_type = 'calendar' then
        if p_observation_type <> 'planned_event' then return false; end if;
        keys := jsonb_object_keys(p_value);
        if exists (select 1 from unnest(keys) k where k not in ('eventCategory', 'scheduledStart', 'scheduledEnd', 'scheduledDurationMinutes', 'status')) then return false; end if;
        if p_value->>'status' is not null and p_value->>'status' not in ('confirmed', 'cancelled') then return false; end if;
        return true;
    elsif p_source_type = 'reminders' then
        if p_observation_type <> 'planned_action' then return false; end if;
        keys := jsonb_object_keys(p_value);
        if exists (select 1 from unnest(keys) k where k not in ('dueAt', 'completed')) then return false; end if;
        return true;
    elsif p_source_type = 'screen_time' then
        if p_observation_type <> 'usage_window' then return false; end if;
        keys := jsonb_object_keys(p_value);
        if exists (select 1 from unnest(keys) k where k not in ('category', 'durationMinutes', 'windowStart', 'windowEnd')) then return false; end if;
        return true;
    elsif p_source_type = 'calls' then
        if p_observation_type <> 'call_metadata' then return false; end if;
        keys := jsonb_object_keys(p_value);
        if exists (select 1 from unnest(keys) k where k not in ('direction', 'durationMinutes')) then return false; end if;
        if p_value->>'direction' not in ('incoming', 'outgoing') then return false; end if;
        return true;
    end if;
    return false;
end;
$$;

-- Observation upsert with dedup by (source_type, source_event_id). Only rows
-- for sources the user currently has connected can land.
create or replace function public.upsert_observation(
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
begin
    if p_user_id is null or p_user_id <> (select auth.uid()) then
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
    return jsonb_build_object('status', 'created', 'observation_id', observation_id);
end;
$$;

revoke all on function public.upsert_observation(uuid, text, text, text, timestamptz, jsonb, numeric, jsonb) from public;
grant execute on function public.upsert_observation(uuid, text, text, text, timestamptz, jsonb, numeric, jsonb) to authenticated;

-- Context bundle: the ONLY channel through which MirrorCore sees observations.
-- Restricts to the source types the user currently has connected and a window
-- around the anchor time. Returns coarse values only.
create or replace function public.get_context_bundle(
    p_user_id uuid,
    p_anchor timestamptz default null,
    p_window_hours numeric default 6,
    p_limit integer default 12
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
          and o.observed_at between anchor - (p_window_hours || ' hours')::interval and anchor
        order by o.observed_at desc
        limit least(greatest(p_limit, 1), 30)
    ) recent;

    return jsonb_build_object('connectedSources', to_jsonb(connected), 'observations', bundle);
end;
$$;

revoke all on function public.get_context_bundle(uuid, timestamptz, numeric, integer) from public;
grant execute on function public.get_context_bundle(uuid, timestamptz, numeric, integer) to authenticated, service_role;

-- Notification delivery infrastructure (OneSignal is the only delivery provider).
-- The delivery layer is downstream of Aks intelligence: it only consumes
-- already-persisted insights/experiments/check-ins/weeks and the existing
-- user_preferences state. It never redefines what is worth notifying about.

create table public.notification_deliveries (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    category text not null check (category in ('insights', 'experiments', 'checkIns', 'weekly')),
    source_type text not null,
    source_id uuid,
    event_key text not null,
    status text not null default 'candidate'
        check (status in ('candidate', 'scheduled', 'sending', 'sent', 'opened', 'failed', 'cancelled', 'skipped', 'expired')),
    onesignal_message_id text,
    scheduled_for timestamptz,
    send_after timestamptz,
    expires_at timestamptz,
    sent_at timestamptz,
    opened_at timestamptz,
    failure_reason text,
    attempt_count smallint not null default 0,
    payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- The event key is the stable identity: insight:<id>, experiment:<id>:ending,
-- checkin:<user>:<date>, weekly:<user>:<week>. Retries and duplicate events
-- collapse onto the same row instead of sending twice.
create unique index notification_deliveries_event_key_idx
    on public.notification_deliveries (event_key);

create index notification_deliveries_user_created_idx
    on public.notification_deliveries (user_id, created_at desc);

create index notification_deliveries_due_idx
    on public.notification_deliveries (status, scheduled_for)
    where status = 'scheduled';

create index notification_deliveries_failed_idx
    on public.notification_deliveries (status, updated_at)
    where status = 'failed';

alter table public.notification_deliveries enable row level security;

create policy "Users can read their notification deliveries" on public.notification_deliveries
    for select to authenticated using ((select auth.uid()) = user_id);

-- All writes happen through service-role Edge Functions; clients never insert
-- or update delivery rows directly, so they cannot fabricate delivery state.

-- Scheduling timezone per user (Aks uses the device-reported IANA zone).
alter table public.user_preferences add column if not exists timezone text;

-- ---------------------------------------------------------------------------
-- Quiet hours. p_local_minute is minutes since local midnight in the user's
-- scheduling timezone; p_start/p_end are the same unit, so ranges may cross
-- midnight (22:00 -> 07:00).
-- ---------------------------------------------------------------------------

create or replace function public.is_within_quiet_hours(
    p_enabled boolean,
    p_local_minute integer,
    p_start integer,
    p_end integer
)
returns boolean
language plpgsql
immutable
as $$
begin
    if not p_enabled then return false; end if;
    if p_start is null or p_end is null then return false; end if;
    if p_start = p_end then return true; end if;
    if p_start < p_end then
        return p_local_minute >= p_start and p_local_minute < p_end;
    end if;
    return p_local_minute >= p_start or p_local_minute < p_end;
end;
$$;

-- Local minutes since midnight for a UTC instant in an IANA zone.
create or replace function public.local_minute_of(p_now timestamptz, p_timezone text)
returns integer
language sql
stable
as $$
    select mod((extract(epoch from p_now at time zone coalesce(nullif(trim(p_timezone), ''), 'UTC')) / 60)::int, 1440);
$$;

-- ---------------------------------------------------------------------------
-- Eligibility gate used before ANY send (immediate or scheduled):
-- preferences -> category -> dedup -> claim. Source-state re-checks (stale
-- suppression) live in the dispatcher because they depend on the source table.
-- Only the OneSignal sender Edge Function (service role) may call this.
-- ---------------------------------------------------------------------------

create or replace function public.claim_notification_delivery(
    p_user_id uuid,
    p_category text,
    p_source_type text,
    p_source_id uuid,
    p_event_key text,
    p_title text,
    p_body text,
    p_route text,
    p_scheduled_for timestamptz default null,
    p_expires_at timestamptz default null,
    p_timezone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    prefs public.user_preferences;
    delivery_id uuid;
    existing_status text;
    now_utc timestamptz := now();
    normalized_tz text := nullif(trim(coalesce(p_timezone, '')), '');
begin
    if p_user_id is null or p_user_id <> (select auth.uid()) then
        raise exception 'NOTIFICATION_UNAUTHORIZED';
    end if;
    if p_category not in ('insights', 'experiments', 'checkIns', 'weekly') then
        raise exception 'NOTIFICATION_INVALID_CATEGORY';
    end if;
    if nullif(trim(coalesce(p_title, '')), '') is null or char_length(p_title) > 160
        or nullif(trim(coalesce(p_body, '')), '') is null or char_length(p_body) > 300 then
        raise exception 'NOTIFICATION_INVALID_CONTENT';
    end if;
    if p_event_key is null or char_length(p_event_key) not between 3 and 200 then
        raise exception 'NOTIFICATION_INVALID_EVENT_KEY';
    end if;
    if normalized_tz is null or char_length(normalized_tz) > 64 then
        normalized_tz := 'UTC';
    end if;

    select * into prefs from public.user_preferences where user_id = p_user_id;
    if not coalesce(prefs.notifications_enabled, false) then
        return jsonb_build_object('status', 'skipped', 'reason', 'globally_disabled');
    end if;
    if not coalesce(prefs.notification_categories ->> p_category, 'false')::boolean then
        return jsonb_build_object('status', 'skipped', 'reason', 'category_disabled');
    end if;

    perform pg_advisory_xact_lock(hashtextextended(p_event_key, 0));

    select id, status into delivery_id, existing_status
    from public.notification_deliveries
    where event_key = p_event_key;

    if delivery_id is not null then
        if existing_status in ('sent', 'opened', 'sending') then
            return jsonb_build_object('status', 'deduplicated', 'delivery_id', delivery_id);
        end if;
        if existing_status = 'scheduled' and p_scheduled_for is not null then
            update public.notification_deliveries
            set scheduled_for = p_scheduled_for, expires_at = p_expires_at, updated_at = now_utc
            where id = delivery_id;
            return jsonb_build_object('status', 'rescheduled', 'delivery_id', delivery_id);
        end if;
        update public.notification_deliveries
        set status = 'candidate', failure_reason = null, updated_at = now_utc
        where id = delivery_id;
        return jsonb_build_object('status', 'retry', 'delivery_id', delivery_id);
    end if;

    update public.user_preferences
    set timezone = normalized_tz
    where user_id = p_user_id and (timezone is null or timezone <> normalized_tz);

    insert into public.notification_deliveries (
        user_id, category, source_type, source_id, event_key, status,
        scheduled_for, send_after, expires_at, payload
    ) values (
        p_user_id, p_category, p_source_type, p_source_id, p_event_key,
        case when p_scheduled_for is not null then 'scheduled' else 'candidate' end,
        p_scheduled_for, p_scheduled_for, p_expires_at,
        jsonb_build_object('title', p_title, 'body', p_body, 'route', p_route)
    )
    returning id into delivery_id;

    return jsonb_build_object('status', 'claimed', 'delivery_id', delivery_id);
end;
$$;

revoke all on function public.claim_notification_delivery(uuid, text, text, uuid, text, text, text, text, timestamptz, timestamptz, text) from public;
grant execute on function public.claim_notification_delivery(uuid, text, text, uuid, text, text, text, text, timestamptz, timestamptz, text) to service_role;

-- Client-side timezone sync (device-reported IANA zone, used for scheduling).
create or replace function public.touch_notification_timezone(p_timezone text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
    uid uuid := (select auth.uid());
    normalized text := nullif(trim(coalesce(p_timezone, '')), '');
begin
    if uid is null then raise exception 'Authentication required'; end if;
    if normalized is null or char_length(normalized) > 64 then
        normalized := 'UTC';
    end if;
    update public.user_preferences set timezone = normalized where user_id = uid;
    return normalized;
end;
$$;

revoke all on function public.touch_notification_timezone(text) from public;
grant execute on function public.touch_notification_timezone(text) to authenticated;

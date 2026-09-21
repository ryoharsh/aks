-- Notification cron dispatcher fix (vault-backed, header-independent).
--
-- Supersedes the dispatcher created in 20260920110000_notification_cron.sql,
-- which read app.settings.edge_function_url / service_role_key (never SET
-- anywhere) and fell back to request.header.host (null inside pg_cron),
-- producing invalid URLs such as https:///functions/v1/... and null keys.
--
-- This migration replaces private.invoke_edge_function with a version that:
--   1. reads the base URL + service key from Supabase Vault (server-side
--      only, never baked into clients or migration source),
--   2. validates the URL shape BEFORE dispatch (no more https:/// URLs),
--   3. skips the tick with a warning when secrets are missing instead of
--      firing an unauthenticated request.
--
-- REQUIRED DEPLOYMENT (run once per project, after applying migrations):
--   supabase db execute --project-ref <ref> --sql \
--     "select vault.create_secret('https://<project-ref>.supabase.co/functions/v1', 'edge_function_base_url');"
--   supabase db execute --project-ref <ref> --sql \
--     "select vault.create_secret('<service-role-key>', 'edge_function_service_key');"
-- Or create the same two named secrets from the Dashboard SQL editor.
-- The 5-minute / hourly schedules below are unchanged in behavior.
--
-- Idempotent: safe to re-apply (create or replace + guarded reschedule).

create extension if not exists "supabase_vault";

create or replace function private.invoke_edge_function(p_function text, p_body jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    base_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'edge_function_base_url' limit 1);
    service_key text := (select decrypted_secret from vault.decrypted_secrets where name = 'edge_function_service_key' limit 1);
    fn_url text;
begin
    -- Validate before dispatch: never fire at an invalid URL or without auth.
    if base_url is null or base_url !~ '^https://[a-z0-9-]+(\.[a-z0-9-]+)+/functions/v1/?$' then
        raise warning 'aks cron: vault secret edge_function_base_url missing or invalid; skipping %', p_function;
        return;
    end if;
    if service_key is null or service_key = '' then
        raise warning 'aks cron: vault secret edge_function_service_key missing; skipping %', p_function;
        return;
    end if;
    fn_url := regexp_replace(base_url, '/+$', '') || '/' || p_function;
    perform net.http_post(
        url := fn_url,
        headers := jsonb_build_object('apikey', service_key, 'Authorization', 'Bearer ' || service_key, 'Content-Type', 'application/json'),
        body := p_body
    );
end;
$$;

revoke all on function private.invoke_edge_function(text, jsonb) from public;
grant execute on function private.invoke_edge_function(text, jsonb) to service_role;

-- Re-attach the existing schedules to the fixed dispatcher. Guarded so a
-- fresh database (jobs never created, e.g. old migration skipped) and
-- re-application both work.
do $$
begin
    if exists (select 1 from cron.job where jobname = 'aks-notification-dispatch') then
        perform cron.unschedule('aks-notification-dispatch');
    end if;
    if exists (select 1 from cron.job where jobname = 'aks-notification-schedule') then
        perform cron.unschedule('aks-notification-schedule');
    end if;
    if exists (select 1 from cron.job where jobname = 'aks-provider-sync') then
        perform cron.unschedule('aks-provider-sync');
    end if;
end;
$$;

-- Dispatch due notifications every 5 minutes (unchanged behavior).
select cron.schedule(
    'aks-notification-dispatch',
    '*/5 * * * *',
    $$select private.invoke_edge_function('notification-dispatch', '{}'::jsonb);$$
);

-- Refresh per-user check-in/weekly schedules hourly (unchanged behavior).
select cron.schedule(
    'aks-notification-schedule',
    '15 * * * *',
    $$select private.invoke_edge_function('notifications-schedule', '{}'::jsonb);$$
);

-- Provider-sync dispatcher every 10 minutes (unchanged behavior, now routed
-- through the validated dispatcher).
select cron.schedule(
    'aks-provider-sync',
    '*/10 * * * *',
    $$select private.invoke_edge_function('provider-sync', '{}'::jsonb);$$
);

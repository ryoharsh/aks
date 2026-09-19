-- Server-side scheduling: pg_cron drives notification dispatch and per-user
-- scheduling jobs through pg_net. Runs even when every client app is closed.
-- Requires the pg_cron and pg_net extensions (enable in the Supabase dashboard
-- or via `create extension if not exists ...`).

create extension if not exists pg_cron;
create extension if not exists pg_net;

create schema if not exists private;

create or replace function private.invoke_edge_function(p_function text, p_body jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    fn_url text := current_setting('app.settings.edge_function_url', true);
    service_key text := current_setting('app.settings.service_role_key', true);
begin
    if fn_url is null or service_key is null then
        fn_url := 'https://' || split_part(current_setting('request.header.host', true), ':', 1) || '/functions/v1';
    end if;
    perform net.http_post(
        url := fn_url || '/' || p_function,
        headers := jsonb_build_object('apikey', service_key, 'Authorization', 'Bearer ' || service_key, 'Content-Type', 'application/json'),
        body := p_body
    );
end;
$$;

revoke all on function private.invoke_edge_function(text, jsonb) from public;
grant execute on function private.invoke_edge_function(text, jsonb) to service_role;

-- Dispatch due notifications every 5 minutes.
select cron.schedule(
    'aks-notification-dispatch',
    '*/5 * * * *',
    $$select private.invoke_edge_function('notification-dispatch', '{}'::jsonb);$$
);

-- Refresh per-user check-in/weekly schedules hourly (idempotent by event key).
select cron.schedule(
    'aks-notification-schedule',
    '15 * * * *',
    $$select private.invoke_edge_function('notifications-schedule', '{}'::jsonb);$$
);

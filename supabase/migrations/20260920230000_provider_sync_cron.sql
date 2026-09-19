-- Provider sync cron + token access. Complements the pipeline migration:
-- schedules the provider-sync dispatcher through pg_cron/pg_net and adds the
-- vault-backed token accessor used by the dispatcher (server-side only).

-- 1. Vault-backed token accessor (service-role only) --------------------------
-- Tokens are stored in the Supabase Vault (encrypted); the dispatcher resolves
-- them at sync time. The client and AI never see provider credentials.

create or replace function public.get_provider_access_token(p_token_ref text)
returns text
language sql
security definer
set search_path = ''
as $$
    select decrypted_secret from vault.decrypted_secrets
    where (name = p_token_ref or id::text = p_token_ref)
    limit 1;
$$;

revoke all on function public.get_provider_access_token(text) from public;
grant execute on function public.get_provider_access_token(text) to service_role;

-- 2. Requeue loop: failed jobs with available_at in the past become claimable
--    again automatically (claim_provider_sync_jobs already filters by
--    available_at), so no extra function is needed for retries.

-- 3. Cron schedule for the dispatcher ------------------------------------------
select cron.schedule(
    'aks-provider-sync',
    '*/10 * * * *',
    $$select private.invoke_edge_function('provider-sync', '{}'::jsonb);$$
);

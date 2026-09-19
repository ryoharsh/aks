-- Expanded Personal Context source registry.
-- Adds the provider taxonomy (productivity/work/device/health/personal/restricted/delivery)
-- and an OAuth account-link table for external providers. No existing rows are
-- changed; the old check constraint is replaced with the widened one.

alter table public.user_data_sources
    drop constraint user_data_sources_source_type_check;

alter table public.user_data_sources
    add constraint user_data_sources_source_type_check
    check (source_type in (
        'location', 'calendar', 'google_calendar', 'apple_calendar',
        'reminders', 'google_tasks', 'apple_reminders', 'notion', 'todoist',
        'github', 'slack', 'email', 'screen_time', 'app_activity',
        'contacts', 'calls', 'messages', 'notifications_source', 'photos',
        'health', 'voice_session', 'onesignal'
    ));

-- External provider account links (one per user per source). Tokens live
-- server-side (vault or secrets); the client only ever sees link state.
create table if not exists public.user_source_accounts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    source_type text not null,
    provider_account_label text not null default '' check (char_length(provider_account_label) <= 120),
    status text not null default 'connected' check (status in ('connected', 'error', 'revoked')),
    token_ref text not null default '' check (char_length(token_ref) <= 200),
    last_synced_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, source_type)
);

alter table public.user_source_accounts enable row level security;

create policy "Users can read their source accounts" on public.user_source_accounts
    for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can delete their source accounts" on public.user_source_accounts
    for delete to authenticated using ((select auth.uid()) = user_id);
-- Insert/update only through the service-role OAuth callback, never the client.

-- Registry rows for the new source ids are created lazily on first connect
-- (the same pattern as the original sources), so no data migration is needed.

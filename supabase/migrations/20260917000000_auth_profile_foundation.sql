create table if not exists public.user_preferences (
    user_id uuid primary key references auth.users(id) on delete cascade,
    appearance text not null default 'system' check (appearance in ('system', 'light', 'dark')),
    what_exploring text[] not null default '{}',
    what_to_notice text[] not null default '{}',
    updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

create policy "Users can read their preferences"
on public.user_preferences for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their preferences"
on public.user_preferences for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their preferences"
on public.user_preferences for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create table if not exists public.legal_acceptances (
    user_id uuid not null references auth.users(id) on delete cascade,
    terms_version text not null,
    privacy_version text not null,
    accepted_at timestamptz not null default now(),
    primary key (user_id, terms_version, privacy_version)
);

alter table public.legal_acceptances enable row level security;

create policy "Users can read their legal acceptances"
on public.legal_acceptances for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.accept_current_legal()
returns void
language sql
security definer
set search_path = ''
as $$
    insert into public.legal_acceptances (
        user_id,
        terms_version,
        privacy_version,
        accepted_at
    )
    values (
        (select auth.uid()),
        '2026-09-17',
        '2026-09-17',
        now()
    )
    on conflict (user_id, terms_version, privacy_version) do nothing;
$$;

revoke all on function public.accept_current_legal() from public;
grant execute on function public.accept_current_legal() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'avatars',
    'avatars',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can upload their avatar"
on storage.objects for insert
to authenticated
with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can read their avatar object"
on storage.objects for select
to authenticated
using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can update their avatar"
on storage.objects for update
to authenticated
using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can delete their avatar"
on storage.objects for delete
to authenticated
using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
);

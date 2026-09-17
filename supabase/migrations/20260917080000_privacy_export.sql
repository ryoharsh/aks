create table if not exists public.data_sources (
    user_id uuid primary key references auth.users(id) on delete cascade,
    source_type text not null,
    name text not null,
    enabled boolean not null default true,
    metadata jsonb not null default '{}'::jsonb,
    connected_at timestamptz not null default now(),
    disconnected_at timestamptz
);

alter table public.data_sources enable row level security;

create policy "Users can read their data sources"
on public.data_sources for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their data sources"
on public.data_sources for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their data sources"
on public.data_sources for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their data sources"
on public.data_sources for delete
to authenticated
using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'exports',
    'exports',
    false,
    104857600,
    array['application/json']
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can read their export objects"
on storage.objects for select
to authenticated
using (
    bucket_id = 'exports'
    and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can delete their export objects"
on storage.objects for delete
to authenticated
using (
    bucket_id = 'exports'
    and (storage.foldername(name))[1] = (select auth.uid())::text
);
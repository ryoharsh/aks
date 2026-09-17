create table if not exists public.subscriptions (
    user_id uuid primary key references auth.users(id) on delete cascade,
    revenuecat_customer_id text not null,
    entitlement text not null,
    product_id text,
    status text not null,
    expires_at timestamptz,
    updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "Users can read their subscription record"
on public.subscriptions for select
to authenticated
using ((select auth.uid()) = user_id);

comment on table public.subscriptions is
    'Read-only server-side mirror of the user''s RevenueCat subscription. Written only by the '
    'revenuecat-webhook edge function; the client app never writes to this table.';

comment on column public.subscriptions.status is
    'active, cancelled, expired, or billing_issue';
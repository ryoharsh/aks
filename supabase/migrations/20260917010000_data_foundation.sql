create type public.message_role as enum ('user', 'assistant', 'system');
create type public.signal_source_type as enum ('conversation', 'reflection', 'check_in', 'experiment');

create table public.conversations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    title text not null default 'New conversation' check (char_length(trim(title)) between 1 and 200),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    archived_at timestamptz
);

create table public.messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    role public.message_role not null,
    content text not null check (char_length(trim(content)) between 1 and 12000),
    client_request_id text check (client_request_id is null or char_length(client_request_id) between 1 and 100),
    reply_to_message_id uuid references public.messages(id) on delete cascade,
    metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
    created_at timestamptz not null default now()
);

create table public.reflections (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    content text not null check (char_length(trim(content)) > 0),
    metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
    created_at timestamptz not null default now()
);

create table public.check_ins (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    mood text,
    energy numeric,
    focus numeric,
    stress numeric,
    notes text,
    metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
    created_at timestamptz not null default now(),
    check (mood is null or char_length(trim(mood)) > 0),
    check (energy is null or energy between 0 and 1),
    check (focus is null or focus between 0 and 1),
    check (stress is null or stress between 0 and 1)
);

create table public.signals (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    source_type public.signal_source_type not null,
    source_id uuid not null,
    source_message_id uuid references public.messages(id) on delete cascade,
    signal_type text not null check (char_length(trim(signal_type)) > 0),
    value jsonb not null check (jsonb_typeof(value) = 'object' and octet_length(value::text) <= 2048),
    confidence numeric check (confidence is null or confidence between 0 and 1),
    observed_at timestamptz not null,
    created_at timestamptz not null default now(),
    unique (source_message_id, signal_type)
);

create table public.ai_runs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    user_message_id uuid not null references public.messages(id) on delete cascade,
    task text not null,
    status text not null default 'started' check (status in ('started', 'succeeded', 'failed')),
    provider text,
    model text,
    latency_ms integer check (latency_ms is null or latency_ms >= 0),
    input_tokens integer check (input_tokens is null or input_tokens >= 0),
    output_tokens integer check (output_tokens is null or output_tokens >= 0),
    error_code text,
    created_at timestamptz not null default now(),
    attempted_at timestamptz not null default now(),
    attempt_count integer not null default 1 check (attempt_count between 1 and 5),
    completed_at timestamptz,
    check (task in ('conversation_response', 'signal_extraction')),
    unique (user_message_id, task)
);

create table public.ai_run_attempts (
    id bigint generated always as identity primary key,
    run_id uuid not null references public.ai_runs(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    task text not null,
    attempted_at timestamptz not null default now()
);

create index conversations_user_updated_idx on public.conversations (user_id, updated_at desc);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at, id);
alter table public.messages add constraint messages_user_request_unique unique (user_id, client_request_id);
create unique index messages_assistant_reply_unique_idx on public.messages (reply_to_message_id) where reply_to_message_id is not null;
create index reflections_user_created_idx on public.reflections (user_id, created_at desc);
create index check_ins_user_created_idx on public.check_ins (user_id, created_at desc);
create index signals_user_type_observed_idx on public.signals (user_id, signal_type, observed_at desc);
create index signals_source_idx on public.signals (source_type, source_id);
create index ai_runs_user_created_idx on public.ai_runs (user_id, created_at desc);
create index ai_run_attempts_user_attempted_idx on public.ai_run_attempts (user_id, attempted_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger conversations_set_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

create or replace function public.set_message_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    conversation_owner uuid;
    reply_conversation_id uuid;
    reply_owner uuid;
    reply_role public.message_role;
begin
    select user_id into conversation_owner
    from public.conversations
    where id = new.conversation_id;

    if conversation_owner is null then
        raise exception 'Conversation does not exist';
    end if;

    new.user_id = conversation_owner;

    if new.role = 'assistant' and new.reply_to_message_id is null then
        raise exception 'Assistant messages require a source user message';
    end if;
    if new.role <> 'assistant' and new.reply_to_message_id is not null then
        raise exception 'Only assistant messages may reference a source message';
    end if;
    if new.reply_to_message_id is not null then
        select conversation_id, user_id, role
        into reply_conversation_id, reply_owner, reply_role
        from public.messages
        where id = new.reply_to_message_id;
        if reply_conversation_id is distinct from new.conversation_id
            or reply_owner is distinct from conversation_owner
            or reply_role <> 'user' then
            raise exception 'Invalid assistant source message';
        end if;
    end if;
    return new;
end;
$$;

create trigger messages_set_owner
before insert or update of conversation_id, user_id, reply_to_message_id on public.messages
for each row execute function public.set_message_owner();

create or replace function public.touch_conversation_from_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.conversations set updated_at = now() where id = new.conversation_id;
    return new;
end;
$$;

create trigger messages_touch_conversation
after insert on public.messages
for each row execute function public.touch_conversation_from_message();

create or replace function public.validate_signal_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    source_owner uuid;
    message_owner uuid;
    message_conversation_id uuid;
begin
    case new.source_type
        when 'conversation' then
            select user_id into source_owner from public.conversations where id = new.source_id for key share;
        when 'reflection' then
            select user_id into source_owner from public.reflections where id = new.source_id for key share;
        when 'check_in' then
            select user_id into source_owner from public.check_ins where id = new.source_id for key share;
        when 'experiment' then
            raise exception 'Experiment signals are not supported yet';
    end case;

    if source_owner is null then
        raise exception 'Signal source does not exist';
    end if;

    if new.source_type = 'conversation' then
        if new.source_message_id is null then
            raise exception 'Conversation signals require a source message';
        end if;
        select user_id, conversation_id into message_owner, message_conversation_id
        from public.messages where id = new.source_message_id for key share;
        if message_owner is distinct from source_owner or message_conversation_id is distinct from new.source_id then
            raise exception 'Signal source message does not match conversation';
        end if;
    elsif new.source_message_id is not null then
        raise exception 'Only conversation signals may reference a message';
    end if;

    new.user_id = source_owner;
    return new;
end;
$$;

create trigger signals_validate_source
before insert or update of user_id, source_type, source_id, source_message_id on public.signals
for each row execute function public.validate_signal_source();

create or replace function public.delete_source_signals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    delete from public.signals
    where source_type = tg_argv[0]::public.signal_source_type
      and source_id = old.id;
    return old;
end;
$$;

create trigger conversations_delete_signals
before delete on public.conversations
for each row execute function public.delete_source_signals('conversation');
create trigger reflections_delete_signals
before delete on public.reflections
for each row execute function public.delete_source_signals('reflection');
create trigger check_ins_delete_signals
before delete on public.check_ins
for each row execute function public.delete_source_signals('check_in');

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.reflections enable row level security;
alter table public.check_ins enable row level security;
alter table public.signals enable row level security;
alter table public.ai_runs enable row level security;
alter table public.ai_run_attempts enable row level security;

create policy "Users can read their conversations" on public.conversations
for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create their conversations" on public.conversations
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their conversations" on public.conversations
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Users can read messages in their conversations" on public.messages
for select to authenticated using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = (select auth.uid()))
);
create policy "Users can create messages in their conversations" on public.messages
for insert to authenticated with check (
    (select auth.uid()) = user_id
    and role = 'user'
    and exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = (select auth.uid()) and c.archived_at is null)
);
create policy "Users can read their reflections" on public.reflections
for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create their reflections" on public.reflections
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their reflections" on public.reflections
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their reflections" on public.reflections
for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users can read their check-ins" on public.check_ins
for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create their check-ins" on public.check_ins
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their check-ins" on public.check_ins
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their check-ins" on public.check_ins
for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users can read their signals" on public.signals
for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.claim_ai_run(
    run_user_id uuid,
    run_conversation_id uuid,
    run_user_message_id uuid,
    run_task text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    new_run_id uuid;
    existing_status text;
    existing_attempt_count integer;
    existing_attempted_at timestamptz;
begin
    perform pg_advisory_xact_lock(hashtextextended(run_user_id::text, 0));
    if not exists (
        select 1
        from public.messages m
        join public.conversations c on c.id = m.conversation_id
        where m.id = run_user_message_id
          and m.user_id = run_user_id
          and c.id = run_conversation_id
          and c.user_id = run_user_id
    ) then
        raise exception 'INVALID_AI_RUN_SOURCE';
    end if;
    select id, status, attempt_count, attempted_at
    into new_run_id, existing_status, existing_attempt_count, existing_attempted_at
    from public.ai_runs
    where user_message_id = run_user_message_id and task = run_task
    for update;

    if new_run_id is not null then
        if existing_status = 'succeeded' then
            return jsonb_build_object('id', new_run_id, 'status', existing_status);
        end if;
        if existing_status = 'started' and existing_attempted_at > now() - interval '45 seconds' then
            raise exception 'MIRROR_IN_PROGRESS';
        end if;
        if existing_attempt_count >= 5 then raise exception 'MIRROR_ATTEMPTS_EXHAUSTED'; end if;

        if ((select count(*) from public.ai_run_attempts where user_id = run_user_id and attempted_at > now() - interval '1 minute') >= 20)
            or (run_task = 'conversation_response' and (select count(*) from public.ai_run_attempts where user_id = run_user_id and task = 'conversation_response' and attempted_at > now() - interval '1 minute') >= 10) then
            raise exception 'MIRROR_RATE_LIMITED';
        end if;

        update public.ai_runs
        set status = 'started', attempted_at = now(), attempt_count = attempt_count + 1,
            completed_at = null, error_code = null
        where id = new_run_id;
        insert into public.ai_run_attempts (run_id, user_id, task) values (new_run_id, run_user_id, run_task);
        return jsonb_build_object('id', new_run_id, 'status', 'started');
    end if;

    if ((
        select count(*) from public.ai_run_attempts
        where user_id = run_user_id
          and attempted_at > now() - interval '1 minute'
    ) >= 20) or (run_task = 'conversation_response' and (
        select count(*) from public.ai_run_attempts
        where user_id = run_user_id
          and task = 'conversation_response'
          and attempted_at > now() - interval '1 minute'
    ) >= 10) then
        raise exception 'MIRROR_RATE_LIMITED';
    end if;

    insert into public.ai_runs (user_id, conversation_id, user_message_id, task)
    values (run_user_id, run_conversation_id, run_user_message_id, run_task)
    returning id into new_run_id;
    insert into public.ai_run_attempts (run_id, user_id, task) values (new_run_id, run_user_id, run_task);
    return jsonb_build_object('id', new_run_id, 'status', 'started');
end;
$$;

revoke all on function public.claim_ai_run(uuid, uuid, uuid, text) from public;
grant execute on function public.claim_ai_run(uuid, uuid, uuid, text) to service_role;

create or replace function public.create_conversation_with_message(
    target_conversation_id uuid,
    conversation_title text,
    message_content text,
    request_id text,
    message_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
    new_conversation_id uuid;
    new_message_id uuid;
    new_message_created_at timestamptz;
begin
    if auth.uid() is null then raise exception 'Authentication required'; end if;
    if request_id is null or char_length(request_id) not between 1 and 100 then raise exception 'Invalid request id'; end if;

    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || request_id, 0));
    select conversation_id, id, created_at
    into new_conversation_id, new_message_id, new_message_created_at
    from public.messages
    where user_id = auth.uid() and client_request_id = request_id;

    if new_message_id is not null then
        return jsonb_build_object(
            'conversation_id', new_conversation_id,
            'message_id', new_message_id,
            'message_created_at', new_message_created_at
        );
    end if;

    if target_conversation_id is null then
        insert into public.conversations (user_id, title)
        values (auth.uid(), conversation_title)
        returning id into new_conversation_id;
    else
        select id into new_conversation_id
        from public.conversations
        where id = target_conversation_id
          and user_id = auth.uid()
          and archived_at is null
        for update;
        if new_conversation_id is null then raise exception 'Conversation unavailable'; end if;
    end if;

    insert into public.messages (conversation_id, user_id, role, content, client_request_id, metadata)
    values (new_conversation_id, auth.uid(), 'user', message_content, request_id, message_metadata)
    returning id, created_at into new_message_id, new_message_created_at;

    return jsonb_build_object(
        'conversation_id', new_conversation_id,
        'message_id', new_message_id,
        'message_created_at', new_message_created_at
    );
end;
$$;

revoke all on function public.create_conversation_with_message(uuid, text, text, text, jsonb) from public;
grant execute on function public.create_conversation_with_message(uuid, text, text, text, jsonb) to authenticated;

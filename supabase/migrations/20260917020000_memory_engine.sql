create table public.memories (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    memory_type text not null check (memory_type ~ '^[a-z][a-z0-9_]{1,49}$'),
    content text not null check (char_length(trim(content)) between 10 and 500),
    normalized_content text not null check (char_length(trim(normalized_content)) between 5 and 500),
    status text not null default 'candidate' check (status in ('candidate', 'active', 'rejected', 'archived')),
    confidence numeric check (confidence is null or confidence between 0 and 1),
    evidence_count integer not null default 0 check (evidence_count >= 0),
    first_observed_at timestamptz not null default now(),
    last_observed_at timestamptz not null default now(),
    metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 8192),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.memory_evidence (
    id uuid primary key default gen_random_uuid(),
    memory_id uuid not null references public.memories(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    signal_id uuid references public.signals(id) on delete cascade,
    message_id uuid references public.messages(id) on delete cascade,
    reflection_id uuid references public.reflections(id) on delete cascade,
    check_in_id uuid references public.check_ins(id) on delete cascade,
    observed_at timestamptz not null,
    created_at timestamptz not null default now(),
    check (num_nonnulls(signal_id, message_id, reflection_id, check_in_id) = 1)
);

create index memories_user_status_updated_idx on public.memories (user_id, status, updated_at desc, id);
create index memories_user_last_observed_idx on public.memories (user_id, last_observed_at desc, id);
create index memory_evidence_memory_observed_idx on public.memory_evidence (memory_id, observed_at desc, id);
create unique index memory_evidence_signal_unique_idx on public.memory_evidence (memory_id, signal_id) where signal_id is not null;
create unique index memory_evidence_message_unique_idx on public.memory_evidence (memory_id, message_id) where message_id is not null;
create unique index memory_evidence_reflection_unique_idx on public.memory_evidence (memory_id, reflection_id) where reflection_id is not null;
create unique index memory_evidence_check_in_unique_idx on public.memory_evidence (memory_id, check_in_id) where check_in_id is not null;

create trigger memories_set_updated_at
before update on public.memories
for each row execute function public.set_updated_at();

create or replace function public.validate_memory_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    memory_owner uuid;
    evidence_owner uuid;
    evidence_observed_at timestamptz;
begin
    select user_id into memory_owner from public.memories where id = new.memory_id for key share;
    if memory_owner is null then raise exception 'Memory does not exist'; end if;

    if new.signal_id is not null then
        select user_id, observed_at into evidence_owner, evidence_observed_at from public.signals where id = new.signal_id for key share;
    elsif new.message_id is not null then
        select user_id, created_at into evidence_owner, evidence_observed_at from public.messages where id = new.message_id for key share;
    elsif new.reflection_id is not null then
        select user_id, created_at into evidence_owner, evidence_observed_at from public.reflections where id = new.reflection_id for key share;
    elsif new.check_in_id is not null then
        select user_id, created_at into evidence_owner, evidence_observed_at from public.check_ins where id = new.check_in_id for key share;
    end if;

    if evidence_owner is null then raise exception 'Memory evidence does not exist'; end if;
    if evidence_owner is distinct from memory_owner then raise exception 'Memory evidence owner mismatch'; end if;

    new.user_id = memory_owner;
    new.observed_at = evidence_observed_at;
    return new;
end;
$$;

create trigger memory_evidence_validate_source
before insert or update of memory_id, user_id, signal_id, message_id, reflection_id, check_in_id
on public.memory_evidence
for each row execute function public.validate_memory_evidence();

create or replace function public.refresh_memory_evidence_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    target_memory_id uuid;
    linked_count integer;
begin
    target_memory_id := case when tg_op = 'DELETE' then old.memory_id else new.memory_id end;
    select count(*) into linked_count from public.memory_evidence where memory_id = target_memory_id;
    if linked_count = 0 then
        delete from public.memories where id = target_memory_id;
    else
        update public.memories
        set evidence_count = linked_count,
            first_observed_at = (select min(observed_at) from public.memory_evidence where memory_id = target_memory_id),
            last_observed_at = (select max(observed_at) from public.memory_evidence where memory_id = target_memory_id)
        where id = target_memory_id;
    end if;
    if tg_op = 'DELETE' then return old; end if;
    return new;
end;
$$;

create trigger memory_evidence_refresh_stats
after insert or delete on public.memory_evidence
for each row execute function public.refresh_memory_evidence_stats();

create or replace function public.require_memory_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if exists (select 1 from public.memories where id = new.id)
       and not exists (select 1 from public.memory_evidence where memory_id = new.id) then
        raise exception 'Memory requires evidence';
    end if;
    return new;
end;
$$;

create constraint trigger memories_require_evidence
after insert on public.memories
deferrable initially deferred
for each row execute function public.require_memory_evidence();

alter table public.memories enable row level security;
alter table public.memory_evidence enable row level security;

create policy "Users can read their memories" on public.memories
for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users can read their memory evidence" on public.memory_evidence
for select to authenticated using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.memories m where m.id = memory_id and m.user_id = (select auth.uid()))
);

alter table public.ai_runs drop constraint ai_runs_task_check;
alter table public.ai_runs add constraint ai_runs_task_check check (task in ('conversation_response', 'signal_extraction', 'memory_evaluation'));

create or replace function public.apply_memory_evaluation(
    memory_user_id uuid,
    target_memory_id uuid,
    evaluated_memory_type text,
    evaluated_content text,
    evaluated_normalized_content text,
    evaluated_status text,
    evaluated_confidence numeric,
    evaluated_metadata jsonb,
    evidence_signal_ids uuid[],
    evaluation_run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    resolved_memory_id uuid;
    created_memory boolean := false;
    evidence_id uuid;
    valid_evidence_count integer;
    current_status text;
begin
    if memory_user_id is null then raise exception 'Authentication required'; end if;
    if evaluated_status not in ('candidate', 'active', 'rejected') then raise exception 'Invalid memory status'; end if;
    if evaluated_confidence is not null and (evaluated_confidence < 0 or evaluated_confidence > 1) then raise exception 'Invalid confidence'; end if;
    if jsonb_typeof(evaluated_metadata) <> 'object' then raise exception 'Invalid memory metadata'; end if;
    if coalesce(cardinality(evidence_signal_ids), 0) < 1 then raise exception 'Memory requires evidence'; end if;

    select count(distinct id) into valid_evidence_count
    from public.signals
    where id = any(evidence_signal_ids) and user_id = memory_user_id;
    if valid_evidence_count <> cardinality(evidence_signal_ids) then raise exception 'Invalid memory evidence'; end if;

    perform pg_advisory_xact_lock(hashtextextended(memory_user_id::text, 1));

    if exists (
        select 1 from public.ai_runs
        where id = evaluation_run_id
          and user_id = memory_user_id
          and task = 'memory_evaluation'
          and status = 'succeeded'
          and error_code = 'USER_MEMORY_RESET'
    ) then
        raise exception 'MEMORY_EVALUATION_SUPPRESSED';
    end if;

    if target_memory_id is not null then
        select id, status into resolved_memory_id, current_status from public.memories
        where id = target_memory_id and user_id = memory_user_id for update;
        if resolved_memory_id is null then raise exception 'Memory unavailable'; end if;
        if current_status = 'archived' then raise exception 'Memory is archived'; end if;
    else
        select id into resolved_memory_id from public.memories
        where user_id = memory_user_id
          and normalized_content = evaluated_normalized_content
          and status in ('candidate', 'active')
        order by updated_at desc
        limit 1
        for update;
    end if;

    if resolved_memory_id is null then
        insert into public.memories (user_id, memory_type, content, normalized_content, status, confidence, metadata)
        values (memory_user_id, evaluated_memory_type, evaluated_content, evaluated_normalized_content, evaluated_status, evaluated_confidence, evaluated_metadata)
        returning id into resolved_memory_id;
        created_memory := true;
    else
        update public.memories
        set memory_type = evaluated_memory_type,
            content = evaluated_content,
            normalized_content = evaluated_normalized_content,
            status = evaluated_status,
            confidence = evaluated_confidence,
            metadata = metadata || evaluated_metadata
        where id = resolved_memory_id;
    end if;

    foreach evidence_id in array evidence_signal_ids loop
        insert into public.memory_evidence (memory_id, user_id, signal_id, observed_at)
        select resolved_memory_id, memory_user_id, s.id, s.observed_at
        from public.signals s
        where s.id = evidence_id and s.user_id = memory_user_id
          and not exists (
              select 1 from public.memory_evidence me
              where me.memory_id = resolved_memory_id and me.signal_id = s.id
          );
    end loop;

    return jsonb_build_object(
        'action', case when created_memory then 'created' else 'updated' end,
        'memoryId', resolved_memory_id,
        'status', evaluated_status
    );
end;
$$;

create or replace function public.archive_memory(target_memory_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
    if auth.uid() is null then raise exception 'Authentication required'; end if;
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 1));
    update public.memories set status = 'archived'
    where id = target_memory_id and user_id = auth.uid();
    if found then
        update public.ai_runs set status = 'succeeded', error_code = 'USER_MEMORY_RESET', completed_at = now()
        where user_id = auth.uid() and task = 'memory_evaluation' and status <> 'succeeded'
          and (status = 'started' or user_message_id in (
              select coalesce(me.message_id, s.source_message_id)
              from public.memory_evidence me left join public.signals s on s.id = me.signal_id
              where me.memory_id = target_memory_id
          ));
        insert into public.ai_runs (user_id, conversation_id, user_message_id, task, status, error_code, completed_at)
        select m.user_id, m.conversation_id, m.id, 'memory_evaluation', 'succeeded', 'USER_MEMORY_RESET', now()
        from public.messages m where m.user_id = auth.uid() and m.role = 'user'
          and m.id in (
              select coalesce(me.message_id, s.source_message_id)
              from public.memory_evidence me left join public.signals s on s.id = me.signal_id
              where me.memory_id = target_memory_id
          )
        on conflict (user_message_id, task) do nothing;
    end if;
    return found;
end;
$$;

create or replace function public.delete_memory(target_memory_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
    if auth.uid() is null then raise exception 'Authentication required'; end if;
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 1));
    if exists (select 1 from public.memories where id = target_memory_id and user_id = auth.uid()) then
        update public.ai_runs set status = 'succeeded', error_code = 'USER_MEMORY_RESET', completed_at = now()
        where user_id = auth.uid() and task = 'memory_evaluation' and status <> 'succeeded'
          and (status = 'started' or user_message_id in (
              select coalesce(me.message_id, s.source_message_id)
              from public.memory_evidence me left join public.signals s on s.id = me.signal_id
              where me.memory_id = target_memory_id
          ));
        insert into public.ai_runs (user_id, conversation_id, user_message_id, task, status, error_code, completed_at)
        select m.user_id, m.conversation_id, m.id, 'memory_evaluation', 'succeeded', 'USER_MEMORY_RESET', now()
        from public.messages m where m.user_id = auth.uid() and m.role = 'user'
          and m.id in (
              select coalesce(me.message_id, s.source_message_id)
              from public.memory_evidence me left join public.signals s on s.id = me.signal_id
              where me.memory_id = target_memory_id
          )
        on conflict (user_message_id, task) do nothing;
        delete from public.memories where id = target_memory_id and user_id = auth.uid();
        return true;
    end if;
    return false;
end;
$$;

revoke all on function public.apply_memory_evaluation(uuid, uuid, text, text, text, text, numeric, jsonb, uuid[], uuid) from public;
grant execute on function public.apply_memory_evaluation(uuid, uuid, text, text, text, text, numeric, jsonb, uuid[], uuid) to service_role;
revoke all on function public.archive_memory(uuid) from public;
grant execute on function public.archive_memory(uuid) to authenticated;
revoke all on function public.delete_memory(uuid) from public;
grant execute on function public.delete_memory(uuid) to authenticated;

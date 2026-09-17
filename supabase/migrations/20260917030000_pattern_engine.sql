create table public.patterns (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null check (char_length(trim(title)) between 5 and 200),
    description text not null check (char_length(trim(description)) between 10 and 1000),
    canonical_key text not null check (char_length(trim(canonical_key)) between 5 and 1000),
    status text not null default 'candidate' check (status in ('candidate', 'possible', 'testing', 'supported', 'not_supported', 'archived')),
    confidence numeric check (confidence is null or confidence between 0 and 1),
    evidence_count integer not null default 0 check (evidence_count >= 0),
    first_detected_at timestamptz not null default now(),
    last_observed_at timestamptz not null default now(),
    metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 8192),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.pattern_evidence (
    id uuid primary key default gen_random_uuid(),
    pattern_id uuid not null references public.patterns(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    signal_id uuid not null references public.signals(id) on delete cascade,
    relationship text not null default 'supporting' check (relationship in ('supporting', 'contradicting')),
    observed_at timestamptz not null,
    created_at timestamptz not null default now(),
    unique (pattern_id, signal_id)
);

create index patterns_user_status_updated_idx on public.patterns (user_id, status, updated_at desc, id);
create index patterns_user_last_observed_idx on public.patterns (user_id, last_observed_at desc, id);
create index pattern_evidence_pattern_observed_idx on public.pattern_evidence (pattern_id, observed_at desc, id);
create index pattern_evidence_signal_idx on public.pattern_evidence (signal_id);

create trigger patterns_set_updated_at
before update on public.patterns
for each row execute function public.set_updated_at();

create or replace function public.validate_pattern_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    pattern_owner uuid;
    signal_owner uuid;
    signal_observed_at timestamptz;
begin
    select user_id into pattern_owner from public.patterns where id = new.pattern_id for key share;
    select user_id, observed_at into signal_owner, signal_observed_at from public.signals where id = new.signal_id for key share;
    if pattern_owner is null or signal_owner is null then raise exception 'Pattern evidence does not exist'; end if;
    if pattern_owner is distinct from signal_owner then raise exception 'Pattern evidence owner mismatch'; end if;
    new.user_id = pattern_owner;
    new.observed_at = signal_observed_at;
    return new;
end;
$$;

create trigger pattern_evidence_validate_source
before insert or update of pattern_id, user_id, signal_id
on public.pattern_evidence
for each row execute function public.validate_pattern_evidence();

create or replace function public.refresh_pattern_evidence_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    target_pattern_id uuid;
    linked_count integer;
begin
    target_pattern_id := case when tg_op = 'DELETE' then old.pattern_id else new.pattern_id end;
    select count(*) into linked_count from public.pattern_evidence where pattern_id = target_pattern_id;
    if linked_count = 0 then
        delete from public.patterns where id = target_pattern_id;
    else
        update public.patterns
        set evidence_count = linked_count,
            last_observed_at = (select max(observed_at) from public.pattern_evidence where pattern_id = target_pattern_id),
            metadata = jsonb_set(
                jsonb_set(metadata, '{supporting_count}', to_jsonb((select count(*) from public.pattern_evidence where pattern_id = target_pattern_id and relationship = 'supporting'))),
                '{contradicting_count}', to_jsonb((select count(*) from public.pattern_evidence where pattern_id = target_pattern_id and relationship = 'contradicting'))
            )
        where id = target_pattern_id;
    end if;
    if tg_op = 'DELETE' then return old; end if;
    return new;
end;
$$;

create trigger pattern_evidence_refresh_stats
after insert or delete on public.pattern_evidence
for each row execute function public.refresh_pattern_evidence_stats();

create or replace function public.require_pattern_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if exists (select 1 from public.patterns where id = new.id)
       and not exists (select 1 from public.pattern_evidence where pattern_id = new.id) then
        raise exception 'Pattern requires evidence';
    end if;
    return new;
end;
$$;

create constraint trigger patterns_require_evidence
after insert on public.patterns
deferrable initially deferred
for each row execute function public.require_pattern_evidence();

alter table public.patterns enable row level security;
alter table public.pattern_evidence enable row level security;

create policy "Users can read their patterns" on public.patterns
for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can read their pattern evidence" on public.pattern_evidence
for select to authenticated using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.patterns p where p.id = pattern_id and p.user_id = (select auth.uid()))
);

alter table public.ai_runs drop constraint ai_runs_task_check;
alter table public.ai_runs add constraint ai_runs_task_check check (task in ('conversation_response', 'signal_extraction', 'memory_evaluation', 'pattern_analysis'));

create or replace function public.apply_pattern_analysis(
    pattern_user_id uuid,
    target_pattern_id uuid,
    analyzed_title text,
    analyzed_description text,
    analyzed_canonical_key text,
    analyzed_status text,
    analyzed_confidence numeric,
    analyzed_metadata jsonb,
    evidence_signal_ids uuid[],
    evidence_relationship text,
    analysis_run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    resolved_pattern_id uuid;
    created_pattern boolean := false;
    evidence_id uuid;
    valid_evidence_count integer;
    current_status text;
begin
    if pattern_user_id is null then raise exception 'Authentication required'; end if;
    if analyzed_status not in ('candidate', 'possible', 'supported', 'not_supported') then raise exception 'Invalid pattern status'; end if;
    if analyzed_confidence is not null and (analyzed_confidence < 0 or analyzed_confidence > 1) then raise exception 'Invalid confidence'; end if;
    if evidence_relationship not in ('supporting', 'contradicting') then raise exception 'Invalid evidence relationship'; end if;
    if jsonb_typeof(analyzed_metadata) <> 'object' then raise exception 'Invalid pattern metadata'; end if;
    if coalesce(cardinality(evidence_signal_ids), 0) < 3 then raise exception 'Pattern requires evidence'; end if;

    select count(distinct id) into valid_evidence_count
    from public.signals where id = any(evidence_signal_ids) and user_id = pattern_user_id;
    if valid_evidence_count <> cardinality(evidence_signal_ids) then raise exception 'Invalid pattern evidence'; end if;

    perform pg_advisory_xact_lock(hashtextextended(pattern_user_id::text, 2));
    if not exists (
        select 1 from public.ai_runs
        where id = analysis_run_id and user_id = pattern_user_id and task = 'pattern_analysis'
          and status = 'started' and error_code is null
    ) then raise exception 'PATTERN_ANALYSIS_SUPPRESSED'; end if;

    if target_pattern_id is not null then
        select id, status into resolved_pattern_id, current_status from public.patterns
        where id = target_pattern_id and user_id = pattern_user_id for update;
        if resolved_pattern_id is null then raise exception 'Pattern unavailable'; end if;
        if current_status = 'archived' then raise exception 'Pattern is archived'; end if;
    else
        select id into resolved_pattern_id from public.patterns
        where user_id = pattern_user_id and canonical_key = analyzed_canonical_key
          and status in ('candidate', 'possible', 'testing', 'supported', 'not_supported')
        order by updated_at desc limit 1 for update;
    end if;

    if resolved_pattern_id is null then
        insert into public.patterns (user_id, title, description, canonical_key, status, confidence, metadata)
        values (pattern_user_id, analyzed_title, analyzed_description, analyzed_canonical_key, analyzed_status, analyzed_confidence, analyzed_metadata)
        returning id into resolved_pattern_id;
        created_pattern := true;
    else
        update public.patterns
        set title = analyzed_title, description = analyzed_description, canonical_key = analyzed_canonical_key,
            status = analyzed_status, confidence = analyzed_confidence, metadata = metadata || analyzed_metadata
        where id = resolved_pattern_id;
    end if;

    foreach evidence_id in array evidence_signal_ids loop
        insert into public.pattern_evidence (pattern_id, user_id, signal_id, relationship, observed_at)
        select resolved_pattern_id, pattern_user_id, s.id, evidence_relationship, s.observed_at
        from public.signals s
        where s.id = evidence_id and s.user_id = pattern_user_id
          and not exists (select 1 from public.pattern_evidence pe where pe.pattern_id = resolved_pattern_id and pe.signal_id = s.id);
    end loop;

    return jsonb_build_object('action', case when created_pattern then 'created' else 'updated' end, 'patternId', resolved_pattern_id, 'status', analyzed_status);
end;
$$;

create or replace function public.archive_pattern(target_pattern_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
    if auth.uid() is null then raise exception 'Authentication required'; end if;
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 2));
    update public.patterns set status = 'archived' where id = target_pattern_id and user_id = auth.uid();
    if found then
        update public.ai_runs set status = 'succeeded', error_code = 'USER_PATTERN_RESET', completed_at = now()
        where user_id = auth.uid() and task = 'pattern_analysis' and status <> 'succeeded'
          and (status = 'started' or user_message_id in (
              select s.source_message_id from public.pattern_evidence pe join public.signals s on s.id = pe.signal_id
              where pe.pattern_id = target_pattern_id and s.source_message_id is not null
          ));
        insert into public.ai_runs (user_id, conversation_id, user_message_id, task, status, error_code, completed_at)
        select m.user_id, m.conversation_id, m.id, 'pattern_analysis', 'succeeded', 'USER_PATTERN_RESET', now()
        from public.messages m where m.user_id = auth.uid() and m.role = 'user'
          and m.id in (
              select s.source_message_id from public.pattern_evidence pe join public.signals s on s.id = pe.signal_id
              where pe.pattern_id = target_pattern_id and s.source_message_id is not null
          )
        on conflict (user_message_id, task) do nothing;
    end if;
    return found;
end;
$$;

create or replace function public.delete_pattern(target_pattern_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
    if auth.uid() is null then raise exception 'Authentication required'; end if;
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 2));
    if exists (select 1 from public.patterns where id = target_pattern_id and user_id = auth.uid()) then
        update public.ai_runs set status = 'succeeded', error_code = 'USER_PATTERN_RESET', completed_at = now()
        where user_id = auth.uid() and task = 'pattern_analysis' and status <> 'succeeded'
          and (status = 'started' or user_message_id in (
              select s.source_message_id from public.pattern_evidence pe join public.signals s on s.id = pe.signal_id
              where pe.pattern_id = target_pattern_id and s.source_message_id is not null
          ));
        insert into public.ai_runs (user_id, conversation_id, user_message_id, task, status, error_code, completed_at)
        select m.user_id, m.conversation_id, m.id, 'pattern_analysis', 'succeeded', 'USER_PATTERN_RESET', now()
        from public.messages m where m.user_id = auth.uid() and m.role = 'user'
          and m.id in (
              select s.source_message_id from public.pattern_evidence pe join public.signals s on s.id = pe.signal_id
              where pe.pattern_id = target_pattern_id and s.source_message_id is not null
          )
        on conflict (user_message_id, task) do nothing;
        delete from public.patterns where id = target_pattern_id and user_id = auth.uid();
        return true;
    end if;
    return false;
end;
$$;

revoke all on function public.apply_pattern_analysis(uuid, uuid, text, text, text, text, numeric, jsonb, uuid[], text, uuid) from public;
grant execute on function public.apply_pattern_analysis(uuid, uuid, text, text, text, text, numeric, jsonb, uuid[], text, uuid) to service_role;
revoke all on function public.archive_pattern(uuid) from public;
grant execute on function public.archive_pattern(uuid) to authenticated;
revoke all on function public.delete_pattern(uuid) from public;
grant execute on function public.delete_pattern(uuid) to authenticated;

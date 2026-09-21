-- ---------------------------------------------------------------------------
-- Regeneration of an already-answered Mirror turn ("Try again")
-- ---------------------------------------------------------------------------
-- Regeneration must reuse the same user turn, replace its single assistant
-- reply in place, and stay bounded. `claim_ai_run` cannot express this: it
-- returns the existing succeeded run without a fresh attempt, and the unique
-- (user_message_id, task) constraint means the same run row has to be reused.
-- This function therefore re-arms that run under the same attempt cap and rate
-- limits as a first generation, and refuses to regenerate a turn that has no
-- assistant reply (nothing to replace) or an unanswered one.

create or replace function public.regenerate_ai_run(
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
    run_id uuid;
    run_status text;
    run_attempts integer;
    run_attempted_at timestamptz;
begin
    if run_task <> 'conversation_response' then
        raise exception 'INVALID_AI_RUN_TASK';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(run_user_id::text, 0));

    if not exists (
        select 1
        from public.messages m
        join public.conversations c on c.id = m.conversation_id
        where m.id = run_user_message_id
          and m.user_id = run_user_id
          and m.role = 'user'
          and c.id = run_conversation_id
          and c.user_id = run_user_id
          and c.archived_at is null
    ) then
        raise exception 'INVALID_AI_RUN_SOURCE';
    end if;

    -- Regeneration only replaces an existing reply; it never creates a second
    -- assistant version for the same turn.
    if not exists (
        select 1 from public.messages a
        where a.reply_to_message_id = run_user_message_id
          and a.role = 'assistant'
          and a.user_id = run_user_id
    ) then
        raise exception 'NOTHING_TO_REGENERATE';
    end if;

    select id, status, attempt_count, attempted_at
    into run_id, run_status, run_attempts, run_attempted_at
    from public.ai_runs
    where user_message_id = run_user_message_id and task = run_task
    for update;

    if run_id is not null then
        if run_status = 'started' and run_attempted_at > now() - interval '45 seconds' then
            raise exception 'MIRROR_IN_PROGRESS';
        end if;
        if run_attempts >= 5 then raise exception 'MIRROR_ATTEMPTS_EXHAUSTED'; end if;
        if (select count(*) from public.ai_run_attempts where user_id = run_user_id and attempted_at > now() - interval '1 minute') >= 20
            or (select count(*) from public.ai_run_attempts where user_id = run_user_id and task = run_task and attempted_at > now() - interval '1 minute') >= 10 then
            raise exception 'MIRROR_RATE_LIMITED';
        end if;

        update public.ai_runs
        set status = 'started', attempted_at = now(), attempt_count = attempt_count + 1,
            completed_at = null, error_code = null
        where id = run_id;
        insert into public.ai_run_attempts (run_id, user_id, task) values (run_id, run_user_id, run_task);
        return jsonb_build_object('id', run_id, 'status', 'started');
    end if;

    -- The reply exists but its run does not (for example legacy rows): start a
    -- fresh, still bounded run rather than regenerating without bookkeeping.
    if (select count(*) from public.ai_run_attempts where user_id = run_user_id and attempted_at > now() - interval '1 minute') >= 20
        or (select count(*) from public.ai_run_attempts where user_id = run_user_id and task = run_task and attempted_at > now() - interval '1 minute') >= 10 then
        raise exception 'MIRROR_RATE_LIMITED';
    end if;

    insert into public.ai_runs (user_id, conversation_id, user_message_id, task)
    values (run_user_id, run_conversation_id, run_user_message_id, run_task)
    returning id into run_id;
    insert into public.ai_run_attempts (run_id, user_id, task) values (run_id, run_user_id, run_task);
    return jsonb_build_object('id', run_id, 'status', 'started');
end;
$$;

revoke all on function public.regenerate_ai_run(uuid, uuid, uuid, text) from public;
grant execute on function public.regenerate_ai_run(uuid, uuid, uuid, text) to service_role;

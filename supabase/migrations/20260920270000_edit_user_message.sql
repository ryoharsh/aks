-- ---------------------------------------------------------------------------
-- Edit an unsent-but-saved user message (spec 9.6)
-- ---------------------------------------------------------------------------
-- Editing is deliberately limited to the newest user turn that Aks has not
-- answered yet. That turn has no assistant reply and no derived observations,
-- so correcting it cannot mutate history the user has already seen and cannot
-- leave signals, evidence or patterns pointing at text they never wrote. Any
-- other turn is refused instead of silently branching or rewriting history.

create or replace function public.edit_user_message(
    target_message_id uuid,
    new_content text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := (select auth.uid());
    trimmed text := btrim(new_content);
    opening text;
    stored public.messages;
begin
    if current_user_id is null then
        raise exception 'NOT_AUTHENTICATED';
    end if;
    if trimmed is null or trimmed = '' then
        raise exception 'INVALID_MESSAGE_CONTENT';
    end if;
    if char_length(trimmed) > 12000 then
        raise exception 'MESSAGE_TOO_LARGE';
    end if;

    select m.* into stored
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where m.id = target_message_id
      and m.user_id = current_user_id
      and m.role = 'user'
      and c.user_id = current_user_id
      and c.archived_at is null
    for update of m;

    if stored.id is null then
        raise exception 'MESSAGE_UNAVAILABLE';
    end if;
    if exists (select 1 from public.messages a where a.reply_to_message_id = target_message_id) then
        raise exception 'MESSAGE_ALREADY_ANSWERED';
    end if;
    if exists (select 1 from public.signals s where s.source_message_id = target_message_id) then
        raise exception 'MESSAGE_ALREADY_OBSERVED';
    end if;
    if exists (
        select 1 from public.messages later
        where later.conversation_id = stored.conversation_id
          and (later.created_at > stored.created_at or (later.created_at = stored.created_at and later.id > stored.id))
    ) then
        raise exception 'MESSAGE_NOT_LATEST';
    end if;

    update public.messages set content = trimmed where id = target_message_id returning * into stored;

    -- The conversation title is derived from the opening message; keep it in
    -- step when that opening message is the one being corrected.
    if not exists (
        select 1 from public.messages earlier
        where earlier.conversation_id = stored.conversation_id
          and (earlier.created_at < stored.created_at or (earlier.created_at = stored.created_at and earlier.id < stored.id))
    ) then
        opening := split_part(replace(trimmed, E'\r\n', E'\n'), E'\n', 1);
        if char_length(trim(opening)) < 1 then
            opening := left(trimmed, 72);
        end if;
        update public.conversations
        set title = case when char_length(opening) > 72 then left(opening, 69) || '...' else opening end
        where id = stored.conversation_id
          and user_id = current_user_id
          and char_length(trim(opening)) between 1 and 200;
    end if;

    return jsonb_build_object(
        'id', stored.id,
        'conversation_id', stored.conversation_id,
        'content', stored.content,
        'created_at', stored.created_at,
        'metadata', stored.metadata
    );
end;
$$;

revoke all on function public.edit_user_message(uuid, text) from public;
grant execute on function public.edit_user_message(uuid, text) to authenticated;

-- Conversation search (spec 9.3 / 72.3): search must cover the conversation
-- title AND message content, stay user-scoped, and be paginated server-side so
-- the client never downloads the whole conversation history to filter locally.
--
-- RLS still applies (security invoker); the explicit user_id filters are a
-- belt-and-braces ownership check, not the security boundary.

create or replace function public.search_conversations(
    search_query text,
    page_offset integer default 0,
    page_size integer default 20
)
returns jsonb
language sql
stable
set search_path = ''
as $function$
    with pattern as (
        select replace(
            replace(
                replace(trim(coalesce(search_query, '')), '\', '\\'),
                '%', '\%'
            ),
            '_', '\_'
        ) as value
    ),
    matched as (
        select c.id, c.title, c.created_at, c.updated_at, c.archived_at
        from public.conversations c
        cross join pattern p
        where auth.uid() is not null
          and p.value <> ''
          and c.user_id = auth.uid()
          and c.archived_at is null
          and (
              c.title ilike '%' || p.value || '%'
              or exists (
                  select 1
                  from public.messages m
                  where m.conversation_id = c.id
                    and m.user_id = auth.uid()
                    and m.content ilike '%' || p.value || '%'
              )
          )
    )
    select jsonb_build_object(
        'items', coalesce((
            select jsonb_agg(row_to_json(page) order by page.updated_at desc, page.id desc)
            from (
                select * from matched
                order by updated_at desc, id desc
                offset greatest(coalesce(page_offset, 0), 0)
                limit least(greatest(coalesce(page_size, 20), 1), 100)
            ) page
        ), '[]'::jsonb),
        'total', (select count(*) from matched),
        'has_more', (select count(*) from matched)
            > greatest(coalesce(page_offset, 0), 0) + least(greatest(coalesce(page_size, 20), 1), 100)
    );
$function$;

revoke all on function public.search_conversations(text, integer, integer) from public;
grant execute on function public.search_conversations(text, integer, integer) to authenticated;

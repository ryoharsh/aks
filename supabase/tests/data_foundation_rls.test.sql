begin;

create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email)
values
    ('00000000-0000-0000-0000-00000000000a', 'user-a@example.com'),
    ('00000000-0000-0000-0000-00000000000b', 'user-b@example.com'),
    ('00000000-0000-0000-0000-00000000000c', 'user-c@example.com');

insert into public.conversations (id, user_id, title)
values
    ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'User A conversation'),
    ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'User B conversation');

insert into public.messages (id, conversation_id, user_id, role, content)
values
    ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'user', 'User A source message'),
    ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'user', 'User B source message');
insert into public.messages (conversation_id, user_id, role, content, reply_to_message_id)
values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'assistant', 'Trusted assistant message', '20000000-0000-0000-0000-00000000000a');
insert into public.reflections (user_id, content)
values ('00000000-0000-0000-0000-00000000000b', 'User B reflection');
insert into public.check_ins (user_id, mood)
values ('00000000-0000-0000-0000-00000000000b', 'private');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);
select results_eq(
    $$ select (select count(*) from public.conversations) + (select count(*) from public.reflections) + (select count(*) from public.check_ins) $$,
    $$ values (0::bigint) $$,
    'A user with no records receives empty counts'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);

select results_eq(
    $$ select count(*) from public.conversations $$,
    $$ values (1::bigint) $$,
    'User A only sees their conversation'
);

select lives_ok(
    $$ select public.create_conversation_with_message(null, 'Created safely', 'First message', 'test-request-1', '{}'::jsonb) $$,
    'Conversation and first message are created transactionally'
);
select lives_ok(
    $$ select public.create_conversation_with_message(null, 'Duplicate retry', 'First message', 'test-request-1', '{}'::jsonb) $$,
    'Retrying the same request is safe'
);
select results_eq(
    $$ select count(*) from public.messages where client_request_id = 'test-request-1' $$,
    $$ values (1::bigint) $$,
    'A retried request does not duplicate the user message'
);

select lives_ok(
    $$ insert into public.messages (conversation_id, role, content) values ('10000000-0000-0000-0000-00000000000a', 'user', 'A message') $$,
    'User A can create a message in their conversation'
);

select throws_ok(
    $$ insert into public.messages (conversation_id, role, content) values ('10000000-0000-0000-0000-00000000000b', 'user', 'Cross-account message') $$,
    '42501',
    null,
    'User A cannot create a message in User B conversation'
);

select lives_ok(
    $$ update public.messages set content = 'Changed' where role = 'assistant' $$,
    'Updating an assistant message is safely ignored'
);
select results_eq(
    $$ select content from public.messages where role = 'assistant' $$,
    $$ values ('Trusted assistant message'::text) $$,
    'Client cannot rewrite an assistant message'
);

select lives_ok($$ insert into public.reflections (content) values ('A reflection') $$, 'User A can create a reflection');
select lives_ok($$ insert into public.check_ins (mood, energy) values ('okay', 0.6) $$, 'User A can create a check-in');

select throws_ok(
    $$ insert into public.signals (source_type, source_id, source_message_id, signal_type, value, observed_at) values ('conversation', '10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'focus_difficulty', '{"present":true}'::jsonb, now()) $$,
    '42501',
    null,
    'Clients cannot create derived signals directly'
);

reset role;
insert into public.signals (user_id, source_type, source_id, source_message_id, signal_type, value, observed_at)
values ('00000000-0000-0000-0000-00000000000b', 'conversation', '10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'focus_difficulty', '{"present":true}'::jsonb, now());
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
select results_eq($$ select count(*) from public.signals where user_id = '00000000-0000-0000-0000-00000000000a' $$, $$ values (1::bigint) $$, 'Signal ownership is derived from its source');

select results_eq($$ select count(*) from public.messages $$, $$ values (4::bigint) $$, 'Message reads are isolated');
select results_eq($$ select count(*) from public.reflections $$, $$ values (1::bigint) $$, 'Reflection count respects ownership');
select results_eq($$ select count(*) from public.check_ins $$, $$ values (1::bigint) $$, 'Check-in count respects ownership');

select lives_ok(
    $$ update public.conversations set archived_at = now() where id = '10000000-0000-0000-0000-00000000000a' $$,
    'User A can archive their conversation'
);

select results_eq(
    $$ select count(*) from public.conversations where archived_at is not null $$,
    $$ values (1::bigint) $$,
    'Archived conversation remains stored'
);

select * from finish();
rollback;

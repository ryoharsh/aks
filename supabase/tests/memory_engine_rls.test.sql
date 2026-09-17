begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email)
values
    ('00000000-0000-0000-0000-00000000001a', 'memory-a@example.com'),
    ('00000000-0000-0000-0000-00000000001b', 'memory-b@example.com');

insert into public.conversations (id, user_id, title)
values
    ('10000000-0000-0000-0000-00000000001a', '00000000-0000-0000-0000-00000000001a', 'Memory A'),
    ('10000000-0000-0000-0000-00000000001b', '00000000-0000-0000-0000-00000000001b', 'Memory B');
insert into public.messages (id, conversation_id, user_id, role, content)
values
    ('20000000-0000-0000-0000-00000000001a', '10000000-0000-0000-0000-00000000001a', '00000000-0000-0000-0000-00000000001a', 'user', 'I focus better in quiet rooms.'),
    ('20000000-0000-0000-0000-00000000001b', '10000000-0000-0000-0000-00000000001b', '00000000-0000-0000-0000-00000000001b', 'user', 'Private user B message.');
insert into public.signals (id, user_id, source_type, source_id, source_message_id, signal_type, value, observed_at)
values
    ('30000000-0000-4000-8000-00000000001a', '00000000-0000-0000-0000-00000000001a', 'conversation', '10000000-0000-0000-0000-00000000001a', '20000000-0000-0000-0000-00000000001a', 'focus_difficulty', '{"present":true}'::jsonb, now()),
    ('30000000-0000-4000-8000-00000000001b', '00000000-0000-0000-0000-00000000001b', 'conversation', '10000000-0000-0000-0000-00000000001b', '20000000-0000-0000-0000-00000000001b', 'focus_difficulty', '{"present":true}'::jsonb, now());
insert into public.memories (id, user_id, memory_type, content, normalized_content, status, confidence)
values
    ('40000000-0000-4000-8000-00000000001a', '00000000-0000-0000-0000-00000000001a', 'preference', 'You may focus better in quieter environments.', 'you may focus better in quieter environments', 'active', 0.7),
    ('40000000-0000-4000-8000-00000000002a', '00000000-0000-0000-0000-00000000001a', 'routine', 'You may prefer a consistent morning routine.', 'you may prefer a consistent morning routine', 'active', 0.7),
    ('40000000-0000-4000-8000-00000000001b', '00000000-0000-0000-0000-00000000001b', 'preference', 'User B private memory.', 'user b private memory', 'active', 0.7);
insert into public.memory_evidence (memory_id, user_id, signal_id, observed_at)
values
    ('40000000-0000-4000-8000-00000000001a', '00000000-0000-0000-0000-00000000001b', '30000000-0000-4000-8000-00000000001a', now()),
    ('40000000-0000-4000-8000-00000000002a', '00000000-0000-0000-0000-00000000001a', '30000000-0000-4000-8000-00000000001a', now()),
    ('40000000-0000-4000-8000-00000000001b', '00000000-0000-0000-0000-00000000001b', '30000000-0000-4000-8000-00000000001b', now());

select results_eq($$ select evidence_count from public.memories where id = '40000000-0000-4000-8000-00000000001a' $$, $$ values (1) $$, 'Evidence count is derived from linked rows');
select results_eq($$ select user_id from public.memory_evidence where memory_id = '40000000-0000-4000-8000-00000000001a' $$, $$ values ('00000000-0000-0000-0000-00000000001a'::uuid) $$, 'Evidence ownership is derived from its source');
select throws_ok($$ insert into public.memory_evidence (memory_id, user_id, signal_id, observed_at) values ('40000000-0000-4000-8000-00000000001a', '00000000-0000-0000-0000-00000000001a', '30000000-0000-4000-8000-00000000001b', now()) $$, 'P0001', 'Memory evidence owner mismatch', 'Cross-user evidence is rejected');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000001a', true);
select results_eq($$ select count(*) from public.memories $$, $$ values (2::bigint) $$, 'User A sees only their memories');
select results_eq($$ select count(*) from public.memory_evidence $$, $$ values (2::bigint) $$, 'User A sees only their evidence');
select throws_ok($$ insert into public.memories (user_id, memory_type, content, normalized_content) values ('00000000-0000-0000-0000-00000000001a', 'preference', 'Client-created memory is forbidden.', 'client created memory is forbidden') $$, '42501', null, 'Clients cannot create memories directly');
select results_eq($$ select public.archive_memory('40000000-0000-4000-8000-00000000001a') $$, $$ values (true) $$, 'A user can archive their own memory');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000001b', true);
select results_eq($$ select public.archive_memory('40000000-0000-4000-8000-00000000002a') $$, $$ values (false) $$, 'A user cannot archive another user memory');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000001a', true);
select results_eq($$ select public.delete_memory('40000000-0000-4000-8000-00000000002a') $$, $$ values (true) $$, 'A user can delete their own derived memory');
select results_eq($$ select count(*) from public.messages where id = '20000000-0000-0000-0000-00000000001a' $$, $$ values (1::bigint) $$, 'Deleting memory preserves its source message');

select * from finish();
rollback;

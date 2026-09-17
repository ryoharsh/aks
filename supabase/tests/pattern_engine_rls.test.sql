begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email)
values
    ('00000000-0000-0000-0000-00000000002a', 'pattern-a@example.com'),
    ('00000000-0000-0000-0000-00000000002b', 'pattern-b@example.com');
insert into public.conversations (id, user_id, title)
values
    ('10000000-0000-0000-0000-00000000002a', '00000000-0000-0000-0000-00000000002a', 'Pattern A'),
    ('10000000-0000-0000-0000-00000000002b', '00000000-0000-0000-0000-00000000002b', 'Pattern B');
insert into public.messages (id, conversation_id, user_id, role, content)
values
    ('20000000-0000-0000-0000-00000000002a', '10000000-0000-0000-0000-00000000002a', '00000000-0000-0000-0000-00000000002a', 'user', 'Starting was difficult today.'),
    ('20000000-0000-0000-0000-00000000002b', '10000000-0000-0000-0000-00000000002b', '00000000-0000-0000-0000-00000000002b', 'user', 'Private pattern source.');
insert into public.signals (id, user_id, source_type, source_id, source_message_id, signal_type, value, observed_at)
values
    ('30000000-0000-4000-8000-00000000002a', '00000000-0000-0000-0000-00000000002a', 'conversation', '10000000-0000-0000-0000-00000000002a', '20000000-0000-0000-0000-00000000002a', 'difficulty_starting', '{"present":true}'::jsonb, now()),
    ('30000000-0000-4000-8000-00000000002b', '00000000-0000-0000-0000-00000000002b', 'conversation', '10000000-0000-0000-0000-00000000002b', '20000000-0000-0000-0000-00000000002b', 'difficulty_starting', '{"present":true}'::jsonb, now());
insert into public.patterns (id, user_id, title, description, canonical_key, status, confidence)
values
    ('40000000-0000-4000-8000-00000000002a', '00000000-0000-0000-0000-00000000002a', 'Difficulty starting appears repeatedly', 'This observation may be useful to keep watching.', 'recurrence|difficulty_starting:true', 'candidate', 0.6),
    ('40000000-0000-4000-8000-00000000003a', '00000000-0000-0000-0000-00000000002a', 'Focus and energy may appear together', 'These observations may appear together.', 'association|energy:lower|focus:lower', 'possible', 0.7),
    ('40000000-0000-4000-8000-00000000002b', '00000000-0000-0000-0000-00000000002b', 'Private user B pattern', 'This possible relationship belongs to user B.', 'recurrence|private', 'candidate', 0.6);
insert into public.pattern_evidence (pattern_id, user_id, signal_id, relationship, observed_at)
values
    ('40000000-0000-4000-8000-00000000002a', '00000000-0000-0000-0000-00000000002b', '30000000-0000-4000-8000-00000000002a', 'supporting', now()),
    ('40000000-0000-4000-8000-00000000003a', '00000000-0000-0000-0000-00000000002a', '30000000-0000-4000-8000-00000000002a', 'supporting', now()),
    ('40000000-0000-4000-8000-00000000002b', '00000000-0000-0000-0000-00000000002b', '30000000-0000-4000-8000-00000000002b', 'supporting', now());

select results_eq($$ select evidence_count from public.patterns where id = '40000000-0000-4000-8000-00000000002a' $$, $$ values (1) $$, 'Pattern evidence count is derived');
select results_eq($$ select user_id from public.pattern_evidence where pattern_id = '40000000-0000-4000-8000-00000000002a' $$, $$ values ('00000000-0000-0000-0000-00000000002a'::uuid) $$, 'Pattern evidence ownership is derived');
select throws_ok($$ insert into public.pattern_evidence (pattern_id, user_id, signal_id, relationship, observed_at) values ('40000000-0000-4000-8000-00000000002a', '00000000-0000-0000-0000-00000000002a', '30000000-0000-4000-8000-00000000002b', 'supporting', now()) $$, 'P0001', 'Pattern evidence owner mismatch', 'Cross-user pattern evidence is rejected');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000002a', true);
select results_eq($$ select count(*) from public.patterns $$, $$ values (2::bigint) $$, 'User A sees only their patterns');
select results_eq($$ select count(*) from public.pattern_evidence $$, $$ values (2::bigint) $$, 'User A sees only their pattern evidence');
select throws_ok($$ insert into public.patterns (user_id, title, description, canonical_key) values ('00000000-0000-0000-0000-00000000002a', 'Client pattern', 'A client-created possible pattern.', 'recurrence|client') $$, '42501', null, 'Clients cannot create patterns directly');
select results_eq($$ select public.archive_pattern('40000000-0000-4000-8000-00000000002a') $$, $$ values (true) $$, 'A user can archive their own pattern');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000002b', true);
select results_eq($$ select public.archive_pattern('40000000-0000-4000-8000-00000000003a') $$, $$ values (false) $$, 'A user cannot archive another user pattern');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000002a', true);
select results_eq($$ select public.delete_pattern('40000000-0000-4000-8000-00000000003a') $$, $$ values (true) $$, 'A user can delete their own derived pattern');
select results_eq($$ select count(*) from public.signals where id = '30000000-0000-4000-8000-00000000002a' $$, $$ values (1::bigint) $$, 'Deleting a pattern preserves its source signal');

select * from finish();
rollback;

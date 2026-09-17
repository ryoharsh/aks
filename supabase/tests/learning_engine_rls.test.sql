begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email)
values
    ('00000000-0000-0000-0000-00000000005a', 'learning-a@example.com'),
    ('00000000-0000-0000-0000-00000000005b', 'learning-b@example.com');
insert into public.conversations (id, user_id, title)
values
    ('10000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-00000000005a', 'Learning A'),
    ('10000000-0000-0000-0000-00000000005b', '00000000-0000-0000-0000-00000000005b', 'Learning B');
insert into public.messages (id, conversation_id, user_id, role, content)
values
    ('20000000-0000-0000-0000-00000000005a', '10000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-00000000005a', 'user', 'Starting was difficult.'),
    ('20000000-0000-0000-0000-00000000005b', '10000000-0000-0000-0000-00000000005b', '00000000-0000-0000-0000-00000000005b', 'user', 'Private source.');
insert into public.signals (id, user_id, source_type, source_id, source_message_id, signal_type, value, observed_at)
values
    ('30000000-0000-4000-8000-00000000005a', '00000000-0000-0000-0000-00000000005a', 'conversation', '10000000-0000-0000-0000-00000000005a', '20000000-0000-0000-0000-00000000005a', 'difficulty_starting', '{"present":true}'::jsonb, now()),
    ('30000000-0000-4000-8000-00000000005b', '00000000-0000-0000-0000-00000000005b', 'conversation', '10000000-0000-0000-0000-00000000005b', '20000000-0000-0000-0000-00000000005b', 'difficulty_starting', '{"present":true}'::jsonb, now());
insert into public.patterns (id, user_id, title, description, canonical_key, status, confidence)
values
    ('40000000-0000-4000-8000-00000000005a', '00000000-0000-0000-0000-00000000005a', 'Starting difficulty repeats', 'This possible relationship may be worth testing.', 'recurrence|difficulty:true', 'possible', 0.65),
    ('40000000-0000-4000-8000-00000000005b', '00000000-0000-0000-0000-00000000005b', 'Private pattern', 'This possible relationship belongs to user B.', 'recurrence|private', 'possible', 0.65);
insert into public.pattern_evidence (pattern_id, user_id, signal_id, observed_at)
values
    ('40000000-0000-4000-8000-00000000005a', '00000000-0000-0000-0000-00000000005a', '30000000-0000-4000-8000-00000000005a', now()),
    ('40000000-0000-4000-8000-00000000005b', '00000000-0000-0000-0000-00000000005b', '30000000-0000-4000-8000-00000000005b', now());
insert into public.experiments (id, user_id, pattern_id, title, hypothesis, description, status, start_date, end_date, result, result_summary, completed_at, metadata)
values
    ('50000000-0000-4000-8000-00000000005a', '00000000-0000-0000-0000-00000000005a', '40000000-0000-4000-8000-00000000005a', 'Small first step', 'A smaller step may make starting easier.', 'Try a smaller step and record the result.', 'completed', current_date - 5, current_date, 'supports', 'Easier was recorded in most observations.', now(), '{}'::jsonb),
    ('50000000-0000-4000-8000-00000000005b', '00000000-0000-0000-0000-00000000005b', '40000000-0000-4000-8000-00000000005b', 'Private experiment', 'A small change may affect the result.', 'Record the explicit result after each try.', 'completed', current_date - 5, current_date, 'mixed', 'The observations were mixed.', now(), '{}'::jsonb);
update public.experiments set status = 'active' where id in ('50000000-0000-4000-8000-00000000005a', '50000000-0000-4000-8000-00000000005b');
insert into public.experiment_observations (experiment_id, user_id, value, notes, client_request_id)
values
    ('50000000-0000-4000-8000-00000000005a', '00000000-0000-0000-0000-00000000005a', '{"result":"easier"}', null, 'learning-a-1'),
    ('50000000-0000-4000-8000-00000000005a', '00000000-0000-0000-0000-00000000005a', '{"result":"easier"}', null, 'learning-a-2'),
    ('50000000-0000-4000-8000-00000000005a', '00000000-0000-0000-0000-00000000005a', '{"result":"same"}', null, 'learning-a-3'),
    ('50000000-0000-4000-8000-00000000005b', '00000000-0000-0000-0000-00000000005b', '{"result":"easier"}', null, 'learning-b-1'),
    ('50000000-0000-4000-8000-00000000005b', '00000000-0000-0000-0000-00000000005b', '{"result":"same"}', null, 'learning-b-2'),
    ('50000000-0000-4000-8000-00000000005b', '00000000-0000-0000-0000-00000000005b', '{"result":"harder"}', null, 'learning-b-3');
update public.experiments set status = 'completed' where id in ('50000000-0000-4000-8000-00000000005a', '50000000-0000-4000-8000-00000000005b');
insert into public.learnings (id, user_id, title, description, canonical_key, confidence, source_experiment_id)
values
    ('60000000-0000-4000-8000-00000000005a', '00000000-0000-0000-0000-00000000005a', 'Smaller starts may help', 'Smaller first steps may make difficult tasks easier to begin.', 'smaller_first_steps', 0.65, '50000000-0000-4000-8000-00000000005a'),
    ('60000000-0000-4000-8000-00000000005b', '00000000-0000-0000-0000-00000000005b', 'Private learning', 'The tested change may have mixed effects for user B.', 'private_learning', 0.55, '50000000-0000-4000-8000-00000000005b');
insert into public.learning_evidence (learning_id, user_id, experiment_id, relationship, observed_at)
values
    ('60000000-0000-4000-8000-00000000005a', '00000000-0000-0000-0000-00000000005b', '50000000-0000-4000-8000-00000000005a', 'supports', now()),
    ('60000000-0000-4000-8000-00000000005b', '00000000-0000-0000-0000-00000000005b', '50000000-0000-4000-8000-00000000005b', 'mixed', now());

select results_eq($$ select evidence_count from public.learnings where id = '60000000-0000-4000-8000-00000000005a' $$, $$ values (3) $$, 'Learning evidence count comes from actual observations');
select results_eq($$ select user_id from public.learning_evidence where learning_id = '60000000-0000-4000-8000-00000000005a' $$, $$ values ('00000000-0000-0000-0000-00000000005a'::uuid) $$, 'Learning evidence ownership is derived');
select throws_ok($$ insert into public.learning_evidence (learning_id, user_id, experiment_id, relationship, observed_at) values ('60000000-0000-4000-8000-00000000005a', '00000000-0000-0000-0000-00000000005a', '50000000-0000-4000-8000-00000000005b', 'mixed', now()) $$, 'P0001', 'Learning evidence owner mismatch', 'Cross-user learning evidence is rejected');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000005a', true);
select results_eq($$ select count(*) from public.learnings $$, $$ values (1::bigint) $$, 'User A sees only their learning');
select results_eq($$ select count(*) from public.learning_evidence $$, $$ values (1::bigint) $$, 'User A sees only their learning evidence');
select throws_ok($$ insert into public.learnings (user_id, title, description, canonical_key) values ('00000000-0000-0000-0000-00000000005a', 'Client learning', 'A client should not create this learning.', 'client_learning') $$, '42501', null, 'Clients cannot create learnings directly');
select results_eq($$ select public.archive_learning('60000000-0000-4000-8000-00000000005a') $$, $$ values (true) $$, 'A user can archive their own learning');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000005b', true);
select results_eq($$ select public.archive_learning('60000000-0000-4000-8000-00000000005a') $$, $$ values (false) $$, 'A user cannot archive another user learning');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000005a', true);
select results_eq($$ select public.delete_learning('60000000-0000-4000-8000-00000000005a') $$, $$ values (true) $$, 'A user can delete their own derived learning');
select results_eq($$ select count(*) from public.experiments where id = '50000000-0000-4000-8000-00000000005a' $$, $$ values (1::bigint) $$, 'Deleting learning preserves its experiment');
select results_eq($$ select count(*) from public.experiment_observations where experiment_id = '50000000-0000-4000-8000-00000000005a' $$, $$ values (3::bigint) $$, 'Deleting learning preserves experiment observations');

reset role;
delete from public.experiments where id = '50000000-0000-4000-8000-00000000005b';
select results_eq($$ select count(*) from public.learnings where id = '60000000-0000-4000-8000-00000000005b' $$, $$ values (0::bigint) $$, 'Deleting the sole source experiment removes its unsupported derived learning');

select * from finish();
rollback;

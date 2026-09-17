begin;

create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email)
values
    ('00000000-0000-0000-0000-00000000004a', 'experiment-a@example.com'),
    ('00000000-0000-0000-0000-00000000004b', 'experiment-b@example.com');
insert into public.conversations (id, user_id, title)
values
    ('10000000-0000-0000-0000-00000000004a', '00000000-0000-0000-0000-00000000004a', 'Experiment A'),
    ('10000000-0000-0000-0000-00000000004b', '00000000-0000-0000-0000-00000000004b', 'Experiment B');
insert into public.messages (id, conversation_id, user_id, role, content)
values
    ('20000000-0000-0000-0000-00000000004a', '10000000-0000-0000-0000-00000000004a', '00000000-0000-0000-0000-00000000004a', 'user', 'Starting was difficult.'),
    ('20000000-0000-0000-0000-00000000004b', '10000000-0000-0000-0000-00000000004b', '00000000-0000-0000-0000-00000000004b', 'user', 'Private source.');
insert into public.signals (id, user_id, source_type, source_id, source_message_id, signal_type, value, observed_at)
values
    ('30000000-0000-4000-8000-00000000004a', '00000000-0000-0000-0000-00000000004a', 'conversation', '10000000-0000-0000-0000-00000000004a', '20000000-0000-0000-0000-00000000004a', 'difficulty_starting', '{"present":true}'::jsonb, now()),
    ('30000000-0000-4000-8000-00000000004b', '00000000-0000-0000-0000-00000000004b', 'conversation', '10000000-0000-0000-0000-00000000004b', '20000000-0000-0000-0000-00000000004b', 'difficulty_starting', '{"present":true}'::jsonb, now());
insert into public.patterns (id, user_id, title, description, canonical_key, status, confidence)
values
    ('40000000-0000-4000-8000-00000000004a', '00000000-0000-0000-0000-00000000004a', 'Starting difficulty repeats', 'This observation may be worth testing.', 'recurrence|difficulty:true', 'possible', 0.65),
    ('40000000-0000-4000-8000-00000000004b', '00000000-0000-0000-0000-00000000004b', 'Private pattern', 'This possible relationship is private.', 'recurrence|private', 'possible', 0.65);
insert into public.pattern_evidence (pattern_id, user_id, signal_id, observed_at)
values
    ('40000000-0000-4000-8000-00000000004a', '00000000-0000-0000-0000-00000000004a', '30000000-0000-4000-8000-00000000004a', now()),
    ('40000000-0000-4000-8000-00000000004b', '00000000-0000-0000-0000-00000000004b', '30000000-0000-4000-8000-00000000004b', now());
insert into public.experiments (id, user_id, pattern_id, title, hypothesis, description, metadata)
values
    ('50000000-0000-4000-8000-00000000004a', '00000000-0000-0000-0000-00000000004a', '40000000-0000-4000-8000-00000000004a', 'Small first step', 'A smaller step may make starting easier.', 'Try a small first step and record how it felt.', '{"duration_days":5}'::jsonb),
    ('50000000-0000-4000-8000-00000000004b', '00000000-0000-0000-0000-00000000004b', '40000000-0000-4000-8000-00000000004b', 'Private experiment', 'A small change may affect the observation.', 'Record the explicit result after each try.', '{"duration_days":5}'::jsonb);

select results_eq($$ select user_id from public.experiments where id = '50000000-0000-4000-8000-00000000004a' $$, $$ values ('00000000-0000-0000-0000-00000000004a'::uuid) $$, 'Experiment ownership is derived from pattern');
select lives_ok($$ select public.start_experiment('00000000-0000-0000-0000-00000000004a', '50000000-0000-4000-8000-00000000004a') $$, 'Draft experiment starts');
select results_eq($$ select status from public.patterns where id = '40000000-0000-4000-8000-00000000004a' $$, $$ values ('testing'::text) $$, 'Starting marks linked pattern as testing');
select lives_ok($$ select public.record_experiment_observation('00000000-0000-0000-0000-00000000004a', '50000000-0000-4000-8000-00000000004a', '{"result":"easier"}'::jsonb, 'Started quickly', 'observation-request-1') $$, 'Active experiment accepts an observation');
select lives_ok($$ select public.record_experiment_observation('00000000-0000-0000-0000-00000000004a', '50000000-0000-4000-8000-00000000004a', '{"result":"easier"}'::jsonb, 'Duplicate retry', 'observation-request-1') $$, 'Observation retry is idempotent');
select results_eq($$ select observation_count from public.experiments where id = '50000000-0000-4000-8000-00000000004a' $$, $$ values (1) $$, 'Observation count is derived');
select results_eq($$ select public.delete_experiment('00000000-0000-0000-0000-00000000004a', '50000000-0000-4000-8000-00000000004a') $$, $$ values (false) $$, 'An active experiment cannot bypass cancellation through deletion');
select throws_ok($$ select public.record_experiment_observation('00000000-0000-0000-0000-00000000004a', '50000000-0000-4000-8000-00000000004b', '{"result":"easier"}'::jsonb, null, 'cross-user-request') $$, 'P0001', 'EXPERIMENT_NOT_ACTIVE', 'A user cannot record against another user experiment');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000004a', true);
select results_eq($$ select count(*) from public.experiments $$, $$ values (1::bigint) $$, 'User A sees only their experiment');
select results_eq($$ select count(*) from public.experiment_observations $$, $$ values (1::bigint) $$, 'User A sees only their observations');
select throws_ok($$ insert into public.experiments (user_id, pattern_id, title, hypothesis, description) values ('00000000-0000-0000-0000-00000000004a', '40000000-0000-4000-8000-00000000004a', 'Client draft', 'A change may affect the result.', 'Client writes should not be allowed.') $$, '42501', null, 'Clients cannot create experiments directly');

reset role;
select lives_ok($$ select public.finish_experiment('00000000-0000-0000-0000-00000000004a', '50000000-0000-4000-8000-00000000004a') $$, 'Active experiment completes');
select lives_ok($$ select public.record_experiment_observation('00000000-0000-0000-0000-00000000004a', '50000000-0000-4000-8000-00000000004a', '{"result":"easier"}'::jsonb, 'Retry after completion', 'observation-request-1') $$, 'Committed observation retry remains idempotent after completion');
select results_eq($$ select status from public.patterns where id = '40000000-0000-4000-8000-00000000004a' $$, $$ values ('possible'::text) $$, 'Completion restores linked pattern status');
delete from public.experiments where id = '50000000-0000-4000-8000-00000000004a';
select results_eq($$ select count(*) from public.experiment_observations where experiment_id = '50000000-0000-4000-8000-00000000004a' $$, $$ values (0::bigint) $$, 'Deleting experiment cascades observations while source pattern remains');
select results_eq($$ select count(*) from public.patterns where id = '40000000-0000-4000-8000-00000000004a' $$, $$ values (1::bigint) $$, 'Deleting experiment preserves its source pattern');

select * from finish();
rollback;

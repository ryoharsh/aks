begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email)
values
    ('00000000-0000-0000-0000-00000000006a', 'insight-a@example.com'),
    ('00000000-0000-0000-0000-00000000006b', 'insight-b@example.com');
insert into public.conversations (id, user_id, title)
values
    ('10000000-0000-0000-0000-00000000006a', '00000000-0000-0000-0000-00000000006a', 'Insight A'),
    ('10000000-0000-0000-0000-00000000006b', '00000000-0000-0000-0000-00000000006b', 'Insight B');
insert into public.messages (id, conversation_id, user_id, role, content)
values
    ('20000000-0000-0000-0000-00000000006a', '10000000-0000-0000-0000-00000000006a', '00000000-0000-0000-0000-00000000006a', 'user', 'Starting was difficult.'),
    ('20000000-0000-0000-0000-00000000006b', '10000000-0000-0000-0000-00000000006b', '00000000-0000-0000-0000-00000000006b', 'user', 'Private source.');
insert into public.signals (id, user_id, source_type, source_id, source_message_id, signal_type, value, observed_at)
values
    ('30000000-0000-4000-8000-00000000006a', '00000000-0000-0000-0000-00000000006a', 'conversation', '10000000-0000-0000-0000-00000000006a', '20000000-0000-0000-0000-00000000006a', 'difficulty_starting', '{"present":true}'::jsonb, now()),
    ('30000000-0000-4000-8000-00000000006b', '00000000-0000-0000-0000-00000000006b', 'conversation', '10000000-0000-0000-0000-00000000006b', '20000000-0000-0000-0000-00000000006b', 'difficulty_starting', '{"present":true}'::jsonb, now());
insert into public.patterns (id, user_id, title, description, canonical_key, status, confidence)
values
    ('40000000-0000-4000-8000-00000000006a', '00000000-0000-0000-0000-00000000006a', 'Starting difficulty repeats', 'This possible relationship may be worth testing.', 'recurrence|difficulty:true', 'possible', 0.65),
    ('40000000-0000-4000-8000-00000000006b', '00000000-0000-0000-0000-00000000006b', 'Private pattern', 'This possible relationship belongs to user B.', 'recurrence|private', 'possible', 0.65);
insert into public.pattern_evidence (pattern_id, user_id, signal_id, observed_at)
values
    ('40000000-0000-4000-8000-00000000006a', '00000000-0000-0000-0000-00000000006a', '30000000-0000-4000-8000-00000000006a', now()),
    ('40000000-0000-4000-8000-00000000006b', '00000000-0000-0000-0000-00000000006b', '30000000-0000-4000-8000-00000000006b', now());
insert into public.experiments (id, user_id, pattern_id, title, hypothesis, description, status, start_date, end_date, result, result_summary, confidence, observation_count, completed_at)
values
    ('50000000-0000-4000-8000-00000000006a', '00000000-0000-0000-0000-00000000006a', '40000000-0000-4000-8000-00000000006a', 'Small first step', 'A smaller step may make starting easier.', 'Try a smaller step and record the result.', 'completed', current_date - 5, current_date, 'supports', 'Easier was recorded in most observations.', 0.65, 5, now()),
    ('50000000-0000-4000-8000-00000000006b', '00000000-0000-0000-0000-00000000006b', '40000000-0000-4000-8000-00000000006b', 'Private experiment', 'A small change may affect the result.', 'Record the explicit result after each try.', 'completed', current_date - 5, current_date, 'mixed', 'The observations were mixed.', 0.55, 3, now());
insert into public.learnings (id, user_id, title, description, canonical_key, confidence, evidence_count, source_experiment_id)
values
    ('60000000-0000-4000-8000-00000000006a', '00000000-0000-0000-0000-00000000006a', 'Smaller starts may help', 'Smaller first steps may make difficult tasks easier to begin.', 'small_starts', 0.65, 5, '50000000-0000-4000-8000-00000000006a'),
    ('60000000-0000-4000-8000-00000000006b', '00000000-0000-0000-0000-00000000006b', 'Private learning', 'The tested change may have mixed effects for user B.', 'private_learning', 0.55, 3, '50000000-0000-4000-8000-00000000006b');
insert into public.learning_evidence (learning_id, user_id, experiment_id, relationship, observed_at)
values
    ('60000000-0000-4000-8000-00000000006a', '00000000-0000-0000-0000-00000000006a', '50000000-0000-4000-8000-00000000006a', 'supports', now()),
    ('60000000-0000-4000-8000-00000000006b', '00000000-0000-0000-0000-00000000006b', '50000000-0000-4000-8000-00000000006b', 'mixed', now());
insert into public.insights (id, user_id, type, title, content, pattern_id, experiment_id, learning_id, confidence)
values
    ('70000000-0000-4000-8000-00000000006a', '00000000-0000-0000-0000-00000000006b', 'learning', 'A useful change stood out', 'Your recent experiment may have made this idea worth noticing.', '40000000-0000-4000-8000-00000000006a', '50000000-0000-4000-8000-00000000006a', '60000000-0000-4000-8000-00000000006a', 0.6),
    ('70000000-0000-4000-8000-00000000006b', '00000000-0000-0000-0000-00000000006b', 'learning', 'Private insight', 'This mixed learning may be worth noticing for user B.', '40000000-0000-4000-8000-00000000006b', '50000000-0000-4000-8000-00000000006b', '60000000-0000-4000-8000-00000000006b', 0.5);

select results_eq($$ select user_id from public.insights where id = '70000000-0000-4000-8000-00000000006a' $$, $$ values ('00000000-0000-0000-0000-00000000006a'::uuid) $$, 'Insight ownership is derived from learning');
select throws_ok($$ insert into public.insights (user_id, type, title, content, pattern_id, experiment_id, learning_id) values ('00000000-0000-0000-0000-00000000006a', 'learning', 'Cross-source insight', 'This should remain unavailable.', '40000000-0000-4000-8000-00000000006b', '50000000-0000-4000-8000-00000000006a', '60000000-0000-4000-8000-00000000006a') $$, 'P0001', 'Insight pattern owner mismatch', 'Cross-user insight sources are rejected');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000006a', true);
select results_eq($$ select count(*) from public.insights $$, $$ values (1::bigint) $$, 'User A sees only their insight');
select results_eq($$ select status from public.insights where id = '70000000-0000-4000-8000-00000000006a' $$, $$ values ('new'::text) $$, 'Reading does not mark an insight seen');
select throws_ok($$ insert into public.insights (user_id, type, title, content, learning_id) values ('00000000-0000-0000-0000-00000000006a', 'learning', 'Client insight', 'A client must not create this insight.', '60000000-0000-4000-8000-00000000006a') $$, '42501', null, 'Clients cannot create insights directly');
select results_eq($$ select public.mark_insight_seen('70000000-0000-4000-8000-00000000006a') $$, $$ values (true) $$, 'Opening insight marks it seen');
select ok((select seen_at is not null from public.insights where id = '70000000-0000-4000-8000-00000000006a'), 'Seen timestamp is recorded');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000006b', true);
select results_eq($$ select public.dismiss_insight('70000000-0000-4000-8000-00000000006a') $$, $$ values (false) $$, 'User B cannot dismiss User A insight');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000006a', true);
select results_eq($$ select public.dismiss_insight('70000000-0000-4000-8000-00000000006a') $$, $$ values (true) $$, 'User A can dismiss their insight');
select results_eq($$ select count(*) from public.learnings where id = '60000000-0000-4000-8000-00000000006a' $$, $$ values (1::bigint) $$, 'Dismissing insight preserves learning');
select results_eq($$ select public.delete_insight('70000000-0000-4000-8000-00000000006a') $$, $$ values (true) $$, 'User A can delete their insight');
select results_eq($$ select count(*) from public.experiments where id = '50000000-0000-4000-8000-00000000006a' $$, $$ values (1::bigint) $$, 'Deleting insight preserves source experiment');

select * from finish();
rollback;

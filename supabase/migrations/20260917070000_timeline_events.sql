create table public.timeline_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    event_type text not null check (event_type in ('reflection', 'check_in', 'conversation', 'pattern', 'experiment', 'learning', 'insight')),
    title text not null check (char_length(trim(title)) between 1 and 200),
    description text check (description is null or char_length(trim(description)) between 1 and 2000),
    reference_id uuid,
    metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 8192),
    created_at timestamptz not null default now()
);

create index timeline_events_user_created_idx on public.timeline_events (user_id, created_at desc, id);
create index timeline_events_user_type_created_idx on public.timeline_events (user_id, event_type, created_at desc, id);
create index timeline_events_user_reference_idx on public.timeline_events (user_id, reference_id) where reference_id is not null;

alter table public.timeline_events enable row level security;
create policy "Users can read their timeline" on public.timeline_events
for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.format_check_in_summary(in_mood text, in_energy numeric, in_focus numeric, in_stress numeric)
returns text
language sql
immutable
set search_path = ''
as $$
select nullif(
    array_to_string(
        array_remove(
            array[
                case when in_mood is not null then 'Mood: ' || in_mood end,
                case when in_energy is not null then 'Energy: ' || round(in_energy * 100)::text || '%' end,
                case when in_focus is not null then 'Focus: ' || round(in_focus * 100)::text || '%' end,
                case when in_stress is not null then 'Stress: ' || round(in_stress * 100)::text || '%' end
            ],
            null
        ),
        ', '
    ),
    ''
);
$$;

create or replace function public.emit_reflection_timeline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.timeline_events (user_id, event_type, title, description, reference_id, created_at)
    values (
        new.user_id,
        'reflection',
        'You wrote a reflection',
        nullif(left(trim(new.content), 160), ''),
        new.id,
        new.created_at
    );
    return new;
end;
$$;

create trigger reflections_emit_timeline
after insert on public.reflections
for each row execute function public.emit_reflection_timeline();

create or replace function public.emit_check_in_timeline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.timeline_events (user_id, event_type, title, description, reference_id, created_at)
    values (
        new.user_id,
        'check_in',
        'You checked in',
        public.format_check_in_summary(new.mood, new.energy, new.focus, new.stress),
        new.id,
        new.created_at
    );
    return new;
end;
$$;

create trigger check_ins_emit_timeline
after insert on public.check_ins
for each row execute function public.emit_check_in_timeline();

create or replace function public.emit_conversation_timeline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.timeline_events (user_id, event_type, title, description, reference_id, created_at)
    values (
        new.user_id,
        'conversation',
        new.title,
        null,
        new.id,
        new.created_at
    );
    return new;
end;
$$;

create trigger conversations_emit_timeline
after insert on public.conversations
for each row execute function public.emit_conversation_timeline();

create or replace function public.emit_pattern_timeline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.timeline_events (user_id, event_type, title, description, reference_id, created_at)
    values (
        new.user_id,
        'pattern',
        new.title,
        nullif(left(trim(new.description), 160), ''),
        new.id,
        new.created_at
    );
    return new;
end;
$$;

create trigger patterns_emit_timeline
after insert on public.patterns
for each row execute function public.emit_pattern_timeline();

create or replace function public.emit_experiment_created_timeline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.timeline_events (user_id, event_type, title, description, reference_id, metadata, created_at)
    values (
        new.user_id,
        'experiment',
        'You set up a new experiment',
        nullif(trim(new.title), ''),
        new.id,
        jsonb_build_object('status', new.status),
        new.created_at
    );
    return new;
end;
$$;

create trigger experiments_emit_timeline_created
after insert on public.experiments
for each row execute function public.emit_experiment_created_timeline();

create or replace function public.emit_experiment_completed_timeline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.status = 'completed' and old.status is distinct from 'completed' then
        insert into public.timeline_events (user_id, event_type, title, description, reference_id, metadata, created_at)
        values (
            new.user_id,
            'experiment',
            'You completed an experiment',
            nullif(substr(trim(concat_ws(' — ', new.title, new.result_summary)), 1, 160), ''),
            new.id,
            jsonb_build_object('status', 'completed', 'result', new.result),
            coalesce(new.completed_at, new.updated_at, now())
        );
    end if;
    return new;
end;
$$;

create trigger experiments_emit_timeline_completed
after update of status on public.experiments
for each row execute function public.emit_experiment_completed_timeline();

create or replace function public.emit_learning_timeline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.timeline_events (user_id, event_type, title, description, reference_id, created_at)
    values (
        new.user_id,
        'learning',
        new.title,
        nullif(left(trim(new.description), 160), ''),
        new.id,
        new.created_at
    );
    return new;
end;
$$;

create trigger learnings_emit_timeline
after insert on public.learnings
for each row execute function public.emit_learning_timeline();

create or replace function public.emit_insight_timeline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.timeline_events (user_id, event_type, title, description, reference_id, created_at)
    values (
        new.user_id,
        'insight',
        new.title,
        nullif(left(trim(new.content), 160), ''),
        new.id,
        new.created_at
    );
    return new;
end;
$$;

create trigger insights_emit_timeline
after insert on public.insights
for each row execute function public.emit_insight_timeline();

create or replace function public.delete_timeline_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    delete from public.timeline_events
    where user_id = old.user_id
      and reference_id = old.id;
    return old;
end;
$$;

create trigger conversations_delete_timeline
before delete on public.conversations
for each row execute function public.delete_timeline_events();
create trigger reflections_delete_timeline
before delete on public.reflections
for each row execute function public.delete_timeline_events();
create trigger check_ins_delete_timeline
before delete on public.check_ins
for each row execute function public.delete_timeline_events();
create trigger patterns_delete_timeline
before delete on public.patterns
for each row execute function public.delete_timeline_events();
create trigger experiments_delete_timeline
before delete on public.experiments
for each row execute function public.delete_timeline_events();
create trigger learnings_delete_timeline
before delete on public.learnings
for each row execute function public.delete_timeline_events();
create trigger insights_delete_timeline
before delete on public.insights
for each row execute function public.delete_timeline_events();

insert into public.timeline_events (user_id, event_type, title, description, reference_id, created_at)
select user_id, 'reflection', 'You wrote a reflection', nullif(left(trim(content), 160), ''), id, created_at
from public.reflections;

insert into public.timeline_events (user_id, event_type, title, description, reference_id, created_at)
select user_id, 'check_in', 'You checked in', public.format_check_in_summary(mood, energy, focus, stress), id, created_at
from public.check_ins;

insert into public.timeline_events (user_id, event_type, title, description, reference_id, created_at)
select user_id, 'pattern', title, nullif(left(trim(description), 160), ''), id, created_at
from public.patterns
where status <> 'archived';

insert into public.timeline_events (user_id, event_type, title, description, reference_id, created_at)
select user_id, 'learning', title, nullif(left(trim(description), 160), ''), id, created_at
from public.learnings
where status <> 'archived';

insert into public.timeline_events (user_id, event_type, title, description, reference_id, created_at)
select user_id, 'insight', title, nullif(left(trim(content), 160), ''), id, created_at
from public.insights
where status <> 'archived';

insert into public.timeline_events (user_id, event_type, title, description, reference_id, metadata, created_at)
select
    user_id,
    'experiment',
    'You completed an experiment',
    nullif(substr(trim(concat_ws(' — ', title, result_summary)), 1, 160), ''),
    id,
    jsonb_build_object('status', 'completed', 'result', result),
    coalesce(completed_at, updated_at, created_at)
from public.experiments
where status = 'completed';
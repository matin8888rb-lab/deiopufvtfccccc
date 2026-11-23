-- Enforce workspace ownership across operational foreign-key relationships.
-- All trigger functions use SECURITY INVOKER (the default) so RLS remains in force.

create or replace function public.council_validate_task_links()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.owner_id is distinct from auth.uid() then
    raise exception 'task owner must match the authenticated user' using errcode = '42501';
  end if;

  if new.project_id is not null and not exists (
    select 1 from public.projects p
    where p.id = new.project_id
      and p.owner_id = new.owner_id
      and p.workspace_id = new.workspace_id
  ) then
    raise exception 'task project must belong to the same workspace' using errcode = '23503';
  end if;

  if new.assignee_member_id is not null and not exists (
    select 1 from public.council_members m
    where m.id = new.assignee_member_id
      and m.owner_id = new.owner_id
      and m.workspace_id = new.workspace_id
  ) then
    raise exception 'task assignee must belong to the same workspace' using errcode = '23503';
  end if;

  return new;
end;
$$;

drop trigger if exists council_tasks_validate_links on public.tasks;
create trigger council_tasks_validate_links
before insert or update on public.tasks
for each row execute function public.council_validate_task_links();

create or replace function public.council_validate_task_dependency()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  task_workspace uuid;
  dependency_workspace uuid;
  has_cycle boolean;
begin
  if new.owner_id is distinct from auth.uid() then
    raise exception 'dependency owner must match the authenticated user' using errcode = '42501';
  end if;

  select t.workspace_id into task_workspace
  from public.tasks t where t.id = new.task_id and t.owner_id = new.owner_id;

  select t.workspace_id into dependency_workspace
  from public.tasks t where t.id = new.depends_on_task_id and t.owner_id = new.owner_id;

  if task_workspace is null or dependency_workspace is null
     or task_workspace is distinct from dependency_workspace then
    raise exception 'both tasks must belong to the same workspace' using errcode = '23503';
  end if;

  with recursive reachable(task_id) as (
    select new.depends_on_task_id
    union
    select td.depends_on_task_id
    from public.task_dependencies td
    join reachable r on td.task_id = r.task_id
    where td.owner_id = new.owner_id
  )
  select exists(select 1 from reachable where task_id = new.task_id)
  into has_cycle;

  if has_cycle then
    raise exception 'task dependency would create a cycle' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists council_task_dependencies_validate on public.task_dependencies;
create trigger council_task_dependencies_validate
before insert on public.task_dependencies
for each row execute function public.council_validate_task_dependency();

create or replace function public.council_validate_meeting_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.owner_id is distinct from auth.uid() then
    raise exception 'meeting owner must match the authenticated user' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists council_meetings_validate_owner on public.meetings;
create trigger council_meetings_validate_owner
before insert or update on public.meetings
for each row execute function public.council_validate_meeting_owner();

create or replace function public.council_validate_meeting_participant()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  meeting_workspace uuid;
  member_workspace uuid;
begin
  if new.owner_id is distinct from auth.uid() then
    raise exception 'participant owner must match the authenticated user' using errcode = '42501';
  end if;

  select m.workspace_id into meeting_workspace
  from public.meetings m where m.id = new.meeting_id and m.owner_id = new.owner_id;

  select cm.workspace_id into member_workspace
  from public.council_members cm where cm.id = new.member_id and cm.owner_id = new.owner_id;

  if meeting_workspace is null or member_workspace is null
     or meeting_workspace is distinct from member_workspace then
    raise exception 'meeting and participant must belong to the same workspace' using errcode = '23503';
  end if;
  return new;
end;
$$;

drop trigger if exists council_meeting_participants_validate on public.meeting_participants;
create trigger council_meeting_participants_validate
before insert or update on public.meeting_participants
for each row execute function public.council_validate_meeting_participant();

create or replace function public.council_validate_decision_links()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.owner_id is distinct from auth.uid() then
    raise exception 'decision owner must match the authenticated user' using errcode = '42501';
  end if;

  if new.meeting_id is not null and not exists (
    select 1 from public.meetings m
    where m.id = new.meeting_id
      and m.owner_id = new.owner_id
      and m.workspace_id = new.workspace_id
  ) then
    raise exception 'decision meeting must belong to the same workspace' using errcode = '23503';
  end if;
  return new;
end;
$$;

drop trigger if exists council_decisions_validate_links on public.decisions;
create trigger council_decisions_validate_links
before insert or update on public.decisions
for each row execute function public.council_validate_decision_links();

create or replace function public.council_validate_decision_evidence()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  decision_workspace uuid;
  member_workspace uuid;
begin
  if new.owner_id is distinct from auth.uid() then
    raise exception 'evidence owner must match the authenticated user' using errcode = '42501';
  end if;

  select d.workspace_id into decision_workspace
  from public.decisions d where d.id = new.decision_id and d.owner_id = new.owner_id;

  if decision_workspace is null then
    raise exception 'evidence decision must belong to the same workspace' using errcode = '23503';
  end if;

  if new.member_id is not null then
    select m.workspace_id into member_workspace
    from public.council_members m where m.id = new.member_id and m.owner_id = new.owner_id;
    if member_workspace is null or member_workspace is distinct from decision_workspace then
      raise exception 'evidence member must belong to the same workspace' using errcode = '23503';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists council_decision_evidence_validate on public.decision_evidence;
create trigger council_decision_evidence_validate
before insert or update on public.decision_evidence
for each row execute function public.council_validate_decision_evidence();

create or replace function public.council_validate_audit_actor()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.owner_id is distinct from auth.uid() then
    raise exception 'audit owner must match the authenticated user' using errcode = '42501';
  end if;

  if new.actor_member_id is not null and not exists (
    select 1 from public.council_members m
    where m.id = new.actor_member_id
      and m.owner_id = new.owner_id
      and m.workspace_id = new.workspace_id
  ) then
    raise exception 'audit actor must belong to the same workspace' using errcode = '23503';
  end if;
  return new;
end;
$$;

drop trigger if exists council_audit_events_validate_actor on public.audit_events;
create trigger council_audit_events_validate_actor
before insert or update on public.audit_events
for each row execute function public.council_validate_audit_actor();

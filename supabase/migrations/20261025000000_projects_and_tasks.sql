-- Projects group chats and tasks. Tasks are the user's own to-dos, optionally
-- inside a project. Both belong to a workspace so a business tier can share
-- them later; for now each user sees only their own.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_user_idx on public.projects (user_id, updated_at desc);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  notes text not null default '' check (char_length(notes) <= 2000),
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_user_idx on public.tasks (user_id, created_at desc);
create index tasks_project_idx on public.tasks (project_id);

alter table public.conversations
  add column project_id uuid references public.projects (id) on delete set null;
create index conversations_project_idx on public.conversations (project_id);

-- The app inserts without a workspace; use the user's default one.
create function public.set_default_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.workspace_id is null then
    select default_workspace_id into new.workspace_id from public.profiles where user_id = new.user_id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger projects_defaults before insert or update on public.projects
  for each row execute function public.set_default_workspace();
create trigger tasks_defaults before insert or update on public.tasks
  for each row execute function public.set_default_workspace();

-- A task or chat can only point at one of the user's own projects.
create function public.owns_project(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_project is null or exists (select 1 from public.projects where id = p_project and user_id = auth.uid());
$$;

alter table public.projects enable row level security;
alter table public.tasks enable row level security;

create policy "users manage own projects" on public.projects
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id));

create policy "users manage own tasks" on public.tasks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id) and public.owns_project(project_id));

-- Renaming a chat now also covers moving it between the user's own projects.
drop policy "users rename own conversations" on public.conversations;
create policy "users update own conversations" on public.conversations
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id) and public.owns_project(project_id));

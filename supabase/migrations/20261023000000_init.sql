-- RACO core schema.
--
-- Tenancy model: every piece of user data belongs to a workspace. Each user
-- gets a personal workspace on sign-up; team workspaces (business tier) reuse
-- the same tables, so adding them later needs no data migration.
--
-- Chats are private to their author even inside a team workspace.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.workspace_kind as enum ('personal', 'team');
create type public.workspace_role as enum ('owner', 'admin', 'member');
create type public.plan as enum ('free', 'pro', 'team');
create type public.response_style as enum ('concise', 'balanced', 'detailed');
create type public.message_role as enum ('user', 'assistant');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  kind public.workspace_kind not null,
  name text not null check (char_length(name) between 1 and 80),
  plan public.plan not null default 'free',
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members (user_id);

-- One personal workspace per user.
create unique index workspaces_one_personal_per_user
  on public.workspaces (created_by) where kind = 'personal';

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  default_workspace_id uuid not null references public.workspaces (id),
  display_name text check (char_length(display_name) <= 60),
  agent_name text not null default 'Raco' check (char_length(agent_name) between 1 and 40),
  interests text[] not null default '{}',
  response_style public.response_style not null default 'balanced',
  notification_prefs jsonb not null default '{}'::jsonb,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New chat' check (char_length(title) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_user_recent_idx
  on public.conversations (user_id, updated_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.message_role not null,
  content text not null,
  model text,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- Per-request model usage, for cost tracking and quotas. Written only by the
-- API (service role); users can read their own rows.
create table public.usage_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  created_at timestamptz not null default now()
);
create index usage_events_user_time_idx on public.usage_events (user_id, created_at desc);
create index usage_events_workspace_time_idx on public.usage_events (workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- security definer so RLS policies can check membership without recursing
-- into workspace_members' own policy.
create function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = (select auth.uid())
  );
$$;

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger conversations_touch before update on public.conversations
  for each row execute function public.touch_updated_at();

-- New auth user -> personal workspace + owner membership + profile.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws_id uuid;
begin
  insert into public.workspaces (kind, name, created_by)
  values ('personal', 'Personal', new.id)
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, new.id, 'owner');

  insert into public.profiles (user_id, default_workspace_id)
  values (new.id, ws_id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.usage_events enable row level security;

create policy "members read their workspaces" on public.workspaces
  for select to authenticated using (public.is_workspace_member(id));

create policy "members read memberships of their workspaces" on public.workspace_members
  for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "users read own profile" on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));

create policy "users update own profile" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and public.is_workspace_member(default_workspace_id)
  );

-- Conversations and messages are created by the API (service role). Users
-- can read, rename and delete their own.
create policy "users read own conversations" on public.conversations
  for select to authenticated
  using (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id));

create policy "users rename own conversations" on public.conversations
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id));

create policy "users delete own conversations" on public.conversations
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "users read own messages" on public.messages
  for select to authenticated using (user_id = (select auth.uid()));

create policy "users read own usage" on public.usage_events
  for select to authenticated using (user_id = (select auth.uid()));

-- Users may only change the profile fields onboarding and settings edit.
revoke update on public.profiles from authenticated;
grant update (display_name, agent_name, interests, response_style, notification_prefs, onboarded_at)
  on public.profiles to authenticated;

revoke update on public.conversations from authenticated;
grant update (title) on public.conversations to authenticated;

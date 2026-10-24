-- Pinned chats show at the top of the sidebar.
alter table public.conversations add column pinned_at timestamptz;

-- Library: replies the user saved. The text is copied so an item outlives
-- its chat; the chat link is cleared if the chat is deleted.
create table public.library_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  content text not null,
  created_at timestamptz not null default now(),
  -- Set by the shared defaults trigger.
  updated_at timestamptz not null default now()
);
create index library_items_user_idx on public.library_items (user_id, created_at desc);

-- Fills workspace_id from the user's default workspace, like projects and tasks.
create trigger library_items_defaults before insert on public.library_items
  for each row execute function public.set_default_workspace();

alter table public.library_items enable row level security;
create policy "users manage own library" on public.library_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id));

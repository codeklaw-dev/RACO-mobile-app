-- App Review Guideline 5.1.2(i): record when the user allowed sending their
-- data to the AI provider. Null means not allowed; the API won't call a model.
alter table public.profiles add column ai_consent_at timestamptz;

-- App Review Guideline 1.2: users can report an AI response. The reported
-- text is copied so the report survives the chat being deleted; it is removed
-- with the account.
create type public.report_reason as enum ('harmful', 'sexual', 'hateful', 'inaccurate', 'other');

create table public.message_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  message_id uuid references public.messages (id) on delete set null,
  content text not null,
  reason public.report_reason not null,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index message_reports_created_idx on public.message_reports (created_at desc);

-- Written only by the API (service role); users can see their own reports.
alter table public.message_reports enable row level security;
create policy "users read own reports" on public.message_reports
  for select using (user_id = auth.uid());

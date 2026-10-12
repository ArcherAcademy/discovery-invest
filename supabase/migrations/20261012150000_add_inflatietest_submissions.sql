create table if not exists public.inflatietest_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.demo_invest_users(id) on delete cascade,
  lead_flow text not null default 'inflatietest',
  source text not null,
  submission_id uuid not null,
  submitted_at timestamptz not null,
  assigned_advisor text not null,
  answers jsonb not null,
  result text not null,
  result_details jsonb not null,
  created_at timestamptz not null default now(),
  constraint inflatietest_submissions_lead_flow_check check (lead_flow = 'inflatietest'),
  constraint inflatietest_submissions_submission_id_key unique (submission_id),
  constraint inflatietest_submissions_answers_object_check check (jsonb_typeof(answers) = 'object'),
  constraint inflatietest_submissions_result_details_object_check check (jsonb_typeof(result_details) = 'object')
);

create index if not exists inflatietest_submissions_user_id_submitted_at_idx
  on public.inflatietest_submissions (user_id, submitted_at desc);

alter table public.inflatietest_submissions enable row level security;

revoke all on table public.inflatietest_submissions from anon, authenticated;

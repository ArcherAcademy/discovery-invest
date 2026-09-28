-- Per-lead workflowplanning. Instant workflows blijven buiten deze tabel.
create table if not exists public.demo_invest_scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.demo_invest_users(id) on delete cascade,
  workflow text not null,
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'cancelled', 'skipped')),
  condition_key text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  claim_token uuid,
  claim_until timestamptz,
  unique (lead_id, workflow)
);

create index if not exists demo_invest_scheduled_messages_due_idx
  on public.demo_invest_scheduled_messages (scheduled_for, status);
create index if not exists demo_invest_scheduled_messages_lead_idx
  on public.demo_invest_scheduled_messages (lead_id, status);

alter table public.demo_invest_scheduled_messages enable row level security;

create or replace function public.demo_invest_schedule_messages(
  p_lead_id uuid,
  p_messages jsonb
) returns integer
language plpgsql security definer set search_path = '' as $$
declare inserted_count integer;
begin
  insert into public.demo_invest_scheduled_messages
    (lead_id, workflow, scheduled_for, condition_key)
  select p_lead_id, x.workflow, x.scheduled_for, x.condition_key
  from jsonb_to_recordset(p_messages) as x(workflow text, scheduled_for timestamptz, condition_key text)
  on conflict (lead_id, workflow) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.demo_invest_claim_scheduled_messages(
  p_now timestamptz default now(),
  p_limit integer default 200,
  p_claim_ttl_seconds integer default 900
) returns table (
  id uuid,
  lead_id uuid,
  workflow text,
  condition_key text,
  claim_token uuid
)
language plpgsql security definer set search_path = '' as $$
declare token uuid := gen_random_uuid();
begin
  return query
  with picked as (
    select m.id
    from public.demo_invest_scheduled_messages m
    where (m.status = 'pending' and m.scheduled_for <= p_now)
       or (m.status = 'sending' and m.claim_until < p_now)
    order by m.scheduled_for, m.created_at
    limit greatest(1, least(p_limit, 500))
    for update skip locked
  ), claimed as (
    update public.demo_invest_scheduled_messages m
    set status = 'sending', claim_token = gen_random_uuid(),
        claim_until = p_now + make_interval(secs => p_claim_ttl_seconds)
    from picked
    where m.id = picked.id
    returning m.id, m.lead_id, m.workflow, m.condition_key, m.claim_token
  )
  select * from claimed;
end;
$$;

create or replace function public.demo_invest_release_scheduled_message(
  p_id uuid, p_claim_token uuid
) returns boolean
language sql security definer set search_path = '' as $$
  update public.demo_invest_scheduled_messages
  set status = 'pending', claim_token = null, claim_until = null
  where id = p_id and status = 'sending' and claim_token = p_claim_token
  returning true;
$$;

revoke all on function public.demo_invest_schedule_messages(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.demo_invest_claim_scheduled_messages(timestamptz, integer, integer) from public, anon, authenticated;
revoke all on function public.demo_invest_release_scheduled_message(uuid, uuid) from public, anon, authenticated;
grant execute on function public.demo_invest_schedule_messages(uuid, jsonb) to service_role;
grant execute on function public.demo_invest_claim_scheduled_messages(timestamptz, integer, integer) to service_role;
grant execute on function public.demo_invest_release_scheduled_message(uuid, uuid) to service_role;

-- Bestaande actieve trials krijgen direct hun tijdlijn. De applicatie vult alleen
-- exacte vensters in; verlopen/ongeldige voorwaarden worden door de evaluator geskipt.
insert into public.demo_invest_scheduled_messages (lead_id, workflow, scheduled_for, condition_key)
select u.id, x.workflow, x.scheduled_for, x.condition_key
from public.demo_invest_users u
left join public.demo_invest_user_funnel f on f.user_id = u.id
cross join lateral (
  values
    ('activatie_2u', u.created_at + interval '2 hours', 'not_activated'),
    ('activatie_24u', u.created_at + interval '24 hours', 'not_activated'),
    ('activatie_72u', u.created_at + interval '72 hours', 'not_activated'),
    ('dag4_inactief', f.all_completed_at + interval '4 days', 'completed_not_booked'),
    ('trial_verlopen', u.trial_expires_at, 'expired_not_booked'),
    ('verloopt_5d', u.trial_expires_at - interval '5 days', 'activated_not_booked'),
    ('verloopt_3d', u.trial_expires_at - interval '3 days', 'activated_not_booked'),
    ('verloopt_1d', u.trial_expires_at - interval '1 day', 'activated_not_booked'),
    ('verloopt_6u', u.trial_expires_at - interval '6 hours', 'activated_not_booked')
) as x(workflow, scheduled_for, condition_key)
where x.scheduled_for is not null
on conflict (lead_id, workflow) do nothing;

-- Video-nudges worden alleen voor de huidige eerstvolgende video gepland.
insert into public.demo_invest_scheduled_messages (lead_id, workflow, scheduled_for, condition_key)
select u.id, 'video_' || v.order_no || '_herinnering',
       coalesce(u.last_activity_at, u.activated_at) + interval '24 hours', 'next_unseen_video'
from public.demo_invest_users u
join lateral (
  select v.order_no
  from public.demo_invest_videos v
  where v.section = 'core' and v.order_no between 2 and 6
    and not exists (
      select 1 from public.demo_invest_video_progress p
      where p.user_id = u.id and p.video_id = v.id and p.status = 'completed'
    )
  order by v.order_no limit 1
) v on true
where u.activated_at is not null
on conflict (lead_id, workflow) do nothing;

-- De geplande volgorde hierboven bevat alleen stabiele kolommen; event/workshop
-- blijft via instant of bestaande boekingslogica lopen en wordt niet gewijzigd.

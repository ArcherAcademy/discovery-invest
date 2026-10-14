create table if not exists public.demo_invest_device_usage (
  user_id uuid not null references public.demo_invest_users(id) on delete cascade,
  device_type text not null check (device_type in ('mobile', 'tablet', 'desktop')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  visit_count integer not null default 1 check (visit_count > 0),
  viewport_width integer,
  primary key (user_id, device_type)
);

alter table public.demo_invest_device_usage enable row level security;

create index if not exists demo_invest_device_usage_last_seen_idx
  on public.demo_invest_device_usage (last_seen_at desc);

create or replace function public.track_demo_invest_device(
  p_user_id uuid,
  p_device_type text,
  p_viewport_width integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_device_type not in ('mobile', 'tablet', 'desktop') then
    raise exception 'Ongeldig toesteltype';
  end if;

  insert into public.demo_invest_device_usage (
    user_id,
    device_type,
    viewport_width
  )
  values (
    p_user_id,
    p_device_type,
    p_viewport_width
  )
  on conflict (user_id, device_type)
  do update set
    last_seen_at = now(),
    visit_count = public.demo_invest_device_usage.visit_count + 1,
    viewport_width = excluded.viewport_width;
end;
$$;

revoke all on function public.track_demo_invest_device(uuid, text, integer) from public;
revoke all on function public.track_demo_invest_device(uuid, text, integer) from anon;
revoke all on function public.track_demo_invest_device(uuid, text, integer) from authenticated;
grant execute on function public.track_demo_invest_device(uuid, text, integer) to service_role;

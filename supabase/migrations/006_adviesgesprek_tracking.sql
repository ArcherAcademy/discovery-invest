alter table public.demo_invest_user_funnel
  add column if not exists call_screen_opened_at timestamptz,
  add column if not exists call_booking_clicked_at timestamptz;

create unique index if not exists demo_invest_boekingslinks_one_default
  on public.demo_invest_boekingslinks ((is_default))
  where is_default = true;

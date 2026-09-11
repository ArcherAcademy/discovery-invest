alter table public.demo_invest_users
  add column if not exists contact_owner_email text,
  add column if not exists call_opened_at timestamptz,
  add column if not exists call_clicked_at timestamptz,
  add column if not exists call_booked boolean not null default false,
  add column if not exists call_booked_at timestamptz;

create index if not exists demo_invest_users_contact_owner_email_idx
  on public.demo_invest_users (lower(contact_owner_email));

create table if not exists public.demo_invest_boekingslinks (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null,
  naam text not null,
  booking_url text not null,
  actief boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demo_invest_boekingslinks_owner_email_key unique (owner_email),
  constraint demo_invest_boekingslinks_booking_url_https check (booking_url ~ '^https://')
);

create unique index if not exists demo_invest_boekingslinks_single_default_idx
  on public.demo_invest_boekingslinks (is_default)
  where is_default = true;

alter table public.demo_invest_boekingslinks enable row level security;

comment on table public.demo_invest_boekingslinks is
  'Per HubSpot-contacteigenaar de persoonlijke afspraaklink; één actieve standaardlink is de fallback.';
comment on column public.demo_invest_users.contact_owner_email is
  'E-mailadres van de HubSpot-contacteigenaar, gebruikt voor afspraaklinkrouting.';

-- Een echte, persoonsgebonden claim vervangt de gedeelde Eventbrite-kortingscode.
create table if not exists public.demo_invest_event_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.demo_invest_users(id) on delete cascade,
  mobiel_nummer text not null,
  datum_keuze date not null,
  claimed_at timestamptz not null default now(),
  status text not null default 'nieuw'
    check (status in ('nieuw', 'in_behandeling', 'bevestigd', 'afgewezen')),
  contacted_at timestamptz,
  contacted_by uuid references public.demo_invest_users(id) on delete set null,
  webhook_status text not null default 'niet_verzonden',
  fraud_status text not null default 'ok'
    check (fraud_status in ('ok', 'verdacht_snel', 'dubbele_poging')),
  constraint demo_invest_event_claims_user_unique unique (user_id),
  constraint demo_invest_event_claims_mobile_length check (char_length(mobiel_nummer) between 8 and 20)
);

create index if not exists demo_invest_event_claims_claimed_at_idx
  on public.demo_invest_event_claims (claimed_at desc);

create index if not exists demo_invest_event_claims_datum_keuze_idx
  on public.demo_invest_event_claims (datum_keuze);

alter table public.demo_invest_event_claims enable row level security;

-- Alle toegang verloopt via geauthenticeerde serverroutes met de service role.
-- Daardoor kan geen browser rechtstreeks claims lezen, maken of wijzigen.
comment on table public.demo_invest_event_claims is
  'Persoonsgebonden claims voor een gratis Invest-avond; uitsluitend server-side toegankelijk.';

alter table public.demo_invest_users
  add column if not exists vermogenstest_variant text null,
  add column if not exists vermogenstest_vragenset text null;

alter table public.demo_invest_users
  drop constraint if exists demo_invest_users_vermogenstest_variant_check,
  drop constraint if exists demo_invest_users_vermogenstest_vragenset_check,
  drop constraint if exists demo_invest_users_vermogenstest_pair_check;

alter table public.demo_invest_users
  add constraint demo_invest_users_vermogenstest_variant_check
    check (vermogenstest_variant is null or vermogenstest_variant in ('A', 'B')),
  add constraint demo_invest_users_vermogenstest_vragenset_check
    check (vermogenstest_vragenset is null or vermogenstest_vragenset in ('oude_vragen', 'nieuwe_vragen')),
  add constraint demo_invest_users_vermogenstest_pair_check
    check (
      (vermogenstest_variant is null and vermogenstest_vragenset is null)
      or (vermogenstest_variant = 'A' and vermogenstest_vragenset = 'oude_vragen')
      or (vermogenstest_variant = 'B' and vermogenstest_vragenset = 'nieuwe_vragen')
    );

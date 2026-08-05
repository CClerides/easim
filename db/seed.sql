-- Seed — eight plans and their eSIM pools
--
-- Safe to run more than once: plans are upserted on slug, and the profile
-- pools are only topped up to their target size.

insert into plans (slug, region, country_code, data_mb, duration_days, price_cents, provider_plan_code)
values
  ('europe-5gb-15d',   'Europe',   'EU',  5120, 15, 1490, 'EA-EU-5G-15D'),
  ('japan-10gb-30d',   'Japan',    'JP', 10240, 30, 2790, 'EA-JP-10G-30D'),
  ('usa-3gb-7d',       'USA',      'US',  3072,  7,  990, 'EA-US-3G-7D'),
  ('global-20gb-30d',  'Global',   'WW', 20480, 30, 4990, 'EA-WW-20G-30D'),
  ('turkey-10gb-15d',  'Turkey',   'TR', 10240, 15, 1890, 'EA-TR-10G-15D'),
  ('uae-5gb-7d',       'UAE',      'AE',  5120,  7, 1690, 'EA-AE-5G-7D'),
  ('thailand-8gb-15d', 'Thailand', 'TH',  8192, 15, 1590, 'EA-TH-8G-15D'),
  ('mexico-5gb-30d',   'Mexico',   'MX',  5120, 30, 1390, 'EA-MX-5G-30D')
on conflict (slug) do update set
  region             = excluded.region,
  country_code       = excluded.country_code,
  data_mb            = excluded.data_mb,
  duration_days      = excluded.duration_days,
  price_cents        = excluded.price_cents,
  provider_plan_code = excluded.provider_plan_code,
  active             = true;

-- Demo accounts.
--
-- The two demo users are created through the Auth admin API, which happens
-- before this file runs, so the on_auth_user_created trigger was not yet in
-- place for them. Backfill any auth user missing a profile, then grant the
-- admin role. Both statements are idempotent.
insert into profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

update profiles set role = 'admin' where email = 'admin@easim.dev';

-- Stock.
--
-- Every plan gets 10 profiles except usa-3gb-7d, which gets 1. That single
-- scarce plan is what makes stock exhaustion demonstrable in two purchases,
-- without anyone having to edit the database mid-demo.
do $$
declare
  plan record;
  target integer;
  existing integer;
begin
  for plan in select id, slug from plans loop
    target := case when plan.slug = 'usa-3gb-7d' then 1 else 10 end;

    select count(*) into existing
    from esim_profiles
    where plan_id = plan.id and status = 'available';

    while existing < target loop
      insert into esim_profiles (plan_id, iccid, activation_code)
      values (
        plan.id,
        '8944' || lpad(floor(random() * 1e15)::bigint::text, 15, '0'),
        'LPA:1$rsp.easim.dev$' || upper(substr(md5(random()::text), 1, 16))
      )
      on conflict (iccid) do nothing;

      existing := existing + 1;
    end loop;
  end loop;
end $$;

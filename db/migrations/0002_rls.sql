-- 0002 — Row Level Security
--
-- The security model in one sentence:
--
--   The key shipped to the browser can read your own rows and nothing else,
--   and can write nothing at all. Every write goes through server-side code
--   using the secret key, after that code has checked who is asking.
--
-- That is why you will find SELECT policies below and no INSERT, UPDATE or
-- DELETE policies anywhere. Their absence is the design, not an oversight:
-- with RLS enabled, anything without a policy is denied.

alter table profiles       enable row level security;
alter table plans          enable row level security;
alter table esim_profiles  enable row level security;
alter table orders         enable row level security;
alter table order_items    enable row level security;
alter table payments       enable row level security;
alter table webhook_events enable row level security;
alter table fulfilments    enable row level security;
alter table admin_actions  enable row level security;

-- security definer: runs as the function's owner so it can read profiles
-- regardless of the caller's own policies, which would otherwise recurse.
-- search_path is pinned so the function cannot be tricked into resolving
-- `profiles` to some other schema.
create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Catalogue: readable by anyone, including signed-out visitors. Inactive
-- plans are invisible.
create policy plans_public_read on plans
  for select using (active);

-- Your own profile row, plus every row for an admin — an operator resolving a
-- failed delivery needs to know whose order it is.
--
-- Note there is still no update policy of any kind, so a customer cannot
-- promote themselves to admin, and neither can an admin promote anyone else
-- through the API.
create policy profiles_self_read on profiles
  for select using (id = auth.uid() or is_admin());

create policy orders_owner_read on orders
  for select using (user_id = auth.uid() or is_admin());

create policy order_items_owner_read on order_items
  for select using (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and (o.user_id = auth.uid() or is_admin())
    )
  );

create policy payments_owner_read on payments
  for select using (
    exists (
      select 1 from orders o
      where o.id = payments.order_id
        and (o.user_id = auth.uid() or is_admin())
    )
  );

create policy fulfilments_owner_read on fulfilments
  for select using (
    exists (
      select 1 from order_items oi
      join orders o on o.id = oi.order_id
      where oi.id = fulfilments.order_item_id
        and (o.user_id = auth.uid() or is_admin())
    )
  );

-- The delivered credential itself. Reachable only by whoever bought it: an
-- eSIM profile is visible once a fulfilment links it to one of your orders.
-- Unsold profiles are invisible to everyone, so the pool cannot be harvested.
create policy esim_profiles_owner_read on esim_profiles
  for select using (
    exists (
      select 1 from fulfilments f
      join order_items oi on oi.id = f.order_item_id
      join orders o on o.id = oi.order_id
      where f.esim_profile_id = esim_profiles.id
        and (o.user_id = auth.uid() or is_admin())
    )
  );

create policy admin_actions_admin_read on admin_actions
  for select using (is_admin());

-- webhook_events deliberately has RLS enabled and NO policy of any kind.
-- It is unreachable by the browser entirely. Only server code holding the
-- secret key, which bypasses RLS, can touch it.

-- 0001 — Schema
--
-- Run order: 0001 → 0002 → 0003 → seed.sql
--
-- Two constraints in this file carry the whole assessment:
--   orders (user_id, idempotency_key) UNIQUE  — a double-clicked checkout
--                                               cannot create two orders
--   fulfilments.order_item_id       UNIQUE  — an eSIM cannot be delivered
--                                               twice, even if the payment
--                                               provider replays its callback

create type order_status as enum (
  'created',
  'awaiting_payment',
  'paid',
  'fulfilling',
  'fulfilled',
  'fulfilment_failed',
  'payment_declined',
  'payment_timeout',
  'cancelled',
  'refunded'
);

create type esim_profile_status as enum ('available', 'reserved', 'consumed');

create type fulfilment_status as enum ('pending', 'succeeded', 'failed');

-- Mirrors auth.users so the app has somewhere to hang a role. Supabase owns
-- auth.users; we never write to it directly.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);

create table plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  region text not null,
  country_code text not null,
  data_mb integer not null check (data_mb > 0),
  duration_days integer not null check (duration_days > 0),
  price_cents integer not null check (price_cents > 0),
  currency text not null default 'EUR',
  provider_plan_code text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- The finite pool of eSIMs. Making stock real is what turns "what if you run
-- out mid-checkout" from a hypothetical into a state you can demonstrate.
create table esim_profiles (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans (id) on delete cascade,
  iccid text not null unique,
  activation_code text not null,
  status esim_profile_status not null default 'available',
  created_at timestamptz not null default now()
);

-- Partial index: only unclaimed rows are ever searched, so the index stays
-- small as consumed profiles accumulate.
create index esim_profiles_available_idx
  on esim_profiles (plan_id)
  where status = 'available';

create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status order_status not null default 'created',
  subtotal_cents integer not null check (subtotal_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  currency text not null default 'EUR',
  scenario text not null default 'approve'
    check (scenario in ('approve', 'decline', 'timeout', 'provider_failure')),
  -- Sent by the client, unique per user. The second submission of the same
  -- checkout finds this row instead of creating another.
  idempotency_key text not null,
  -- After this instant, an order still awaiting payment is treated as timed
  -- out. Checked whenever the order is read (there is no scheduler).
  payment_deadline_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index orders_user_created_idx on orders (user_id, created_at desc);
create index orders_status_idx on orders (status);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  plan_id uuid not null references plans (id),
  qty integer not null check (qty > 0),
  -- Copied from plans at order time. The browser never supplies this, and a
  -- later price change must not alter a past order.
  unit_price_cents integer not null check (unit_price_cents > 0)
);

create index order_items_order_idx on order_items (order_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  provider_ref text not null unique,
  status text not null check (status in ('requested', 'succeeded', 'declined', 'timed_out')),
  amount_cents integer not null,
  failure_reason text,
  requested_at timestamptz not null default now(),
  settled_at timestamptz
);

create index payments_order_idx on payments (order_id);

-- The idempotency ledger. Every inbound callback is recorded here first; the
-- UNIQUE violation on a repeat is how a duplicate is detected.
create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table fulfilments (
  id uuid primary key default gen_random_uuid(),
  -- One fulfilment per line item, enforced by the database rather than by
  -- application logic. This is the last line of defence against double
  -- delivery and it cannot be bypassed by a race.
  order_item_id uuid not null unique references order_items (id) on delete cascade,
  esim_profile_id uuid references esim_profiles (id),
  status fulfilment_status not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  next_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index fulfilments_status_idx on fulfilments (status);

-- Audit trail for manual admin intervention.
create table admin_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users (id),
  order_id uuid not null references orders (id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);

# eSIM Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, deploy and host a working eSIM store that sells eight plans, takes an order through checkout, confirms payment by asynchronous callback, and automatically provisions and delivers a QR code and ICCID — surviving decline, timeout, provider failure and stock exhaustion without ever losing an order.

**Architecture:** A single Next.js App Router application talks to Supabase Postgres over RLS-scoped clients. A mock provider service lives in a separate workspace package and is reached **only over HTTP**, so it can later move to its own deployment without a refactor. Payment confirmation arrives as an HMAC-signed webhook, deduplicated through a `webhook_events` ledger, which then drives fulfilment: an atomic claim of one eSIM profile from a finite pool, guarded by a UNIQUE constraint that makes double delivery impossible.

**Tech Stack:** Next.js (App Router, React Server Components) · TypeScript · Tailwind CSS · Supabase (Postgres, Auth, RLS, Realtime) · Zod · Vitest · Playwright · Vercel Hobby · pnpm workspaces

**Spec:** `docs/superpowers/specs/2026-08-05-esim-store-design.md`

---

## Global Constraints

Every task's requirements implicitly include this section.

**Cost — hard requirement**
- Every service must be free tier. Supabase free project, Vercel Hobby, Supabase built-in SMTP.
- No custom domain, no Resend, no Stripe, no paid plan, no service requiring a card.
- **No Vercel Cron.** Hobby permits one run per day, which is useless for reconciliation. State transitions are reader-driven (spec §6.5).

**Simplicity — hard requirement**
- Optimise for a code walkthrough the author must defend under questioning.
- No barrel/index re-export files. No one-component-per-directory. Colocate related code.
- Target roughly 50 source files total. If a task would push far past that, simplify instead.
- Prefer boring, explicit code over clever abstraction. No dependency injection frameworks, no custom hooks that wrap one line, no premature generics.
- Every dependency added must be justified in the task that adds it.

**Security — hard requirement**
- `SUPABASE_SERVICE_ROLE_KEY` may only be imported by a module whose first line is `import 'server-only'`.
- Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are ever public.
- RLS enabled on every table with deny-by-default. No table ships without policies.
- **No card number, expiry, or CVC field may exist anywhere in the codebase**, including the mock checkout. The brief forbids it explicitly.
- All external input validated with Zod at the boundary.
- No secret committed. `.env.example` holds placeholders only.

**Money**
- All monetary values are integer cents (`price_cents`, `total_cents`). Never floats.
- Currency is `EUR` throughout. No multi-currency.

**Naming**
- Database: `snake_case`. TypeScript: `camelCase` for values, `PascalCase` for types.
- Order status values are exactly: `created`, `awaiting_payment`, `paid`, `fulfilling`, `fulfilled`, `fulfilment_failed`, `payment_declined`, `payment_timeout`, `cancelled`, `refunded`.
- Note the spelling `fulfilment` (single `l`) everywhere, including column and file names. Consistency matters more than dialect.

**Git**
- One branch per task, named in the task header. Merge to `master` by PR before starting the next task.
- Commit at the end of every task at minimum; more often is better.

**Study notes — after every task**
- Append a plain-language explanation to `~/Desktop/trezuz-study-notes/NN-<topic>.md` (outside the repo, never committed).
- Written for someone who will be asked to explain this code aloud: what the task added, why it exists, which file to open, and the one question a reviewer is most likely to ask about it.
- Short sentences. No jargon without a definition on first use.

---

## File Structure

```
trezuz/
├── pnpm-workspace.yaml            # frontend + backend packages
├── package.json                   # root scripts only
├── .env.example                   # placeholders, committed
├── README.md                      # submission document (Task 15)
│
├── db/                            # not a package — SQL applied via Supabase SQL editor
│   ├── migrations/
│   │   ├── 0001_schema.sql        # tables, enums, indexes, constraints
│   │   ├── 0002_rls.sql           # RLS enable + policies for every table
│   │   └── 0003_functions.sql     # claim_esim_profile(), handle_new_user()
│   ├── seed.sql                   # 8 plans, profile pools, demo users
│   └── README.md                  # how to apply, in order
│
├── backend/                       # the "outside world" — mock provider service
│   ├── package.json               # name: @easim/mock-provider
│   └── src/
│       ├── index.ts               # handleProviderRequest(Request): Response — the only export
│       ├── payments.ts            # authorize + scenario logic + callback dispatch
│       ├── esim.ts                # provision + failure injection
│       └── hmac.ts                # signing (deliberately duplicated — see Task 8)
│
└── frontend/                      # the Next.js store
    ├── package.json
    ├── next.config.ts
    ├── middleware.ts              # session refresh + admin redirect (UX only)
    ├── public/                    # favicon + generated brand imagery
    └── src/
        ├── app/
        │   ├── layout.tsx  globals.css  page.tsx        # landing
        │   ├── plans/page.tsx  plans/[slug]/page.tsx
        │   ├── cart/page.tsx
        │   ├── checkout/page.tsx  checkout/actions.ts
        │   ├── orders/[id]/page.tsx                     # receipt + live status
        │   ├── account/page.tsx                         # order history + eSIMs
        │   ├── admin/page.tsx  admin/actions.ts
        │   ├── login/page.tsx  login/actions.ts
        │   ├── legal/terms/page.tsx  legal/refunds/page.tsx
        │   ├── legal/privacy/page.tsx  legal/contact/page.tsx
        │   └── api/
        │       ├── webhooks/payment/route.ts            # inbound callback
        │       ├── auth/confirm/route.ts                # magic-link exchange
        │       └── mock-provider/[...path]/route.ts     # mounts @easim/mock-provider
        ├── components/
        │   ├── site/     header.tsx  footer.tsx  cookie-banner.tsx
        │   ├── ui/       button.tsx  card.tsx  badge.tsx  (+ 21st.dev additions)
        │   └── commerce/ plan-card.tsx  add-to-cart.tsx  cart-contents.tsx
        │                 scenario-selector.tsx  order-status.tsx  esim-credential.tsx
        └── lib/
            ├── env.ts                     # Zod-validated environment access
            ├── supabase/  server.ts  browser.ts  admin.ts (server-only)
            ├── orders/    status.ts       # state machine — pure, no I/O
            │              pricing.ts      # server-side totals — pure
            │              create.ts       # order creation + idempotency
            │              fulfilment.ts   # claim, provision, retry
            │              reconcile.ts    # lazy timeout transition
            ├── provider/  client.ts       # HTTP client to the mock provider
            ├── security/  hmac.ts  rate-limit.ts  headers.ts
            ├── cart/      store.ts        # client-only localStorage cart
            └── schemas.ts                 # all Zod schemas, one file
```

**Two files carry the whole assessment:** `lib/orders/status.ts` (the state machine) and `app/api/webhooks/payment/route.ts` (the idempotent callback). Both are unit tested first and are the ones to be able to defend line by line.

---

## Human Steps (do these before Task 2)

These cannot be automated and block later tasks. All free.

1. Create a Supabase project at supabase.com — free tier, region closest to Europe. Note the project URL, anon key, and service role key.
2. Create a Vercel account if absent and connect the GitHub repo (Hobby plan, no card).

---

## Task 1: Scaffold, environment validation, test harness

**Branch:** `feat/scaffold`

**Files:**
- Create: `pnpm-workspace.yaml`, `package.json`, `.env.example`, `.gitignore`
- Create: `frontend/` via `create-next-app`
- Create: `frontend/src/lib/env.ts`
- Test: `frontend/src/lib/env.test.ts`
- Create: `frontend/vitest.config.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `env` — a frozen object with typed keys `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PROVIDER_BASE_URL`, `PROVIDER_HMAC_SECRET`, `APP_BASE_URL`. Throws at import time on a missing or malformed variable.

- [ ] **Step 1: Scaffold the workspace**

```bash
cd /Users/kliridis/Developer/trezuz
pnpm create next-app@latest frontend --ts --tailwind --app --eslint --src-dir --import-alias "@/*" --no-turbopack
printf 'packages:\n  - frontend\n  - backend\n' > pnpm-workspace.yaml
```

Answer `No` to any prompt offering extra libraries. Keep the scaffold minimal.

- [ ] **Step 2: Add root package.json**

```json
{
  "name": "easim",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter frontend dev",
    "build": "pnpm --filter frontend build",
    "test": "pnpm --filter frontend test",
    "e2e": "pnpm --filter frontend exec playwright test"
  }
}
```

- [ ] **Step 3: Install test tooling**

```bash
pnpm --filter frontend add -D vitest @vitejs/plugin-react
pnpm --filter frontend add zod
```

`zod` is a runtime dependency because it validates webhook payloads in production code, not only in tests.

Add to `frontend/package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

Create `frontend/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  test: { environment: 'node' },
})
```

- [ ] **Step 4: Write the failing test**

Create `frontend/src/lib/env.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseEnv } from './env'

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  PROVIDER_BASE_URL: 'http://localhost:3000/api/mock-provider',
  PROVIDER_HMAC_SECRET: 'a-secret-at-least-16-chars',
  APP_BASE_URL: 'http://localhost:3000',
}

describe('parseEnv', () => {
  it('returns typed values when every variable is present', () => {
    expect(parseEnv(valid).APP_BASE_URL).toBe('http://localhost:3000')
  })

  it('throws when a required variable is missing', () => {
    const { SUPABASE_SERVICE_ROLE_KEY, ...missing } = valid
    expect(() => parseEnv(missing)).toThrow(/SUPABASE_SERVICE_ROLE_KEY/)
  })

  it('rejects an HMAC secret that is too short to be safe', () => {
    expect(() => parseEnv({ ...valid, PROVIDER_HMAC_SECRET: 'short' })).toThrow()
  })

  it('rejects a malformed URL', () => {
    expect(() => parseEnv({ ...valid, APP_BASE_URL: 'not-a-url' })).toThrow()
  })
})
```

- [ ] **Step 5: Run it and confirm it fails**

Run: `pnpm --filter frontend test`
Expected: FAIL — `Failed to resolve import "./env"`.

- [ ] **Step 6: Implement `frontend/src/lib/env.ts`**

```ts
import { z } from 'zod'

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  PROVIDER_BASE_URL: z.string().url(),
  PROVIDER_HMAC_SECRET: z.string().min(16),
  APP_BASE_URL: z.string().url(),
})

export type Env = z.infer<typeof schema>

/** Exported separately so it can be tested without touching process.env. */
export function parseEnv(source: Record<string, unknown>): Env {
  const result = schema.safeParse(source)
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    throw new Error(`Invalid environment: ${detail}`)
  }
  return result.data
}
```

Note: a separate server-only accessor is added in Task 2, once there is a server module that needs it. Adding it now would be an unused export.

- [ ] **Step 7: Run tests and confirm they pass**

Run: `pnpm --filter frontend test`
Expected: PASS, 4 tests.

- [ ] **Step 8: Write `.env.example` and `.gitignore`**

`.env.example` (committed, placeholders only):

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PROVIDER_BASE_URL=http://localhost:3000/api/mock-provider
PROVIDER_HMAC_SECRET=generate-with-openssl-rand-hex-32
APP_BASE_URL=http://localhost:3000
```

Confirm the root `.gitignore` contains `.env*.local`, `node_modules`, `.next`, `.vercel`.

- [ ] **Step 9: Verify the app boots**

Run: `pnpm dev`, open `http://localhost:3000`, confirm the Next default page renders, then stop the server.

- [ ] **Step 10: Commit and open the PR**

```bash
git checkout -b feat/scaffold
git add -A
git commit -m "feat: scaffold workspace with validated environment access"
git push -u origin feat/scaffold
gh pr create --fill
```

- [ ] **Step 11: Write the study note**

Create `~/Desktop/trezuz-study-notes/01-scaffold.md` explaining: what a pnpm workspace is and why there are two packages; why environment variables are validated at startup rather than read inline (a missing key fails the build, not a customer's checkout); why `parseEnv` takes an argument instead of reading `process.env` directly (so it can be tested).

---

## Task 2: Database schema, RLS, and seed data

**Branch:** `feat/db-schema`

**Files:**
- Create: `db/migrations/0001_schema.sql`, `db/migrations/0002_rls.sql`, `db/migrations/0003_functions.sql`, `db/seed.sql`, `db/README.md`
- Create: `frontend/src/lib/supabase/server.ts`, `browser.ts`, `admin.ts`
- Test: `frontend/src/lib/supabase/rls.test.ts`

**Interfaces:**
- Consumes: `env` from Task 1
- Produces:
  - `createServerClient(): Promise<SupabaseClient>` — RLS-scoped to the signed-in user, for Server Components and Server Actions
  - `createBrowserClient(): SupabaseClient` — anon key, browser only
  - `createAdminClient(): SupabaseClient` — service role, `server-only`, used exclusively by the webhook and fulfilment paths
  - Order status values as listed in Global Constraints

- [ ] **Step 1: Install the Supabase packages**

```bash
pnpm --filter frontend add @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Write `db/migrations/0001_schema.sql`**

```sql
create type order_status as enum (
  'created', 'awaiting_payment', 'paid', 'fulfilling', 'fulfilled',
  'fulfilment_failed', 'payment_declined', 'payment_timeout',
  'cancelled', 'refunded'
);
create type esim_profile_status as enum ('available', 'reserved', 'consumed');
create type fulfilment_status as enum ('pending', 'succeeded', 'failed');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
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

create table esim_profiles (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  iccid text not null unique,
  activation_code text not null,
  status esim_profile_status not null default 'available',
  created_at timestamptz not null default now()
);
create index esim_profiles_available_idx on esim_profiles (plan_id) where status = 'available';

create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status order_status not null default 'created',
  subtotal_cents integer not null check (subtotal_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  currency text not null default 'EUR',
  idempotency_key text not null,
  payment_deadline_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index orders_user_created_idx on orders (user_id, created_at desc);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  plan_id uuid not null references plans(id),
  qty integer not null check (qty > 0),
  unit_price_cents integer not null check (unit_price_cents > 0)
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  provider_ref text not null unique,
  status text not null check (status in ('requested', 'succeeded', 'declined', 'timed_out')),
  amount_cents integer not null,
  failure_reason text,
  requested_at timestamptz not null default now(),
  settled_at timestamptz
);

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
  order_item_id uuid not null references order_items(id) on delete cascade unique,
  esim_profile_id uuid references esim_profiles(id),
  status fulfilment_status not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  next_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table admin_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  order_id uuid not null references orders(id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);
```

The two UNIQUE constraints that matter: `orders (user_id, idempotency_key)` stops a double-clicked checkout creating two orders, and `fulfilments.order_item_id` makes a second delivery physically impossible even under a replayed callback.

- [ ] **Step 3: Write `db/migrations/0002_rls.sql`**

```sql
alter table profiles       enable row level security;
alter table plans          enable row level security;
alter table esim_profiles  enable row level security;
alter table orders         enable row level security;
alter table order_items    enable row level security;
alter table payments       enable row level security;
alter table webhook_events enable row level security;
alter table fulfilments    enable row level security;
alter table admin_actions  enable row level security;

create or replace function is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- Catalogue: world-readable, never client-writable.
create policy plans_public_read on plans for select using (active);

-- Own profile only. role is NOT updatable here: no update policy exists at all.
create policy profiles_self_read on profiles for select using (id = auth.uid());

-- Orders and children: owner reads, admin reads all. No client writes anywhere —
-- every write goes through a Server Action or the service-role webhook path.
create policy orders_owner_read on orders for select
  using (user_id = auth.uid() or is_admin());

create policy order_items_owner_read on order_items for select
  using (exists (select 1 from orders o
                 where o.id = order_items.order_id
                   and (o.user_id = auth.uid() or is_admin())));

create policy payments_owner_read on payments for select
  using (exists (select 1 from orders o
                 where o.id = payments.order_id
                   and (o.user_id = auth.uid() or is_admin())));

create policy fulfilments_owner_read on fulfilments for select
  using (exists (select 1 from order_items oi
                 join orders o on o.id = oi.order_id
                 where oi.id = fulfilments.order_item_id
                   and (o.user_id = auth.uid() or is_admin())));

-- The delivered credential is readable only by the buyer.
create policy esim_profiles_owner_read on esim_profiles for select
  using (exists (select 1 from fulfilments f
                 join order_items oi on oi.id = f.order_item_id
                 join orders o on o.id = oi.order_id
                 where f.esim_profile_id = esim_profiles.id
                   and (o.user_id = auth.uid() or is_admin())));

create policy admin_actions_admin_read on admin_actions for select using (is_admin());

-- webhook_events has RLS enabled and NO policy: unreachable by anon and
-- authenticated clients entirely. Only the service role, which bypasses RLS,
-- can touch it. That is intentional.
```

- [ ] **Step 4: Write `db/migrations/0003_functions.sql`**

```sql
-- Claim exactly one available profile for a plan, atomically.
-- SKIP LOCKED lets concurrent checkouts claim different rows instead of
-- queueing behind one another. Returns zero rows when stock is exhausted.
create or replace function claim_esim_profile(p_plan_id uuid)
returns esim_profiles
language plpgsql security definer set search_path = public as $$
declare claimed esim_profiles;
begin
  update esim_profiles set status = 'reserved'
  where id = (
    select id from esim_profiles
    where plan_id = p_plan_id and status = 'available'
    limit 1 for update skip locked
  )
  returning * into claimed;
  return claimed;
end;
$$;

-- Mirror every new auth user into profiles so RLS has a row to read.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

- [ ] **Step 5: Write `db/seed.sql`**

Insert the eight plans from spec §2, each with `provider_plan_code` of the form `TZ-<COUNTRY>-<GB>G-<DAYS>D`, then generate a profile pool per plan:

```sql
insert into plans (slug, region, country_code, data_mb, duration_days, price_cents, provider_plan_code) values
  ('europe-5gb-15d',   'Europe',   'EU', 5120,  15, 1490, 'TZ-EU-5G-15D'),
  ('japan-10gb-30d',   'Japan',    'JP', 10240, 30, 2790, 'TZ-JP-10G-30D'),
  ('usa-3gb-7d',       'USA',      'US', 3072,  7,   990, 'TZ-US-3G-7D'),
  ('global-20gb-30d',  'Global',   'WW', 20480, 30, 4990, 'TZ-WW-20G-30D'),
  ('turkey-10gb-15d',  'Turkey',   'TR', 10240, 15, 1890, 'TZ-TR-10G-15D'),
  ('uae-5gb-7d',       'UAE',      'AE', 5120,  7,  1690, 'TZ-AE-5G-7D'),
  ('thailand-8gb-15d', 'Thailand', 'TH', 8192,  15, 1590, 'TZ-TH-8G-15D'),
  ('mexico-5gb-30d',   'Mexico',   'MX', 5120,  30, 1390, 'TZ-MX-5G-30D');

-- Ten profiles per plan, except usa-3gb-7d which gets one, so stock
-- exhaustion is demonstrable in two purchases without editing the database.
insert into esim_profiles (plan_id, iccid, activation_code)
select p.id,
       '8944' || lpad((floor(random() * 1e15))::bigint::text, 15, '0'),
       'LPA:1$rsp.easim.dev$' || upper(substr(md5(random()::text), 1, 16))
from plans p,
     generate_series(1, 10) g
where p.slug <> 'usa-3gb-7d';

insert into esim_profiles (plan_id, iccid, activation_code)
select p.id,
       '8944' || lpad((floor(random() * 1e15))::bigint::text, 15, '0'),
       'LPA:1$rsp.easim.dev$' || upper(substr(md5(random()::text), 1, 16))
from plans p where p.slug = 'usa-3gb-7d';
```

- [ ] **Step 6: Apply everything in the Supabase SQL editor**

Run `0001`, `0002`, `0003`, then `seed.sql`, in that order. Confirm in the Table Editor that `plans` has 8 rows and `esim_profiles` has 71.

- [ ] **Step 7: Create the demo users**

In the Supabase dashboard under Authentication → Users, add two users with "Auto Confirm":
- `demo@easim.dev`
- `admin@easim.dev`

Then promote the admin: `update profiles set role = 'admin' where email = 'admin@easim.dev';`

Record both UUIDs — Task 5 needs them. **Do not commit them**; they go in `.env.local` as `DEMO_CUSTOMER_EMAIL` and `DEMO_ADMIN_EMAIL`, and both must be added to `.env.example` as placeholders and to `frontend/src/lib/env.ts`'s schema as `z.string().email()`.

- [ ] **Step 8: Write the three Supabase clients**

`frontend/src/lib/supabase/browser.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

`frontend/src/lib/supabase/server.ts` — the standard `@supabase/ssr` cookie-bridging server client, RLS-scoped to the signed-in user.

`frontend/src/lib/supabase/admin.ts`:

```ts
import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { serverEnv } from '@/lib/env'

/**
 * Bypasses RLS. Only the webhook and fulfilment paths may use this.
 * The `server-only` import above makes a client-side import a build error,
 * not a runtime leak.
 */
export function createAdminClient() {
  return createClient(serverEnv().NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
```

Add `serverEnv()` to `frontend/src/lib/env.ts` — a memoised `parseEnv(process.env)` guarded by `import 'server-only'` in its own module `frontend/src/lib/env.server.ts` if the `server-only` boundary conflicts with the browser importing `parseEnv`. Keep `parseEnv` pure and importable anywhere.

```bash
pnpm --filter frontend add server-only
```

- [ ] **Step 9: Write the RLS proof test**

Create `frontend/src/lib/supabase/rls.test.ts`. This is an integration test that hits the real free-tier project using the anon key only.

```ts
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const anonClient = createClient(url, anon)

describe('row level security', () => {
  it('lets anyone read the catalogue', async () => {
    const { data, error } = await anonClient.from('plans').select('slug')
    expect(error).toBeNull()
    expect(data).toHaveLength(8)
  })

  it('returns no orders to a signed-out visitor', async () => {
    const { data } = await anonClient.from('orders').select('id')
    expect(data).toEqual([])
  })

  it('refuses to expose the webhook ledger at all', async () => {
    const { data } = await anonClient.from('webhook_events').select('id')
    expect(data).toEqual([])
  })

  it('refuses an anonymous write to plans', async () => {
    const { error } = await anonClient.from('plans').insert({
      slug: 'hacked', region: 'X', country_code: 'XX', data_mb: 1,
      duration_days: 1, price_cents: 1, provider_plan_code: 'X',
    })
    expect(error).not.toBeNull()
  })
})
```

Load `.env.local` into the test run by adding `test: { env: loadEnv('', process.cwd(), '') }` via `loadEnv` from `vite` in `vitest.config.ts`.

- [ ] **Step 10: Run the tests**

Run: `pnpm --filter frontend test`
Expected: PASS. A failure here means a policy is wrong — fix the SQL, re-apply, re-run. Do not proceed with a failing RLS test.

- [ ] **Step 11: Commit**

```bash
git checkout -b feat/db-schema
git add -A
git commit -m "feat: add schema, RLS policies, atomic claim function and seed data"
git push -u origin feat/db-schema && gh pr create --fill
```

- [ ] **Step 12: Study note**

`~/Desktop/trezuz-study-notes/02-database.md`: what RLS is and why it means a stolen anon key still reads nothing; why `webhook_events` has RLS on and zero policies; what `security definer` means on `is_admin()` and `claim_esim_profile()`; why `SKIP LOCKED` exists. Likely reviewer question: *"What stops a customer reading someone else's eSIM?"* — answer with the `esim_profiles_owner_read` policy.

---

## Task 3: Order state machine and pricing

**Branch:** `feat/order-state-machine`

Pure functions, zero I/O, exhaustively tested. This is the task most worth doing carefully.

**Files:**
- Create: `frontend/src/lib/orders/status.ts`, `frontend/src/lib/orders/pricing.ts`
- Test: `frontend/src/lib/orders/status.test.ts`, `frontend/src/lib/orders/pricing.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type OrderStatus` — the ten values from Global Constraints
  - `canTransition(from: OrderStatus, to: OrderStatus): boolean`
  - `assertTransition(from: OrderStatus, to: OrderStatus): void` — throws `InvalidTransitionError`
  - `isTerminal(status: OrderStatus): boolean`
  - `class InvalidTransitionError extends Error`
  - `calculateTotals(items: PricedItem[]): { subtotalCents: number; totalCents: number }` where `PricedItem = { unitPriceCents: number; qty: number }`

- [ ] **Step 1: Write the failing state machine test**

```ts
import { describe, it, expect } from 'vitest'
import { canTransition, assertTransition, isTerminal, InvalidTransitionError } from './status'

describe('order state machine', () => {
  it('walks the happy path', () => {
    expect(canTransition('created', 'awaiting_payment')).toBe(true)
    expect(canTransition('awaiting_payment', 'paid')).toBe(true)
    expect(canTransition('paid', 'fulfilling')).toBe(true)
    expect(canTransition('fulfilling', 'fulfilled')).toBe(true)
  })

  it('allows both payment failure exits', () => {
    expect(canTransition('awaiting_payment', 'payment_declined')).toBe(true)
    expect(canTransition('awaiting_payment', 'payment_timeout')).toBe(true)
  })

  it('allows fulfilment to fail and be retried', () => {
    expect(canTransition('fulfilling', 'fulfilment_failed')).toBe(true)
    expect(canTransition('fulfilment_failed', 'fulfilling')).toBe(true)
  })

  it('never lets an unpaid order be fulfilled', () => {
    expect(canTransition('created', 'fulfilled')).toBe(false)
    expect(canTransition('payment_declined', 'fulfilling')).toBe(false)
    expect(canTransition('payment_timeout', 'paid')).toBe(false)
  })

  it('never leaves a terminal state', () => {
    expect(canTransition('fulfilled', 'fulfilling')).toBe(false)
    expect(canTransition('refunded', 'paid')).toBe(false)
    expect(isTerminal('fulfilled')).toBe(true)
    expect(isTerminal('fulfilment_failed')).toBe(false)
  })

  it('treats a repeat of the same status as a no-op, not an error', () => {
    expect(canTransition('paid', 'paid')).toBe(true)
  })

  it('throws with both states named when the transition is illegal', () => {
    expect(() => assertTransition('created', 'fulfilled')).toThrow(InvalidTransitionError)
    expect(() => assertTransition('created', 'fulfilled')).toThrow(/created.*fulfilled/)
  })
})
```

The "repeat is a no-op" case exists because a replayed webhook will legitimately try to move `paid → paid`. That must not throw.

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm --filter frontend test status`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `status.ts`**

```ts
export const ORDER_STATUSES = [
  'created', 'awaiting_payment', 'paid', 'fulfilling', 'fulfilled',
  'fulfilment_failed', 'payment_declined', 'payment_timeout',
  'cancelled', 'refunded',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

/** The only legal moves. Anything absent here is a bug, not a feature. */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  created:           ['awaiting_payment', 'cancelled'],
  awaiting_payment:  ['paid', 'payment_declined', 'payment_timeout', 'cancelled'],
  paid:              ['fulfilling', 'refunded'],
  fulfilling:        ['fulfilled', 'fulfilment_failed'],
  fulfilment_failed: ['fulfilling', 'refunded'],
  fulfilled:         [],
  payment_declined:  [],
  payment_timeout:   [],
  cancelled:         [],
  refunded:          [],
}

export class InvalidTransitionError extends Error {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(`Illegal order transition: ${from} -> ${to}`)
    this.name = 'InvalidTransitionError'
  }
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true // replayed callbacks land here
  return TRANSITIONS[from].includes(to)
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to)
}

export function isTerminal(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0
}
```

- [ ] **Step 4: Run and confirm green**

Run: `pnpm --filter frontend test status`
Expected: PASS, 7 tests.

- [ ] **Step 5: Write the failing pricing test**

```ts
import { describe, it, expect } from 'vitest'
import { calculateTotals } from './pricing'

describe('calculateTotals', () => {
  it('sums line items in integer cents', () => {
    expect(calculateTotals([
      { unitPriceCents: 1490, qty: 2 },
      { unitPriceCents: 990, qty: 1 },
    ])).toEqual({ subtotalCents: 3970, totalCents: 3970 })
  })

  it('returns zero for an empty cart', () => {
    expect(calculateTotals([])).toEqual({ subtotalCents: 0, totalCents: 0 })
  })

  it('rejects a non-integer price rather than rounding silently', () => {
    expect(() => calculateTotals([{ unitPriceCents: 14.9, qty: 1 }])).toThrow()
  })

  it('rejects a zero or negative quantity', () => {
    expect(() => calculateTotals([{ unitPriceCents: 100, qty: 0 }])).toThrow()
  })
})
```

- [ ] **Step 6: Implement `pricing.ts`**

```ts
export type PricedItem = { unitPriceCents: number; qty: number }

/**
 * Totals are computed here and nowhere else. The browser never sends a price;
 * it sends plan IDs and quantities, and the server looks the prices up.
 */
export function calculateTotals(items: PricedItem[]) {
  let subtotalCents = 0
  for (const item of items) {
    if (!Number.isInteger(item.unitPriceCents)) {
      throw new Error(`Price must be integer cents, received ${item.unitPriceCents}`)
    }
    if (!Number.isInteger(item.qty) || item.qty < 1) {
      throw new Error(`Quantity must be a positive integer, received ${item.qty}`)
    }
    subtotalCents += item.unitPriceCents * item.qty
  }
  // No tax or shipping on a digital product; totalCents exists so adding
  // either later touches one function instead of every call site.
  return { subtotalCents, totalCents: subtotalCents }
}
```

- [ ] **Step 7: Run the full suite, then commit**

Run: `pnpm --filter frontend test`
Expected: PASS, all tests.

```bash
git checkout -b feat/order-state-machine
git add -A && git commit -m "feat: add order state machine and server-side pricing"
git push -u origin feat/order-state-machine && gh pr create --fill
```

- [ ] **Step 8: Study note**

`~/Desktop/trezuz-study-notes/03-state-machine.md`: what a state machine is in one paragraph; why illegal transitions throw instead of being ignored; why `from === to` returns true (webhook replays); why prices are never accepted from the browser. Likely question: *"What happens if the payment webhook arrives twice?"*

---

## Task 4: Catalogue — landing, plan list, plan detail

**Branch:** `feat/catalogue`

**Files:**
- Create: `frontend/src/app/page.tsx`, `frontend/src/app/plans/page.tsx`, `frontend/src/app/plans/[slug]/page.tsx`
- Create: `frontend/src/components/commerce/plan-card.tsx`
- Create: `frontend/src/components/site/header.tsx`, `footer.tsx`
- Modify: `frontend/src/app/layout.tsx`

**Interfaces:**
- Consumes: `createServerClient` (Task 2)
- Produces: `type Plan` — the row shape, exported from `frontend/src/lib/schemas.ts`; `formatPrice(cents: number): string`; `formatData(mb: number): string`

**Rendering contract (spec §7):** landing and `/plans` are Server Components with `export const revalidate = 3600`. `/plans/[slug]` uses the same revalidate for its shell, and reads live availability with a `noStore()`-scoped query so a sold-out plan never renders as in-stock from cache.

- [ ] **Step 1: Add the formatters with tests**

`frontend/src/lib/format.ts` and `format.test.ts`:

```ts
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' })
    .format(cents / 100)
}

export function formatData(mb: number): string {
  return mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`
}
```

Tests: `formatPrice(1490) === '€14.90'`, `formatData(5120) === '5 GB'`, `formatData(512) === '512 MB'`.

- [ ] **Step 2: Build `/plans`**

Server Component. Query `plans` where `active`, order by `price_cents`. Render a responsive grid of `PlanCard`. Each card shows region, data, duration, price, and an availability badge derived from a count of `available` profiles.

Empty state: if zero plans return, render an explicit "catalogue unavailable" panel rather than an empty grid.

- [ ] **Step 3: Build `/plans/[slug]`**

Server Component. `generateStaticParams` from the eight slugs. Renders full detail plus the `AddToCart` client island (built in Task 6 — until then, a disabled button placeholder is acceptable **within this task only**, and Task 6 replaces it).

Call `notFound()` for an unknown or inactive slug.

- [ ] **Step 4: Build header, footer, and the landing page**

Header: logo, Plans, Cart, Account/Sign in. Footer: links to the four legal pages (built in Task 13 — link to them now, they will 404 until then, and Task 13's checklist includes confirming they resolve).

Landing: hero, three value propositions, four featured plans, CTA to `/plans`. Visual polish is Task 14's job — build the structure now, style it properly later.

- [ ] **Step 5: Verify and commit**

Run `pnpm dev`, confirm `/plans` lists eight plans with correct prices and `/plans/europe-5gb-15d` renders, and that an unknown slug 404s.

```bash
git checkout -b feat/catalogue
git add -A && git commit -m "feat: add catalogue, plan detail and site chrome"
git push -u origin feat/catalogue && gh pr create --fill
```

- [ ] **Step 6: Study note**

`~/Desktop/trezuz-study-notes/04-catalogue.md`: what a Server Component is and why the catalogue is one; what `revalidate` does; why stock is read fresh while price is cached.

---

## Task 5: Authentication — magic link plus demo sign-in

**Branch:** `feat/auth`

**Files:**
- Create: `frontend/src/app/login/page.tsx`, `frontend/src/app/login/actions.ts`
- Create: `frontend/src/app/api/auth/confirm/route.ts`
- Create: `frontend/middleware.ts`
- Create: `frontend/src/lib/security/rate-limit.ts` + test

**Interfaces:**
- Consumes: Supabase clients (Task 2), `serverEnv` (Task 1)
- Produces: `requireUser(): Promise<User>` and `requireAdmin(): Promise<User>` in `frontend/src/lib/auth.ts` — both throw a redirect when unsatisfied. Every protected Server Component and Server Action calls one of these. Middleware is **not** the authorisation boundary.

- [ ] **Step 1: Implement the in-memory rate limiter with tests**

A fixed-window counter keyed by string, held in a module-level `Map`. Test that the 6th call within the window is refused and that the window resets.

Document in the file's header comment: this is per-instance memory, so it is a speed bump rather than a distributed guarantee; the production answer is Upstash Redis, named in the README's next-steps.

- [ ] **Step 2: Build the login page and magic-link action**

`signInWithMagicLink(formData)` — Zod-validate the email, rate-limit by email, call `supabase.auth.signInWithOtp` with `emailRedirectTo` pointing at `/api/auth/confirm`. Always return the same neutral message whether or not the address exists — no account enumeration.

Render the Supabase rate-limit error honestly if it comes back: "Supabase's free mailer is rate limited — use the demo sign-in below."

- [ ] **Step 3: Build the demo sign-in actions**

Two server actions, `signInAsDemoCustomer` and `signInAsDemoAdmin`. Each generates a magic link server-side via the admin client's `auth.admin.generateLink({ type: 'magiclink', email })`, then immediately exchanges the returned token hash with `supabase.auth.verifyOtp` on the server, establishing the session — no email is sent and no password exists.

Rate-limit both to 5 per minute per IP. Guard both so they only ever accept the two seeded demo addresses from env, never arbitrary input.

- [ ] **Step 4: Implement `/api/auth/confirm`**

Exchange `token_hash` + `type` from the query string via `verifyOtp`, then redirect to `next` — validated to be a same-origin relative path, to prevent open redirect.

- [ ] **Step 5: Implement middleware**

Refresh the Supabase session cookie on every request. Redirect signed-out visitors away from `/account`, `/checkout` and `/admin`. Add a header comment stating this is UX only and that real enforcement lives in `requireUser`/`requireAdmin`.

- [ ] **Step 6: Verify both paths**

Click "Sign in as demo customer" and confirm a session is established and the header shows the account link. Confirm `/admin` redirects a customer away.

```bash
git checkout -b feat/auth
git add -A && git commit -m "feat: add magic-link auth with demo sign-in and rate limiting"
git push -u origin feat/auth && gh pr create --fill
```

- [ ] **Step 7: Study note**

`~/Desktop/trezuz-study-notes/05-auth.md`: how magic links work; why the demo buttons exist (Supabase free-tier mail limits) and why they cannot be used to sign in as anyone else; why middleware is not security. Likely question: *"Could I pass any email to the demo action and become that user?"*

---

## Task 6: Cart

**Branch:** `feat/cart`

**Files:**
- Create: `frontend/src/lib/cart/store.ts` + test
- Create: `frontend/src/components/commerce/add-to-cart.tsx`, `cart-contents.tsx`
- Create: `frontend/src/app/cart/page.tsx`
- Modify: `frontend/src/app/plans/[slug]/page.tsx` (replace the Task 4 placeholder button)

**Interfaces:**
- Produces: `useCart()` returning `{ items: CartItem[], add(planId, qty), remove(planId), setQty(planId, qty), clear(), count }` where `CartItem = { planId: string; qty: number }`. **No price is stored in the cart** — prices are looked up server-side at checkout.

- [ ] **Step 1: Write the cart reducer test first**

Test the pure reducer, not the React hook: adding a new plan appends; adding an existing plan increments; `setQty(0)` removes; `clear` empties; a corrupt `localStorage` payload yields an empty cart rather than throwing.

- [ ] **Step 2: Implement the store**

Plain React `useState` + `useEffect` persistence to `localStorage` under key `easim.cart.v1`, exposed through a Context provider. No state library — the cart is four operations and a list.

Parse the persisted value with a Zod schema; on failure, reset to empty. A user can edit `localStorage`, so treat it as untrusted input.

- [ ] **Step 3: Build the cart page**

Client component reading the cart, then fetching current plan details for those IDs from a Server Component parent. Show line items, quantities, subtotal (display only — authoritative totals are computed at checkout), remove buttons, an empty state, and a Checkout button.

- [ ] **Step 4: Verify and commit**

Add two plans, reload the page, confirm the cart survives. Corrupt `localStorage` manually and confirm the page still renders.

```bash
git checkout -b feat/cart
git add -A && git commit -m "feat: add client-side cart with validated persistence"
git push -u origin feat/cart && gh pr create --fill
```

- [ ] **Step 5: Study note**

`~/Desktop/trezuz-study-notes/06-cart.md`: why the cart is client-side and has no database table; why it stores no prices; what happens if a user edits localStorage.

---

## Task 7: Checkout and order creation

**Branch:** `feat/checkout-orders`

**Files:**
- Create: `frontend/src/app/checkout/page.tsx`, `frontend/src/app/checkout/actions.ts`
- Create: `frontend/src/lib/orders/create.ts` + test
- Create: `frontend/src/components/commerce/scenario-selector.tsx`
- Modify: `frontend/src/lib/schemas.ts`

**Interfaces:**
- Consumes: `calculateTotals` (Task 3), `assertTransition` (Task 3), `requireUser` (Task 5)
- Produces: `createOrder(input: CreateOrderInput): Promise<{ orderId: string }>` where `CreateOrderInput = { userId: string; items: { planId: string; qty: number }[]; idempotencyKey: string; scenario: PaymentScenario }` and `type PaymentScenario = 'approve' | 'decline' | 'timeout' | 'provider_failure'`

**Absolute constraint:** the checkout form contains an email (read-only, from the session), a scenario selector, and a submit button. **No card fields. None.**

- [ ] **Step 1: Write the order creation test**

Cover: prices are read from the database and the client-supplied price is ignored entirely; totals match `calculateTotals`; the same idempotency key twice returns the same order ID and creates exactly one row; an unknown or inactive plan ID is rejected; an empty cart is rejected.

- [ ] **Step 2: Implement `createOrder`**

Within one Supabase call sequence: look up all plans by ID in a single query, reject if any are missing or inactive, compute totals server-side, insert `orders` with `status: 'created'` and `payment_deadline_at = now() + 90 seconds`, insert `order_items` with the looked-up prices.

On a unique-violation of `(user_id, idempotency_key)`, select and return the existing order instead of erroring. That is the idempotency guarantee, and it needs its own test.

- [ ] **Step 3: Build the checkout Server Action**

`placeOrder(formData)`: `requireUser`, Zod-parse the cart payload and scenario, call `createOrder`, transition `created → awaiting_payment`, then call the provider client (Task 8) to authorize. Redirect to `/orders/[id]`.

Until Task 8 exists, the provider call is a typed function stub that throws `Not implemented` — and Task 8's first step is to replace it. Note this explicitly in the commit message.

- [ ] **Step 4: Build the checkout page**

Order summary from the cart, the scenario selector with plain-language labels ("Approve", "Decline the payment", "Never respond (timeout)", "Succeed, then fail to provision"), and a prominent note that this is a mock payment service and no card data is collected anywhere.

- [ ] **Step 5: Verify and commit**

Place an order and confirm one `orders` row plus matching `order_items` with server-side prices. Submit twice rapidly with the same key and confirm exactly one order exists.

```bash
git checkout -b feat/checkout-orders
git add -A && git commit -m "feat: add checkout with server-side pricing and idempotent order creation"
git push -u origin feat/checkout-orders && gh pr create --fill
```

- [ ] **Step 6: Study note**

`~/Desktop/trezuz-study-notes/07-checkout.md`: what a Server Action is; what an idempotency key is and the exact bug it prevents; why the brief bans card fields and how the scenario selector replaces them.

---

## Task 8: Mock provider service

**Branch:** `feat/mock-provider`

**Files:**
- Create: `backend/package.json`, `backend/src/index.ts`, `payments.ts`, `esim.ts`, `hmac.ts`
- Create: `frontend/src/app/api/mock-provider/[...path]/route.ts`
- Create: `frontend/src/lib/provider/client.ts`, `frontend/src/lib/security/hmac.ts` + test
- Modify: `frontend/src/app/checkout/actions.ts` (replace the Task 7 stub)

**Interfaces:**
- Produces:
  - `handleProviderRequest(request: Request): Promise<Response>` — the package's only export
  - `authorizePayment(input): Promise<{ providerRef: string }>` in `lib/provider/client.ts`
  - `provisionEsim(input): Promise<{ iccid: string; activationCode: string }>` — throws `ProviderError` on 5xx
  - `sign(body: string, timestamp: string, secret: string): string` and `verify(...): boolean` in both `hmac.ts` files

**On the duplicated `hmac.ts`:** the store and the provider each implement signing independently, by design. They are meant to be separate services that agree on a wire protocol, not one codebase sharing a helper. Twenty-five duplicated lines is a smaller cost than a shared package that would have to be untangled when the provider moves to its own deployment. Say exactly this if asked.

- [ ] **Step 1: Write the HMAC test first**

Cover: a signature verifies against the same body and secret; a modified body fails; a wrong secret fails; a timestamp older than 5 minutes fails; comparison uses `crypto.timingSafeEqual` and both buffers are length-checked before comparing.

- [ ] **Step 2: Implement `hmac.ts`**

```ts
import { createHmac, timingSafeEqual } from 'node:crypto'

const MAX_SKEW_MS = 5 * 60 * 1000

export function sign(body: string, timestamp: string, secret: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
}

export function verify(
  body: string, timestamp: string, signature: string, secret: string, now = Date.now(),
): boolean {
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(now - ts) > MAX_SKEW_MS) return false
  const expected = Buffer.from(sign(body, timestamp, secret))
  const received = Buffer.from(signature)
  if (expected.length !== received.length) return false
  return timingSafeEqual(expected, received)
}
```

Signing `${timestamp}.${body}` rather than the body alone is what stops a captured signature being replayed later with a fresh timestamp.

- [ ] **Step 3: Build the provider package**

`backend/package.json` with `"name": "@easim/mock-provider"`, `"main": "src/index.ts"`, no build step. Add it to `frontend`'s dependencies as `"@easim/mock-provider": "workspace:*"` and add `transpilePackages: ['@easim/mock-provider']` to `next.config.ts`.

`handleProviderRequest` routes on `new URL(request.url).pathname`:

- `POST .../payments/authorize` — validate the body, respond `202 { providerRef }` immediately, then **after responding** schedule the callback:
  - `approve` → wait 2s, POST `payment.succeeded` to `APP_BASE_URL/api/webhooks/payment`
  - `decline` → wait 2s, POST `payment.declined`
  - `timeout` → never call back at all
  - `provider_failure` → wait 2s, POST `payment.succeeded` (the failure comes later, at provisioning)
- `POST .../esim/provision` — returns 503 when the order's scenario is `provider_failure`, otherwise a generated ICCID and activation code

Every callback body carries a unique `event_id` (a UUID) and is signed with `PROVIDER_HMAC_SECRET`.

- [ ] **Step 4: Mount it in the Next app**

```ts
import { handleProviderRequest } from '@easim/mock-provider'

export const POST = (request: Request) => handleProviderRequest(request)
export const GET = (request: Request) => handleProviderRequest(request)
```

Three lines. Moving the provider to its own deployment later means giving these same three lines their own project and changing `PROVIDER_BASE_URL`.

- [ ] **Step 5: Build the store's provider client**

`authorizePayment` POSTs to `${PROVIDER_BASE_URL}/payments/authorize` with a 5s `AbortSignal.timeout`. `provisionEsim` POSTs to `/esim/provision` and throws `ProviderError` with the status code on any non-2xx. No retry logic here — retry belongs to fulfilment (Task 9).

- [ ] **Step 6: Replace the Task 7 stub and verify end to end**

Place an approve order and confirm the provider receives it and the webhook endpoint is hit (it will 404 until Task 9 — that is expected and is the next task's first step).

```bash
git checkout -b feat/mock-provider
git add -A && git commit -m "feat: add mock provider service with signed asynchronous callbacks"
git push -u origin feat/mock-provider && gh pr create --fill
```

- [ ] **Step 7: Study note**

`~/Desktop/trezuz-study-notes/08-mock-provider.md`: what a webhook is; what HMAC signing proves and what it does not; why the timestamp is inside the signature; why the provider is a separate package. Likely question: *"How do you know the callback really came from the provider?"*

---

## Task 9: Webhook, idempotency and automatic fulfilment

**Branch:** `feat/webhooks-fulfilment`

The graded core. Nothing here may be hurried.

**Files:**
- Create: `frontend/src/app/api/webhooks/payment/route.ts`
- Create: `frontend/src/lib/orders/fulfilment.ts` + test
- Modify: `frontend/src/lib/schemas.ts`

**Interfaces:**
- Consumes: `verify` (Task 8), `assertTransition` (Task 3), `createAdminClient` (Task 2), `provisionEsim` (Task 8)
- Produces: `fulfilOrder(orderId: string): Promise<void>` — idempotent, safe to call repeatedly; `recordWebhookEvent(eventId, type, payload): Promise<'new' | 'duplicate'>`

- [ ] **Step 1: Write the webhook behaviour tests**

Cover, with the Supabase admin client mocked:
- an unsigned request is rejected `401` and writes nothing
- a request with a valid signature but a stale timestamp is rejected `401`
- a first-time `event_id` is processed and the order becomes `paid`
- **the same `event_id` twice returns `200` and fulfils exactly once** — assert the provision call happened once
- a `payment.declined` event moves the order to `payment_declined` and never touches inventory
- an event for an unknown order returns `200` (acknowledge, do not make the provider retry forever) and logs

- [ ] **Step 2: Implement the route**

Order of operations, and this order is the point:

1. Read the **raw** body text before parsing — the signature covers bytes, not a re-serialised object.
2. `verify` the signature and timestamp. Fail → `401`, no writes.
3. Zod-parse the payload.
4. Insert into `webhook_events`. A unique violation on `provider_event_id` means duplicate → return `200` immediately, do nothing else.
5. Load the order, `assertTransition` to the new status, update.
6. On `paid`: call `fulfilOrder(orderId)` inside `after()` so the provider gets its `200` promptly and a slow provisioning call cannot cause the provider to retry.
7. Stamp `processed_at`.

- [ ] **Step 3: Write the fulfilment tests**

Cover: a successful claim marks the profile `consumed` and writes a `fulfilments` row; exhausted stock produces `fulfilment_failed` with reason `out_of_stock` **and leaves the order paid, not lost**; a provider 503 produces `fulfilment_failed` and increments `attempts`; calling `fulfilOrder` twice on an already-fulfilled order provisions nothing the second time.

- [ ] **Step 4: Implement `fulfilOrder`**

For each order item without a succeeded fulfilment:
1. `assertTransition(order.status, 'fulfilling')` and update.
2. `rpc('claim_esim_profile', { p_plan_id })`. No row → record `fulfilment_failed`, reason `out_of_stock`, stop.
3. `provisionEsim(...)`. Throws → increment `attempts`, store `last_error`, set `next_attempt_at` with backoff (2s, 8s, 32s), status `fulfilment_failed`. Release the reserved profile back to `available` so it is not stranded.
4. Success → profile `consumed`, `fulfilments` row `succeeded` with `esim_profile_id`.
5. All items succeeded → order `fulfilled`. Any failed → order `fulfilment_failed`.

Wrap steps 2–4 so an exception can never leave an order in `fulfilling` forever: catch, record failure, rethrow only after the state is written.

- [ ] **Step 5: Retry inline**

Inside `after()`, on failure with `attempts < 3`, wait the backoff and call `fulfilOrder` again. Three attempts maximum, then leave it for a reader or an admin (Task 10, Task 12).

- [ ] **Step 6: Verify all four scenarios by hand**

Approve → `fulfilled` with a credential. Decline → `payment_declined`, inventory untouched. Timeout → stuck in `awaiting_payment` (Task 10 reconciles it). Provider failure → `paid` then `fulfilment_failed`, order still visible.

Then replay a real callback with `curl`, reusing the same `event_id`, and confirm exactly one credential exists.

```bash
git checkout -b feat/webhooks-fulfilment
git add -A && git commit -m "feat: add idempotent payment webhook and automatic fulfilment"
git push -u origin feat/webhooks-fulfilment && gh pr create --fill
```

- [ ] **Step 7: Study note**

`~/Desktop/trezuz-study-notes/09-webhook-fulfilment.md` — the most important note. Walk the whole path from callback to delivered QR. Explain the three idempotency layers and which bug each prevents. Explain why raw body before parse. Explain why the order survives a provider outage. Likely questions: *"Why does the webhook return 200 for a duplicate instead of an error?"* and *"What happens if the server dies midway through fulfilment?"*

---

## Task 10: Order status page with live updates and lazy reconciliation

**Branch:** `feat/order-status`

**Files:**
- Create: `frontend/src/app/orders/[id]/page.tsx`
- Create: `frontend/src/components/commerce/order-status.tsx`, `esim-credential.tsx`
- Create: `frontend/src/lib/orders/reconcile.ts` + test

**Interfaces:**
- Produces: `reconcileOrder(order): Promise<Order>` — transitions `awaiting_payment` past its deadline to `payment_timeout`, retries a `fulfilment_failed` order whose backoff has elapsed, otherwise returns the order unchanged

- [ ] **Step 1: Write the reconciliation tests**

Cover: an `awaiting_payment` order past `payment_deadline_at` becomes `payment_timeout`; one before its deadline is untouched; a `fulfilment_failed` order with `attempts < 3` and an elapsed `next_attempt_at` triggers a retry; one with `attempts >= 3` does not; terminal orders are never touched.

- [ ] **Step 2: Implement `reconcileOrder` and call it on every order read**

Called from the order page, the account page and the admin page, before rendering. This is the entire replacement for a cron (spec §6.5).

- [ ] **Step 3: Build the order page**

Dynamic Server Component, `requireUser`, 404 for an order belonging to someone else (via RLS returning nothing — not a manual check). Renders the receipt: items, totals, status, and per-state explanatory copy.

- [ ] **Step 4: Add live status**

A client island subscribing to Supabase Realtime on that order row, falling back to polling every 3 seconds if the subscription fails. Watching `paid → fulfilling → fulfilled` happen without a refresh is the demo — make it visibly animate.

Enable Realtime on the `orders` table in the Supabase dashboard.

- [ ] **Step 5: Build the credential display**

QR code rendered from the activation code. Install `qrcode` (`pnpm --filter frontend add qrcode` plus its types) and render server-side to a data URI.

**Render the QR on a white background even in dark theme** — scanners need the contrast. The surrounding card can be dark; the code itself cannot be.

Show the ICCID with a copy button.

- [ ] **Step 6: Verify and commit**

Place a timeout order, watch the page flip to `payment_timeout` after 90 seconds. Place an approve order and watch it reach `fulfilled` live.

```bash
git checkout -b feat/order-status
git add -A && git commit -m "feat: add live order status with reader-driven reconciliation"
git push -u origin feat/order-status && gh pr create --fill
```

- [ ] **Step 7: Study note**

`~/Desktop/trezuz-study-notes/10-order-status.md`: what lazy reconciliation is and why it replaces a cron here; what Supabase Realtime is; why the QR needs a light background. Likely question: *"What if nobody ever opens the page?"*

---

## Task 11: Account and order history

**Branch:** `feat/account`

**Files:**
- Create: `frontend/src/app/account/page.tsx`
- Modify: `frontend/src/components/site/header.tsx`

- [ ] **Step 1: Build the account page**

Dynamic Server Component, `requireUser`, reconcile each loaded order. Two sections: **My eSIMs** (every succeeded fulfilment with its QR and ICCID) and **Order history** (every order, newest first, with status badge and a link to its receipt).

Empty state links to `/plans`.

- [ ] **Step 2: Confirm isolation**

Sign in as the demo customer, note an order ID, sign in as the admin, and confirm requesting the customer's order URL returns not-found through RLS rather than through a hand-written check.

```bash
git checkout -b feat/account
git add -A && git commit -m "feat: add customer account with order history and delivered eSIMs"
git push -u origin feat/account && gh pr create --fill
```

- [ ] **Step 3: Study note**

`~/Desktop/trezuz-study-notes/11-account.md`: how the account page gets only this user's rows without a `where user_id = ...` in the application code.

---

## Task 12: Admin view with manual retry

**Branch:** `feat/admin`

**Files:**
- Create: `frontend/src/app/admin/page.tsx`, `frontend/src/app/admin/actions.ts`

- [ ] **Step 1: Build the admin list**

`requireAdmin` first, before any query. All orders newest first: ID, customer email, total, status badge, item count, created time. Filter by status, defaulting to a "needs attention" view of `fulfilment_failed`.

- [ ] **Step 2: Build the retry action**

`retryFulfilment(orderId)`: `requireAdmin`, reset `attempts` to 0 and clear `next_attempt_at`, call `fulfilOrder`, write an `admin_actions` row, `revalidatePath('/admin')`.

Rate-limit it. Return a typed result so the UI can show what happened rather than silently refreshing.

- [ ] **Step 3: Verify the full recovery story**

Place a `provider_failure` order, watch it reach `fulfilment_failed`, then in the mock provider flip that order's scenario so provisioning succeeds, click retry, and confirm the order reaches `fulfilled` and the credential appears in the customer's account. **This is the single most valuable demo in the submission** — the order was never lost.

Also confirm a signed-in non-admin calling the action directly is refused.

```bash
git checkout -b feat/admin
git add -A && git commit -m "feat: add admin order view with manual fulfilment retry"
git push -u origin feat/admin && gh pr create --fill
```

- [ ] **Step 4: Study note**

`~/Desktop/trezuz-study-notes/12-admin.md`: what makes an admin an admin here and the three places it is enforced. Likely question: *"What stops a customer calling the retry action?"*

---

## Task 13: Legal pages, cookie consent, security headers

**Branch:** `feat/legal-cookies`

**Files:**
- Create: `frontend/src/app/legal/{terms,refunds,privacy,contact}/page.tsx`
- Create: `frontend/src/components/site/cookie-banner.tsx`
- Create: `frontend/src/lib/security/headers.ts`
- Modify: `frontend/next.config.ts`, `frontend/src/app/layout.tsx`

- [ ] **Step 1: Write the four legal pages**

Static Server Components. Terms, refund policy (state plainly that eSIM credentials are non-refundable once delivered, with the pre-delivery exception), privacy (what is stored: email, orders, eSIM assignments; no card data is collected because there is no gateway), and contact.

Each page must state that this is an assessment demonstration and processes no real payments. Honesty here is worth more than polish.

- [ ] **Step 2: Build the cookie banner**

Two categories: strictly necessary (session cookie, always on, explained) and analytics (default off). Choice persisted in a first-party cookie for a year. A settings link in the footer reopens it.

Nothing beyond the session cookie may load before consent. Vercel Web Analytics — free on Hobby — mounts only when analytics consent is granted.

- [ ] **Step 3: Add security headers**

In `next.config.ts`: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy` denying camera, microphone and geolocation, and a Content-Security-Policy.

Build and load every page with the console open; a CSP that breaks the app is worse than none. Tighten until it is both strict and working.

- [ ] **Step 4: Confirm the Task 4 footer links now resolve**

All four legal links must return 200.

```bash
git checkout -b feat/legal-cookies
git add -A && git commit -m "feat: add legal pages, cookie consent and security headers"
git push -u origin feat/legal-cookies && gh pr create --fill
```

- [ ] **Step 5: Study note**

`~/Desktop/trezuz-study-notes/13-legal-security.md`: what each security header defends against, in one line each; why consent must gate loading rather than just hide a banner.

---

## Task 14: Design system and motion

**Branch:** `feat/design-system`

Only start this once Tasks 1–13 are merged and the pipeline works end to end. This is the part that gets cut if time runs short — by design.

**Files:**
- Modify: `frontend/src/app/globals.css`, every page and component
- Create: `frontend/public/` brand imagery

**Direction (spec, approved):** dark cinematic infrastructure. Deep charcoal ground, restrained accent, precise typography, generous space, motion that clarifies rather than decorates.

- [ ] **Step 1: Establish tokens in `globals.css`**

Tailwind v4 `@theme` tokens: a neutral ramp, one accent, semantic status colours mapping to the order states, a type scale, and a spacing rhythm. Every later step uses tokens — no arbitrary hex values in components.

- [ ] **Step 2: Generate brand imagery with Higgsfield**

An abstract orbital/network hero image and a subtle texture. Dark, restrained, no text baked in. Export to `frontend/public/`, compress, and serve through `next/image`.

- [ ] **Step 3: Pull refined components from 21st.dev where they beat hand-rolling**

Only where they genuinely help — badges, dialog, toast. Do not import a component library wholesale; each addition must be justified.

- [ ] **Step 4: Apply the direction across the site**

Landing hero, plan cards with hover elevation, checkout, and above all the order status timeline — that page is the demo and deserves the most attention.

- [ ] **Step 5: Add motion**

Order status transitions animate between states. Cards lift on hover. Page transitions stay subtle. Everything respects `prefers-reduced-motion` — no exceptions.

- [ ] **Step 6: Check contrast and responsiveness**

WCAG AA on every text/background pair. Test at 375px, 768px and 1440px. The QR stays on white.

```bash
git checkout -b feat/design-system
git add -A && git commit -m "feat: apply dark cinematic design system and motion"
git push -u origin feat/design-system && gh pr create --fill
```

- [ ] **Step 7: Study note**

`~/Desktop/trezuz-study-notes/14-design.md`: what a design token is and why components never hardcode colour; which parts are AI-generated (for the README's AI disclosure).

---

## Task 15: End-to-end tests, README, deploy, verification

**Branch:** `feat/tests-docs`

**Files:**
- Create: `frontend/e2e/order.spec.ts`, `frontend/playwright.config.ts`
- Create: `README.md`

- [ ] **Step 1: Install and configure Playwright**

```bash
pnpm --filter frontend add -D @playwright/test && pnpm --filter frontend exec playwright install chromium
```

- [ ] **Step 2: Write the four end-to-end tests**

One per required path: happy order through to a visible QR and ICCID; decline; timeout (with the deadline shortened by env for the test); provider failure followed by an admin retry reaching `fulfilled`.

Each test signs in via the demo button, which is exactly the route a reviewer will take.

- [ ] **Step 3: Run them green**

Run: `pnpm --filter frontend exec playwright test`
Expected: 4 passed. A flaky timeout test means the deadline needs to be configurable, not that the test should be deleted.

- [ ] **Step 4: Write the README**

Sections: what this is and which track; live URL; architecture with the request path from click to delivered QR; local setup from a clean clone; **how to place an order end to end**; **how to trigger a decline, a timeout, and a provider failure** — each with exact click-by-click steps; the order state diagram; how idempotency works; security notes; **where AI tooling was used**, honestly and specifically; known limitations (magic-link mail limits, reader-driven reconciliation, in-memory rate limiting); and what would come next.

The email asks for items 3 and 4 explicitly — they must be findable in under ten seconds by someone skimming.

- [ ] **Step 5: Deploy to Vercel**

Import the repo, set the environment variables in the Vercel dashboard (`PROVIDER_BASE_URL` and `APP_BASE_URL` point at the production URL), deploy, and update Supabase Auth's redirect allow-list to include the production origin.

- [ ] **Step 6: Verify on production, not locally**

Run all four scenarios against the live URL as a signed-out visitor would. Confirm: no secret appears in any client bundle (search the deployed JS for `service_role`), every legal page loads, the cookie banner appears on a fresh session, and the admin view is unreachable for a customer.

- [ ] **Step 7: Final trace against the brief**

Walk spec §1's requirement table line by line against the deployed site. Every row must be demonstrable. Anything unmet goes in the README's limitations section rather than being quietly omitted.

```bash
git checkout -b feat/tests-docs
git add -A && git commit -m "feat: add end-to-end tests and submission README"
git push -u origin feat/tests-docs && gh pr create --fill
```

- [ ] **Step 8: Final study note**

`~/Desktop/trezuz-study-notes/00-walkthrough.md` — the one to read before the call. A single narrative from "customer clicks buy" to "QR appears in account", naming every file the request passes through in order, plus the ten questions most likely to be asked with a two-sentence answer each.

---

## Self-Review

**Spec coverage.** Every section maps to a task: §2 catalogue → Tasks 2, 4 · §3 data model → Task 2 · §4 provider → Task 8 · §5 auth → Task 5 · §6.1 state machine → Task 3 · §6.2 fulfilment → Task 9 · §6.3 scenarios → Tasks 8, 9 · §6.4 idempotency → Tasks 7, 9 · §6.5 reconciliation → Tasks 10, 12 · §7 rendering → Tasks 4, 6, 7, 10, 11, 12 · §8 security → Tasks 1, 2, 5, 8, 13 · §9 legal → Task 13 · §10 testing → Tasks 3, 9, 15 · §11 branches → every task header · §12 deliverables → Task 15 · §16 cost → Global Constraints.

**Known deliberate incompleteness.** Task 4 leaves a placeholder Add-to-Cart button and dead legal links; Task 7 leaves a throwing provider stub. Each is replaced by an explicitly named later task (6, 13, 8 respectively) whose first step is the replacement. These are sequencing artefacts, not unfinished work.

**Type consistency.** `OrderStatus` values match the Postgres enum in `0001_schema.sql` exactly, including the single-`l` `fulfilment`. `PaymentScenario` is identical in the checkout action, the provider client and the provider package. `calculateTotals` returns `{ subtotalCents, totalCents }` and is consumed under those names in `createOrder`. `claim_esim_profile` takes `p_plan_id` in the SQL and is called with that key from `fulfilment.ts`.

# Easim — prepaid eSIM store

**Track A (eSIM)** of the Trezuz Full Stack Developer home task.

A shop that sells eight eSIM data plans, takes an order through checkout,
confirms the payment by an asynchronous callback from a mock provider, and
provisions and delivers the eSIM automatically — surviving a decline, a
timeout, a provider outage and stock exhaustion without ever losing an order.

| | |
|---|---|
| **Live URL** | **https://easim.vercel.app** |
| **Repo** | https://github.com/CClerides/easim |
| **Stack** | Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, RLS, Realtime) · Vercel |
| **Tests** | 113 unit + integration (Vitest), 8 end-to-end (Playwright) |

---

## Start here — how to place an order end to end

1. Open the live URL and go to **Plans**.
2. Pick any plan → **Add to cart** → **Cart** → **Checkout**.
3. You will be asked to sign in. Press **“Sign in as customer”**.
   *(Magic link works too, but Supabase's free mailer is rate limited — see
   [Known limitations](#known-limitations). The demo button is the reliable
   route and needs no email.)*
4. Leave the payment outcome on **Approve** and press **Place order**.
5. You land on the order page. **Do not refresh.** Within a few seconds it
   moves itself to *eSIM delivered* and the QR code and ICCID appear.
6. **Account** shows the same eSIM and the order history.

> The confirmation that advances that order does **not** come from your
> browser. The provider calls the server directly. You can close the tab at
> step 5 and the order still completes.

## How to trigger a decline, a timeout, and a provider failure

All four outcomes are chosen on the checkout page, where a real shop would
have card fields. **This site has no card fields anywhere** — the brief
forbids them, so a scenario selector takes their place.

| To see | Choose at checkout | What happens |
|---|---|---|
| **Declined payment** | *Decline* | The provider calls back `payment.declined` after ~2s. Order → **Declined**. Nothing charged, no eSIM issued, no stock touched. |
| **Payment timeout** | *Never respond* | The provider deliberately never calls back. **Wait ~90 seconds** on the order page. It moves itself to **Timed out**. There is no scheduler — see [Reconciliation](#reconciliation-without-a-scheduler). |
| **Provider failure** | *Pay, then fail to provision* | Payment succeeds, provisioning returns `503`. The order stays **paid**, shows *“your payment went through… your order is safe”*, records `provider_503`, and retries three times before waiting for an admin. |

### And the recovery, which is the interesting half

After triggering **provider failure**:

1. **Sign out**, then **“Sign in as admin”** on the login page.
2. The admin view opens on *Needs attention* and shows that order with
   `provider_503 (attempt 3)` — the automatic retries genuinely exhausted.
3. Press **Retry delivery**. The order is fulfilled, a real eSIM is issued,
   and the action is written to an audit table.
4. Sign back in as the customer: the eSIM is on that same order.

**The order was never lost at any point.** That is the behaviour the whole
design exists to protect.

### Stock exhaustion (bonus, not required)

`usa-3gb-7d` is seeded with exactly **one** eSIM. Buy it twice: the second
order pays successfully and then fails with `out_of_stock` — the same
non-losing path as a provider outage, recoverable once stock returns.

---

## Architecture

### The path of one order

```
1. Browser    → checkout/actions.ts      "buy these plan ids"
2. Server     → lib/orders/create.ts     looks up real prices, writes the order
3. Server     → lib/provider/client.ts   "authorise €14.90"        (HTTP)
4. Provider   → 202 Accepted             "received, I'll tell you later"
5. Browser    → redirected to receipt    status: awaiting payment
   ───────────── the browser is now irrelevant ─────────────
6. ~2 seconds pass
7. Provider   → POST /api/webhooks/payment  "succeeded"  (HMAC-signed)
8. Server     → lib/orders/fulfilment.ts    claims an eSIM, provisions it
9. Server     → order `fulfilled`, QR appears in the account
```

Steps 7–9 involve no browser at all.

### Two packages

```
frontend/   the store (Next.js)
backend/    @easim/mock-provider — the "outside world"
db/         SQL migrations, RLS policies, seed
```

The store reaches the provider **only over HTTP**, at `PROVIDER_BASE_URL`,
and imports nothing from it but request types. Today the provider is mounted
inside the app at `/api/mock-provider/*` by a three-line file
([route.ts](frontend/src/app/api/mock-provider/%5B...path%5D/route.ts)).
Giving it its own deployment means copying those three lines into a new
project and changing one environment variable — no refactor, because there is
no shared code to untangle.

### Order state machine

```
created ──→ awaiting_payment ──┬──→ payment_declined   (terminal)
                               ├──→ payment_timeout    (terminal)
                               └──→ paid ──→ fulfilling ──┬──→ fulfilled (terminal)
                                                          │
                                          retry ←─────────┴──→ fulfilment_failed
```

One transition table in [`lib/orders/status.ts`](frontend/src/lib/orders/status.ts)
governs every status change. Illegal moves throw rather than silently writing.

`fulfilment_failed` is **not** terminal: the customer has paid, so that order
must stay recoverable.

### Idempotency — three independent layers

A payment provider is entitled to deliver the same event twice. Any one of
these would be enough; all three exist because this is the failure that costs
real money.

| Layer | Mechanism | Prevents |
|---|---|---|
| Checkout | `orders (user_id, idempotency_key)` UNIQUE | A double-clicked button creating two orders |
| Callback | `webhook_events.provider_event_id` UNIQUE | The same event being processed twice |
| Delivery | `fulfilments.order_item_id` UNIQUE | The same line item being delivered twice |

All three are database constraints, so no race between concurrent requests can
defeat them. The duplicate check *is* the insert failing — a `SELECT`-then-
`INSERT` would leave a gap two simultaneous callbacks could both pass through.

A duplicate callback answers **`200`, not an error**: a provider that receives
an error retries forever, and nothing is actually wrong.

### Reconciliation without a scheduler

**There is no cron job in this project.** Vercel's Hobby plan runs cron once a
day, which is useless for a 90-second deadline, and a paid plan was out of
budget for an assessment.

Instead, *reading* an order brings it up to date. The receipt, the account and
the admin view all call `reconcileOrder` before rendering: an order past its
payment deadline becomes `payment_timeout` there and then, and a failed
delivery whose backoff has elapsed is retried.

That works because the people who care about an order are the ones looking at
it. **The honest trade-off:** an order nobody ever opens stays stale. A durable
queue is the production answer, and it is in [next steps](#what-i-would-do-next).

### Rendering — chosen per surface

| Surface | Strategy | Why |
|---|---|---|
| Landing, catalogue, legal | Server Components; plan data cached 1h under a tag | Public and identical for everyone |
| Stock counts | Server, never cached | A plan shown in stock when it isn't walks a customer into a failed checkout |
| Cart | Client, `localStorage` | Purely local state until it becomes an order |
| Checkout | Server Action | Prices resolved server-side only |
| Order status | Dynamic SSR + Realtime + poll | The least cacheable thing in the app |
| Account, admin | Dynamic SSR, RLS-scoped | Never cacheable, never client-trusted |

Client components are pushed to the leaves: the header and footer are Server
Components, and only the cart count and cookie button ship to the browser.

**Being precise about what "cached" means here:** every *route* renders on
demand — `next build` reports them all as dynamic — because the header reads
the session to decide between "Sign in" and "Account". What is cached is the
*data*: the catalogue query is memoised for an hour under a `plans` tag, so a
price change can invalidate it immediately with `revalidateTag`. Making the
public pages genuinely static would mean moving the session-dependent part of
the header into its own client island, which is listed in
[next steps](#what-i-would-do-next).

---

## Security

**The key in the browser is worth almost nothing.** Row level security is
enabled on every table, and the policies grant `SELECT` and nothing else —
there is no `INSERT`, `UPDATE` or `DELETE` policy anywhere in
[`0002_rls.sql`](db/migrations/0002_rls.sql). That absence is the design: with
RLS on, anything unpoliced is denied.

- **Browser** (publishable key): reads your own rows, writes nothing, anywhere.
- **Server** (secret key): every write, after `requireUser()` / `requireAdmin()`
  or a verified HMAC signature.

Ten tests in [`rls.test.ts`](frontend/src/lib/supabase/rls.test.ts) prove it
against the live project using only the publishable key — including that a
signed-out visitor cannot harvest unsold eSIM credentials and cannot mark an
order paid.

Other measures:

- `SUPABASE_SECRET_KEY` is reachable only through a module marked
  `import 'server-only'`, so importing it into a client component is a **build
  error**, not a runtime leak.
- Webhooks verify HMAC-SHA256 over `timestamp.body` with a ±5 minute window and
  `timingSafeEqual`. Signing the timestamp is what stops a captured request
  being replayed later.
- The webhook reads the **raw body** before parsing — the signature covers exact
  bytes.
- `webhook_events` has RLS enabled and *no policy at all*: invisible to the
  browser rather than merely filtered.
- Zod validation at every boundary, including `localStorage`, which is
  user-editable and therefore untrusted input.
- Authorisation lives in `requireUser()` / `requireAdmin()`, called explicitly.
  **The proxy (formerly middleware) only redirects for the sake of the experience** — delete it and
  nothing becomes readable.
- `requireAdmin()` redirects to `/` rather than showing a "forbidden" page,
  which would confirm `/admin` exists.
- Magic-link responses are identical whether or not the address is registered,
  so the form cannot enumerate customers.
- Six security headers including a CSP; cookie consent gates *loading*, not just
  visibility — decline and the analytics script is never fetched.
- No card number, expiry or security-code field exists anywhere in this
  codebase. There is an end-to-end test asserting it.

---

## Running it locally

**Prerequisites:** Node 20+, pnpm, a free Supabase project.

```bash
git clone https://github.com/CClerides/easim.git
cd easim
pnpm install
```

Apply the database, in order, by pasting each into the Supabase SQL editor:

```
db/migrations/0001_schema.sql
db/migrations/0002_rls.sql
db/migrations/0003_functions.sql
db/seed.sql
```

Create two users in Supabase → Authentication → Users, with **Auto Confirm**:
`demo@easim.dev` and `admin@easim.dev`. Then re-run `db/seed.sql`, which
backfills their profile rows and grants the admin role.

Copy the environment file and fill it in:

```bash
cp .env.example frontend/.env.local
```

```bash
pnpm dev
```

### Tests

```bash
pnpm test
```

113 unit and integration tests. The integration ones run against the real
Supabase project and the real mock provider — the guarantees being tested are
database constraints and an HTTP boundary, so mocking either would test the
mock. They return every eSIM they consume and run sequentially, because they
share one finite pool.

```bash
pnpm e2e
```

8 Playwright tests walking the four journeys above through the real UI. Point
them at production with `BASE_URL=https://… pnpm e2e`.

---

## Where AI tooling was used

I used **Claude Code (Opus)** for the majority of this project, to raise both
productivity and the quality of what I could ship inside 48 hours. I want to be
straightforward about the division of labour: **I was the organiser and
orchestrator, Claude was the one typing, and I reviewed every branch before it
was committed.**

**What I set up before any code was written.** I structured the repository
myself and handed Claude that structure to work inside — a pnpm workspace with
the Next.js app in `frontend/`, the mock payment and eSIM provider as a
separate package in `packages/mock-provider/`, and SQL migrations in `db/`. I
then had it work through a spec → plan → task-by-task flow, and both documents
are committed: [the design spec](docs/superpowers/specs/2026-08-05-esim-store-design.md)
and [the implementation plan](docs/superpowers/plans/2026-08-05-esim-store.md).

**Version control was delegated deliberately.** I assigned Claude the branching
and the commits, one branch and one pull request per feature, so the history
reads as a sequence of decisions rather than a single dump. I reviewed each
branch before it landed.

**What I specified, rather than left open:**

- **Security.** No environment variables exposed to the browser, no API
  surface that trusts client input, and Row Level Security on every table. The
  model I asked for is the one that shipped: `SELECT`-only policies with no
  `INSERT`/`UPDATE`/`DELETE` policy anywhere, so the publishable key can read
  your own rows and write nothing, and every write goes through the secret key
  inside `server-only` modules behind an explicit authorisation check.
- **Database.** The tables, their columns and the relationships between them —
  plans, eSIM profiles, orders, order items, fulfilments, webhook events and
  the admin audit log — plus the requirement that idempotency be enforced by
  database constraints rather than by application code.
- **Architecture and stack.** Next.js 16 with the App Router, TypeScript,
  Tailwind CSS 4, Supabase for Postgres, Auth, RLS and Realtime, and Vercel for
  hosting — and the constraint that it all had to run on free tiers, which is
  what produced the reader-driven reconciliation described above instead of a
  scheduler.
- **Design and UI.** I set the direction: the colour palette, the components I
  wanted integrated (the map card, the world map and the destination cards all
  come from 21st.dev), the layout structure of each page, and the outcome I was
  after. Where I supplied a reference design, I asked for that reference to be
  followed rather than reinterpreted.
- **Rendering strategy.** I decided what renders where rather than letting it
  fall out of the framework. Server-rendered: the landing page, the catalogue,
  the plan pages, checkout, the order status page, the account page, the admin
  view and the legal pages — anything that touches a price, an order or a
  session. Client-rendered, and only at the leaves: the cart (local state in
  `localStorage` until it becomes an order), the add-to-cart and cart-count
  controls, the cookie banner, the Realtime subscription on the order page, and
  the animated hero card. The header and footer stay Server Components. The
  full table is in [Rendering — chosen per surface](#rendering--chosen-per-surface).

The decisions I would most want to walk through are the security model, the
choice to drop the scheduler in favour of reader-driven reconciliation, and the
deliberate distinction between an automatic retry and a manual one.

**Bugs found by running the thing rather than reading it** — worth naming,
because tests were green through several of them:

- The cart was not cleared after checkout, so a second order silently re-bought
  the first order's items. Spotted because a €15.90 plan checked out at €30.80.
- The admin order list embedded a relationship PostgREST could not resolve, and
  the error was being discarded — a completely broken operations page rendered
  as a calm *"No orders yet"*.
- A failed provisioning left its eSIM stranded in `reserved`, so the pool would
  have leaked one profile per failure until a plan reported sold out while
  holding unused stock.
- The Content-Security-Policy blocked Vercel Analytics, so consent could be
  granted and nothing would load — silently.
- A successful admin retry removed the row it was rendered in, so the admin got
  no confirmation their retry had worked.

---

## Known limitations

Stated plainly rather than hidden.

- **Magic-link email is unreliable.** It uses Supabase's built-in mailer, which
  is rate limited to roughly two messages an hour and may refuse addresses
  outside the project team. This is why the one-click demo sign-in exists, and
  why it is the route this README recommends. Custom SMTP is the fix.
- **Reconciliation is reader-driven.** An order nobody opens stays stale.
- **Rate limiting is per-instance memory**, so it is a speed bump rather than a
  distributed guarantee. Upstash Redis is the fix; it costs money.
- **The CSP still allows `'unsafe-inline'` for scripts**, because Next injects
  an inline bootstrap script. A per-request nonce is the proper answer.
- **The mock provider shares this deployment.** It is architecturally separate
  and reached only over HTTP, but it has not been split into its own project.
- **Refunds are bookkeeping only.** There is no real gateway, so an admin can
  mark an order refunded but no money moves.

## What I would do next

In the order I would actually do them:

1. **A durable queue** for fulfilment, replacing reader-driven reconciliation,
   so a failed order self-heals without anyone looking at it.
2. **Custom SMTP** so magic links are dependable and the demo buttons become a
   convenience rather than a necessity.
3. **A webhook dead-letter queue with alerting** — right now a permanently
   failing order waits silently for an admin to notice.
4. **Split the mock provider into its own deployment**, which the boundary was
   built for.
5. **Shared-store rate limiting** and a nonce-based CSP.
6. **Idempotency on the admin retry**, so two operators pressing it at once
   cannot both start provisioning.
7. **Move the session-dependent header into a client island**, so the landing,
   catalogue and legal pages can be served statically from the edge instead of
   rendered per request.

---

## Assessment notes

- Everything runs on free tiers: Supabase free, Vercel Hobby, Supabase's
  built-in mailer. No service in this project requires a card.
- No payment gateway is integrated and no real money moves.
- No eSIM issued here will connect to a mobile network.

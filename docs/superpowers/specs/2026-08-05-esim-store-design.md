# eSIM Store — Design Spec

**Date:** 2026-08-05
**Task:** Trezuz Full Stack Developer Home Task — Track A (eSIM)
**Deadline:** 48h from receipt, ~38h remaining at time of writing
**Stack:** Next.js (App Router) + Tailwind CSS · Supabase (Postgres, Auth, RLS, Realtime) · Vercel

---

## 1. What is being built

A publicly reachable store that sells eSIM data plans. A customer browses a catalogue, adds plans to a cart,
checks out, and — once an asynchronous payment confirmation arrives by callback — the system automatically
provisions an eSIM from a provider and delivers a QR code and ICCID into the customer's account.

The assessment is graded on the **order pipeline**, not the product domain. The domain only decides what the
catalogue looks like and what fulfilment produces. Every design decision below prioritises correctness and
explainability of the pipeline over feature count.

### Brief requirements traced to this spec

| Requirement | Where it is satisfied |
|---|---|
| ≥6 products, purchasable end to end | §2 — eight plans seeded |
| Cart, checkout, confirmation, receipt | §7 rendering map, §6 state machine |
| Customer account with order history | §5 auth, §7 account surface |
| Mock payment service: success, decline, timeout | §4 provider service, §6.3 scenarios |
| Confirmation by callback, never from the browser | §4.2 — the browser receives no authoritative status |
| Explicit order states, idempotent callbacks, no double delivery | §6.1, §6.4, §3 unique constraints |
| Automatic fulfilment on confirmation | §6.2 |
| Provider failure after confirmation must not lose the order | §6.3 — order stays `paid`, moves to `fulfilment_failed` |
| Admin view listing orders, manual retry | §7 admin surface, §6.5 |
| Terms, refund policy, contact pages | §9 |
| README: architecture, how to run, how to trigger each failure | §12 |
| No real gateway, no real card data | §4, §6.3 — no card fields exist anywhere |

---

## 2. Catalogue

Eight plans (buffer above the required six, so one bad seed row cannot drop us under the minimum).

| Region | Data | Duration |
|---|---|---|
| Europe | 5 GB | 15 days |
| Japan | 10 GB | 30 days |
| USA | 3 GB | 7 days |
| Global | 20 GB | 30 days |
| Turkey | 10 GB | 15 days |
| UAE | 5 GB | 7 days |
| Thailand | 8 GB | 15 days |
| Mexico | 5 GB | 30 days |

Each plan owns a **finite pool of provisionable eSIM profiles**. This is a deliberate borrow from Track B: it
makes stock exhaustion a real, demonstrable order state instead of a hypothetical, and exercises the same
non-losing failure path as a provider outage.

---

## 3. Data model

Supabase Postgres. **RLS enabled on every table, deny by default.** Policies grant the narrowest possible read.

| Table | Columns (essential) | Constraint that matters |
|---|---|---|
| `profiles` | `id` (=auth.uid), `email`, `role` | `role` is never writable by the owning user |
| `plans` | `slug`, `region`, `data_mb`, `duration_days`, `price_cents`, `currency`, `provider_plan_code`, `active` | public read only, no write policy |
| `esim_profiles` | `plan_id`, `iccid`, `activation_code`, `status` (`available`/`reserved`/`consumed`) | claimed atomically, see §6.2 |
| `orders` | `user_id`, `status`, `subtotal_cents`, `total_cents`, `currency`, `idempotency_key`, timestamps | `idempotency_key` UNIQUE per user |
| `order_items` | `order_id`, `plan_id`, `qty`, `unit_price_cents` | price written server-side only |
| `payments` | `order_id`, `provider_ref`, `status`, `amount_cents`, `failure_reason`, `requested_at`, `settled_at` | one active payment per order |
| `webhook_events` | `provider_event_id`, `type`, `payload`, `received_at`, `processed_at` | `provider_event_id` **UNIQUE** — the idempotency ledger |
| `fulfilments` | `order_item_id`, `status`, `attempts`, `last_error`, `esim_profile_id` | `order_item_id` **UNIQUE** — the no-double-delivery guarantee |
| `admin_actions` | `actor_id`, `order_id`, `action`, `created_at` | audit trail for manual retries |

**There is no `carts` table.** A cart lives in `localStorage` and is re-priced from `plans` at checkout. A cart is
a client convenience; an order is a server fact. The client never transmits a price — only plan IDs and
quantities.

---

## 4. Mock provider service

### 4.1 Boundary

The provider is a standalone module in `backend/` that the store reaches **only over HTTP**, via
`PROVIDER_BASE_URL` and a shared HMAC secret. The store never imports provider internals.

Day one it is mounted inside the Next app at `/api/mock-provider/[...path]`. Splitting it into its own Vercel
deployment later is a thin wrapper plus one env var change, not a refactor. This defers the deployment decision
without paying for it in coupling.

### 4.2 Endpoints

- `POST /payments/authorize` — accepts `{ order_id, amount_cents, currency, scenario, event_id }`, responds
  `202 Accepted` immediately, then calls back asynchronously.
- `POST /esim/provision` — accepts `{ order_item_id, provider_plan_code }`, returns an ICCID + activation code,
  or fails per scenario.

The callback target is `POST /api/webhooks/payment` on the store. **The browser never receives an authoritative
payment status** — it only ever observes order state that the server has already written.

### 4.3 Callback security

HMAC-SHA256 over the raw request body plus a timestamp header, constant-time comparison, and a replay window
(±5 minutes). Outside the window, or on signature mismatch: `401`, no state change. Every accepted callback is
first inserted into `webhook_events`; a unique-violation means "already seen" and short-circuits to `200 OK`
with no side effects.

---

## 5. Authentication

Supabase Auth, **magic link (passwordless)**.

**Known limitation, documented honestly in the README:** this uses Supabase's built-in SMTP, which is rate
limited to roughly two emails per hour and may refuse addresses outside the project team. Magic link is
therefore best-effort.

**Mitigation — the primary route for reviewers:** a `Sign in as demo customer` and `Sign in as demo admin`
button on the login page, backed by a server action that signs into a seeded account with no email round-trip.
Reviewers get in instantly regardless of mail state. Both buttons are rate limited and clearly labelled as
demo affordances.

Authorisation for admin is a `role` column checked **server-side** on every admin data path and enforced again
by RLS. Middleware performs redirects for UX only and is never the authorisation boundary.

---

## 6. Order lifecycle

### 6.1 State machine

```
created → awaiting_payment ─┬→ payment_declined      (terminal)
                            ├→ payment_timeout       (terminal)
                            └→ paid → fulfilling ─┬→ fulfilled  (terminal)
                                                  └→ fulfilment_failed ⇄ retry
```

Additional terminal states: `cancelled` (customer abandons before authorize) and `refunded` (set by an admin as
bookkeeping only — no money moves, since there is no real gateway; see §14).

A single module owns the transition table. Any illegal transition throws rather than silently writing. This
module is unit tested and is the first thing to be able to defend in the walkthrough call.

### 6.2 Automatic fulfilment

Triggered by the payment callback writing `paid`, never by the browser.

For each order item, a profile is claimed atomically:

```sql
UPDATE esim_profiles SET status = 'reserved'
WHERE id = (SELECT id FROM esim_profiles
            WHERE plan_id = $1 AND status = 'available'
            LIMIT 1 FOR UPDATE SKIP LOCKED)
RETURNING *;
```

`SKIP LOCKED` makes concurrent checkouts safe without serialising the whole table. Zero rows returned means
stock is exhausted → `fulfilment_failed` with reason `out_of_stock`. On successful provisioning the profile
moves to `consumed` and the `fulfilments` row is written; the UNIQUE constraint on `order_item_id` makes a
second delivery impossible even if the callback is replayed.

### 6.3 Failure scenarios

Checkout carries an explicit **scenario selector**. **No card fields exist anywhere on the site**, per the brief.

| Scenario | Trigger | Behaviour |
|---|---|---|
| Approve | default | callback confirms → fulfilment → QR + ICCID in account |
| Decline | selector | callback returns `declined`; order terminal, nothing reserved or consumed |
| Timeout | selector | provider deliberately never calls back; reconciliation cron sweeps `awaiting_payment` older than 90s → `payment_timeout` |
| Provider failure | selector | payment succeeds, provisioning returns 503; **order stays paid and visible**, → `fulfilment_failed`, auto-retry ×3 with backoff, then awaits admin retry |
| Stock exhaustion | drain a plan's pool | payment succeeds, no profile available; same non-losing path, reason `out_of_stock` |

The customer-facing copy for a post-payment failure reads "payment secured, delivery in progress" — the order
is never lost and never silently disappears.

### 6.4 Idempotency

Three independent layers:

1. **Checkout** — `idempotency_key` UNIQUE per user prevents duplicate orders from a double-clicked button.
2. **Callback** — `provider_event_id` UNIQUE in `webhook_events`; replays return `200 OK` and do nothing.
3. **Delivery** — `order_item_id` UNIQUE in `fulfilments`; a second delivery cannot be written.

### 6.5 Retry

Automatic: a Vercel Cron sweeps `fulfilment_failed` rows with `attempts < 3` on an exponential backoff.
Manual: the admin view exposes a retry action per failed order, writing to `admin_actions`.

---

## 7. Rendering strategy

Deliberately split rather than uniformly dynamic.

| Surface | Strategy | Rationale |
|---|---|---|
| Landing, catalogue, legal pages | Static / ISR, Server Components | public, cacheable, fast first paint |
| Plan detail | ISR shell + live availability island | price is static, stock is not |
| Cart | Client, `localStorage` | purely local state, no server value |
| Checkout | Server Actions, dynamic, auth-gated | prices and totals resolved server-side only |
| Receipt / order status | Dynamic SSR + Supabase Realtime island | watching `paid → fulfilling → fulfilled` live is the demo |
| Account, order history | Dynamic SSR, RLS-scoped | never cacheable |
| Admin | Dynamic SSR, server-side role check | never client-trusted |

---

## 8. Security

- `service_role` key confined to modules marked `import 'server-only'`. The browser receives the anon key and
  nothing else. No secret is ever prefixed `NEXT_PUBLIC_` unless it is genuinely public.
- RLS on every table, deny by default, reads scoped to `auth.uid()`.
- Webhook HMAC with timestamp window and constant-time compare (§4.3).
- Zod validation at every trust boundary: form input, route handlers, callback payloads.
- Rate limiting on checkout, webhook, and the demo sign-in actions.
- Security headers including CSP; no third-party script loads before cookie consent.
- `.env.example` committed with placeholder values; `.env.local` gitignored. No secret ever committed.
- Admin authorisation server-side; middleware redirects only.
- The repository is public — no real credentials, no assessment materials beyond what the brief permits.

---

## 9. Legal and consent

Terms of service, refund policy, privacy policy, contact page, and a cookie consent banner with real
categories. Nothing non-essential loads before consent is given. Three of these are brief requirements; the
cookie layer was requested separately.

---

## 10. Testing

- **Vitest** — state machine transitions (including rejected illegal transitions), idempotent callback replay,
  atomic profile claim under concurrency.
- **Playwright** — happy path plus all three required failure paths. These double as executable proof for the
  "how to trigger each" section of the submission email.

---

## 11. Branch strategy

One branch per feature, merged to `master` by pull request:

`docs/initial-spec` → `feat/scaffold` → `feat/db-schema` → `feat/catalogue` → `feat/cart` → `feat/auth` →
`feat/checkout-orders` → `feat/mock-provider` → `feat/webhooks-fulfilment` → `feat/account` → `feat/admin` →
`feat/legal-cookies` → `feat/design-system` → `feat/tests-docs`

---

## 12. Deliverables

Submitted to `sm@trezuz.com` and `applications@trezuz.com`:

1. Live URL
2. Repo link
3. How to place an order end to end
4. How to trigger a declined payment, a payment timeout, and a provider failure

The README covers architecture, local setup, the failure-trigger recipes, where AI tooling was used, and a
"what I would do next" section.

---

## 13. Time budget

Approximately 24 working hours of the ~38 remaining. Pipeline correctness ships before visual polish, so a
deadline surprise costs appearance rather than marks.

| Phase | Est. |
|---|---|
| Scaffold, Supabase, schema + RLS, seed | 4h |
| Catalogue, cart, auth | 4h |
| Checkout, orders, mock provider, callbacks, fulfilment | 7h |
| Account, admin, retry | 3h |
| Design system, motion, generated imagery | 4h |
| Legal, cookies, security headers | 1h |
| Tests, README, deploy, verification | 3h |

---

## 14. Explicitly out of scope

Real gateway integration · real card data · KYC · pixel-perfect design · mobile apps · cash refunds through a
real processor · multi-currency · i18n.

## 15. Deferred, and named in the README as next steps

Splitting the provider into its own deployment · durable workflow orchestration (Vercel Workflow) in place of
the cron-driven retry · custom SMTP for reliable magic links · webhook dead-letter queue with alerting.

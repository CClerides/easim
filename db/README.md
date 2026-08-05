# Database

Postgres, hosted by Supabase. There is no migration tool here on purpose — four
files applied in order is easier to read, and easier to explain, than a
framework.

## Applying from scratch

Paste each file into the Supabase SQL editor and run it, in this order:

1. `migrations/0001_schema.sql` — tables, enums, indexes, constraints
2. `migrations/0002_rls.sql` — row level security, enabled and policed
3. `migrations/0003_functions.sql` — the atomic claim, and the new-user trigger
4. `seed.sql` — eight plans, their eSIM pools, and the demo accounts

All four are safe to re-run.

The demo accounts themselves (`demo@trezuz.dev`, `admin@trezuz.dev`) are created
through the Auth admin API rather than SQL, because Supabase owns `auth.users`.
`seed.sql` then backfills their `profiles` rows and grants the admin role.

## The security model in one sentence

The key shipped to the browser can read your own rows and nothing else, and can
write nothing at all.

Every table has row level security enabled. You will find `SELECT` policies and
**no `INSERT`, `UPDATE` or `DELETE` policies anywhere** — that absence is the
design. With RLS on, anything without a policy is denied.

All writes therefore go through server-side code holding `SUPABASE_SECRET_KEY`,
which bypasses RLS, after that code has established who is asking. Server
actions start with `requireUser()` or `requireAdmin()`; the payment webhook
verifies an HMAC signature first.

`webhook_events` has RLS enabled and no policy at all, so it is invisible to the
browser rather than merely filtered.

## The three constraints that carry the assessment

| Constraint | Prevents |
|---|---|
| `orders (user_id, idempotency_key)` UNIQUE | A double-clicked checkout creating two orders |
| `webhook_events.provider_event_id` UNIQUE | A replayed provider callback being processed twice |
| `fulfilments.order_item_id` UNIQUE | The same line item being delivered twice |

Each is enforced by the database, not by application logic, so none of them can
be lost to a race between two concurrent requests.

## `claim_esim_profile`

The one function worth reading closely. It takes a plan and hands back exactly
one available eSIM, atomically:

```sql
select id from esim_profiles
where plan_id = p_plan_id and status = 'available'
limit 1 for update skip locked
```

- `for update` locks the chosen row so no other transaction can take it.
- `skip locked` makes a concurrent claim pick a *different* row rather than
  queue behind this one.

Two customers checking out the same plan at the same instant get two different
profiles. Without `skip locked` they would serialise; without `for update` they
could both read the same row as available.

It returns `setof esim_profiles`, so an exhausted pool comes back as an empty
array. A bare composite return type would yield a row of all-NULL columns, which
every caller would then have to special-case.

## Stock

Every plan holds ten profiles except `usa-3gb-7d`, which holds one. That single
scarce plan makes stock exhaustion demonstrable in two purchases, without anyone
editing the database mid-demo.

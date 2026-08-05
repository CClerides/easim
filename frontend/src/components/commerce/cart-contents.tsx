'use client'

import Link from 'next/link'
import { useCart } from '@/lib/cart/cart-context'
import { MAX_QTY_PER_PLAN } from '@/lib/cart/items'
import { formatData, formatDuration, formatPrice } from '@/lib/format'
import type { Plan } from '@/lib/plans'

/**
 * The cart, rendered against plans the server already loaded.
 *
 * The subtotal shown here is for the customer's benefit only. The figure that
 * gets charged is recalculated on the server at checkout from the same plan
 * rows, so an edited localStorage changes what you see and nothing else.
 */
export function CartContents({ plans }: { plans: Plan[] }) {
  const { items, update, remove, ready } = useCart()

  const byId = new Map(plans.map((plan) => [plan.id, plan]))

  // A plan can vanish from the catalogue between adding it and returning.
  const lines = items.flatMap((item) => {
    const plan = byId.get(item.planId)
    return plan ? [{ plan, qty: item.qty }] : []
  })

  const subtotalCents = lines.reduce(
    (total, line) => total + line.plan.price_cents * line.qty,
    0,
  )

  // Until localStorage has been read the cart is unknown, not empty. Showing
  // "your cart is empty" for a moment and then filling it is worse than
  // showing nothing.
  if (!ready) {
    return <p className="mt-10 text-sm text-muted">Loading your cart…</p>
  }

  if (lines.length === 0) {
    return (
      <div className="mt-10 rounded-xl border border-border bg-surface p-8">
        <h2 className="font-medium">Your cart is empty</h2>
        <p className="mt-2 text-sm text-muted">
          Pick a destination and it will show up here.
        </p>
        <Link
          href="/plans"
          className="mt-6 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-accent-strong"
        >
          Browse plans
        </Link>
      </div>
    )
  }

  const dropped = items.length - lines.length

  return (
    <div className="mt-10">
      {dropped > 0 ? (
        <p className="mb-6 rounded-lg border border-warning/40 bg-surface p-4 text-sm text-warning">
          {dropped === 1 ? 'One plan is' : `${dropped} plans are`} no longer
          available and {dropped === 1 ? 'was' : 'were'} removed from your cart.
        </p>
      ) : null}

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {lines.map(({ plan, qty }) => (
          <li key={plan.id} className="flex flex-wrap items-center gap-4 p-5">
            <div className="min-w-0 flex-1">
              <Link href={`/plans/${plan.slug}`} className="font-medium hover:text-accent">
                {plan.region}
              </Link>
              <p className="mt-1 text-sm text-muted">
                {formatData(plan.data_mb)} · {formatDuration(plan.duration_days)} ·{' '}
                {formatPrice(plan.price_cents)} each
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted">Qty</span>
              <input
                type="number"
                min={1}
                max={MAX_QTY_PER_PLAN}
                value={qty}
                onChange={(event) => update(plan.id, Number(event.target.value))}
                aria-label={`Quantity of ${plan.region}`}
                className="w-16 rounded-md border border-border bg-background px-2 py-1.5 text-center tabular-nums outline-none focus:border-accent"
              />
            </label>

            <p className="w-24 text-right font-medium tabular-nums">
              {formatPrice(plan.price_cents * qty)}
            </p>

            <button
              type="button"
              onClick={() => remove(plan.id)}
              className="text-sm text-muted transition-colors hover:text-danger"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-center justify-between rounded-xl border border-border bg-surface p-5">
        <div>
          <p className="text-sm text-muted">Subtotal</p>
          <p className="text-2xl font-semibold tabular-nums">{formatPrice(subtotalCents)}</p>
        </div>

        <Link
          href="/checkout"
          className="rounded-lg bg-accent px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-accent-strong"
        >
          Checkout
        </Link>
      </div>

      <p className="mt-4 text-xs text-muted">
        The total is confirmed on the server at checkout from current prices.
      </p>
    </div>
  )
}

'use client'

import { useActionState, useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import type { PaymentScenario } from '@easim/mock-provider'
import { useCart } from '@/lib/cart/cart-context'
import { formatData, formatDuration, formatPrice } from '@/lib/format'
import type { Plan } from '@/lib/plans'
import { ScenarioSelector } from '@/components/commerce/scenario-selector'
import { placeOrder, type CheckoutState } from './actions'

export function CheckoutForm({ plans, email }: { plans: Plan[]; email: string }) {
  const { items, ready } = useCart()
  const [scenario, setScenario] = useState<PaymentScenario>('approve')
  const [state, formAction] = useActionState<CheckoutState, FormData>(placeOrder, null)

  /**
   * Generated once per mounted checkout. Submitting the same form twice sends
   * the same key, and the database's unique constraint turns the second
   * submission into a lookup of the first order instead of a new one.
   */
  const idempotencyKey = useMemo(() => crypto.randomUUID(), [])

  const byId = new Map(plans.map((plan) => [plan.id, plan]))
  const lines = items.flatMap((item) => {
    const plan = byId.get(item.planId)
    return plan ? [{ plan, qty: item.qty }] : []
  })

  const subtotalCents = lines.reduce((total, line) => total + line.plan.price_cents * line.qty, 0)

  if (!ready) return <p className="mt-10 text-sm text-muted">Loading your cart…</p>

  if (lines.length === 0) {
    return (
      <div className="mt-10 rounded-xl border border-border bg-surface p-8">
        <h2 className="font-medium">There is nothing to check out</h2>
        <Link
          href="/plans"
          className="mt-6 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-accent-strong"
        >
          Browse plans
        </Link>
      </div>
    )
  }

  const payload = JSON.stringify({
    items: items.map((item) => ({ planId: item.planId, qty: item.qty })),
    idempotencyKey,
    scenario,
  })

  return (
    <form action={formAction} className="mt-10 space-y-8">
      <input type="hidden" name="payload" value={payload} />

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <h2 className="border-b border-border px-5 py-4 text-sm font-medium">Order summary</h2>
        <ul className="divide-y divide-border">
          {lines.map(({ plan, qty }) => (
            <li key={plan.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="font-medium">
                  {plan.region}
                  {qty > 1 ? <span className="text-muted"> × {qty}</span> : null}
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  {formatData(plan.data_mb)} · {formatDuration(plan.duration_days)}
                </p>
              </div>
              <p className="tabular-nums">{formatPrice(plan.price_cents * qty)}</p>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-border px-5 py-4">
          <span className="text-sm text-muted">Total</span>
          <span className="text-xl font-semibold tabular-nums">{formatPrice(subtotalCents)}</span>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="text-sm">
          Delivering to <span className="font-medium">{email}</span>
        </p>
        <p className="mt-1 text-sm text-muted">
          Your eSIM appears in your account as soon as payment is confirmed.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <ScenarioSelector value={scenario} onChange={setScenario} />
      </section>

      <p className="rounded-lg border border-border p-4 text-sm text-muted">
        No card details are collected anywhere on this site. Payment is handled
        by a mock service that moves no money.
      </p>

      {state?.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <PlaceOrderButton total={formatPrice(subtotalCents)} />
    </form>
  )
}

function PlaceOrderButton({ total }: { total: string }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-accent px-6 py-3.5 font-medium text-background transition-colors hover:bg-accent-strong disabled:opacity-60"
    >
      {pending ? 'Placing your order…' : `Place order - ${total}`}
    </button>
  )
}

import type { Metadata } from 'next'
import { getActivePlans, getAvailability } from '@/lib/plans'
import { PlanCard } from '@/components/commerce/plan-card'

export const metadata: Metadata = {
  title: 'Plans — Easim',
  description: 'Prepaid eSIM data plans by country and duration.',
}

/**
 * Server Component. Nothing here needs the browser: it is a list of prices and
 * counts, so it renders on the server and ships no JavaScript for itself.
 *
 * Plan content comes from an hour-long cache; availability is read fresh on
 * every request. See lib/plans.ts for why that split exists.
 */
export default async function PlansPage() {
  const [plans, availability] = await Promise.all([getActivePlans(), getAvailability()])

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-16">
      <header className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight">Data plans</h1>
        <p className="mt-4 text-muted">
          Pick a destination. Pay. The QR code lands in your account within
          seconds — no shop, no SIM card, no waiting.
        </p>
      </header>

      {plans.length === 0 ? (
        <div className="mt-12 rounded-xl border border-border bg-surface p-8">
          <h2 className="font-medium">The catalogue is unavailable</h2>
          <p className="mt-2 text-sm text-muted">
            We could not load plans just now. Please try again in a moment.
          </p>
        </div>
      ) : (
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <li key={plan.id}>
              <PlanCard plan={plan} available={availability.get(plan.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

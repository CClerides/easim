import type { Metadata } from 'next'
import { Signal } from 'lucide-react'
import { getActivePlans, getAvailability } from '@/lib/plans'
import { TravelCard } from '@/components/ui/card-7'
import { StockBadge } from '@/components/commerce/stock-badge'
import { destinationFor } from '@/lib/destinations'
import { formatData, formatDuration, formatPrice } from '@/lib/format'

export const metadata: Metadata = {
  title: 'Plans - Easim',
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

  /*
   * A plan with nothing left is missing from the availability read entirely.
   *
   * `plan_availability()` counts rows in `esim_profiles` grouped by plan, so a
   * plan whose last profile has been sold produces no row rather than a zero.
   * Read naively, `undefined` then means "unknown" and the card offers a plan
   * that cannot be bought.
   *
   * If any row came back the read succeeded, so a plan absent from it is
   * genuinely sold out. If nothing came back at all we cannot tell a failed
   * read from an empty warehouse, and saying nothing beats guessing wrong in
   * either direction.
   */
  const stockIsKnown = availability.size > 0
  const availableFor = (planId: string) =>
    stockIsKnown ? (availability.get(planId) ?? 0) : undefined

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-16">
      <header className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight">Data plans</h1>
        <p className="mt-4 text-muted">
          Pick a destination. Pay. The QR code lands in your account within
          seconds - no shop, no SIM card, no waiting.
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
        <ul className="mt-12 grid justify-items-center gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan, index) => {
            const destination = destinationFor(plan.slug)
            const available = availableFor(plan.id)

            return (
              <li key={plan.id} className="w-full max-w-sm">
                <TravelCard
                  className="aspect-square"
                  imageUrl={destination.image}
                  imageAlt={destination.imageAlt}
                  logo={<Signal className="h-6 w-6 text-white/80" aria-hidden />}
                  badge={<StockBadge available={available} />}
                  title={plan.region}
                  location={destination.city}
                  overview={destination.overview}
                  price={formatPrice(plan.price_cents)}
                  pricePeriod={`${formatData(plan.data_mb)} for ${formatDuration(plan.duration_days)}`}
                  href={`/plans/${plan.slug}`}
                  ctaLabel="View plan"
                  soldOut={available === 0}
                  // The first row is above the fold on a laptop; the rest can
                  // wait until they are scrolled towards.
                  priority={index < 3}
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

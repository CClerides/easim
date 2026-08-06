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
            const available = availability?.get(plan.id)

            return (
              <li key={plan.id} className="w-full max-w-sm">
                <TravelCard
                  className="aspect-square"
                  imageUrl={destination.image}
                  imageAlt={destination.imageAlt}
                  logo={<Signal className="h-6 w-6 text-white/80" aria-hidden />}
                  badge={<StockBadge available={available} />}
                  title={plan.region}
                  overview={destination.overview}
                  price={formatPrice(plan.price_cents)}
                  pricePeriod={`${formatData(plan.data_mb)} for ${formatDuration(plan.duration_days)}`}
                  href={`/plans/${plan.slug}`}
                  ctaLabel="View plan"
                  soldOut={available === 0}
                  // Only the first. "The first row" depends on the breakpoint -
                  // three cards wide on a laptop but one on a phone, where
                  // preloading three would have two off-screen photographs
                  // competing with the one the visitor is actually waiting for.
                  priority={index === 0}
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

'use client'

import Link from 'next/link'
import type { Plan } from '@/lib/plans'
import { destinationFor } from '@/lib/destinations'
import { formatData, formatDuration, formatPrice } from '@/lib/format'
import { LocationMap } from '@/components/ui/expanded-map'

/**
 * Eight destinations, using the 21st.dev map card exactly as published.
 *
 * The component sizes itself (240x140, 360x280 expanded) and toggles on
 * click, so the layout is the demo's centred flex-wrap rather than a grid -
 * a fixed-width card fights a grid track, and changing that would mean
 * forking the component.
 *
 * One addition, and it is deliberate: a "View plan" link under each card.
 * The component's click is spent on expanding, so without this the shop's
 * product cards would have no route to buying anything. The link sits
 * outside the card so the component itself is untouched.
 */
export function DestinationsGrid({
  plans,
  availability,
}: {
  plans: Plan[]
  availability: Record<string, number>
}) {
  // The card has a fixed 240px width, so "four per row" is a container width
  // rather than a grid: 4 x 240 plus 3 x 32 of gap. Constraining it here keeps
  // the published component untouched.
  return (
    <div className="mx-auto flex max-w-[1056px] flex-wrap items-start justify-center gap-8">
      {plans.map((plan) => {
        const destination = destinationFor(plan.slug)
        const left = availability[plan.id]

        return (
          <div key={plan.id} className="flex flex-col items-start gap-3">
            <LocationMap
              location={`${plan.region} · ${formatPrice(plan.price_cents)}`}
              latitude={destination.latitude}
              longitude={destination.longitude}
              zoom={destination.zoom}
            />

            <div className="flex w-[240px] items-center justify-between text-sm">
              <span className="text-muted">
                {formatData(plan.data_mb)} · {formatDuration(plan.duration_days)}
              </span>
              <Link
                href={`/plans/${plan.slug}`}
                className="text-accent underline underline-offset-4"
              >
                {left === 0 ? 'Sold out' : 'View plan'}
              </Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}

import Link from 'next/link'
import type { Plan } from '@/lib/plans'
import { formatData, formatDuration, formatPrice } from '@/lib/format'

/** Below this many left, say so - scarcity is real here, not a growth tactic. */
const LOW_STOCK_THRESHOLD = 3

export function PlanCard({ plan, available }: { plan: Plan; available: number | undefined }) {
  const soldOut = available === 0

  return (
    <Link
      href={`/plans/${plan.slug}`}
      className="group relative flex flex-col rounded-xl border border-border bg-surface p-6 transition-colors hover:border-accent/60"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-medium">{plan.region}</h3>
          <p className="mt-1 text-sm text-muted">
            {formatData(plan.data_mb)} · {formatDuration(plan.duration_days)}
          </p>
        </div>
        <StockBadge available={available} />
      </div>

      <div className="mt-8 flex items-end justify-between">
        <p className="text-2xl font-semibold tabular-nums">{formatPrice(plan.price_cents)}</p>
        <span className="text-sm text-muted transition-colors group-hover:text-accent">
          {soldOut ? 'Unavailable' : 'View plan'}
        </span>
      </div>
    </Link>
  )
}

function StockBadge({ available }: { available: number | undefined }) {
  // Undefined means the count could not be read. Saying nothing is better than
  // guessing, so the badge simply does not render.
  if (available === undefined) return null

  if (available === 0) {
    return <Badge tone="danger">Sold out</Badge>
  }

  if (available <= LOW_STOCK_THRESHOLD) {
    return <Badge tone="warning">{available} left</Badge>
  }

  return <Badge tone="muted">In stock</Badge>
}

function Badge({
  tone,
  children,
}: {
  tone: 'danger' | 'warning' | 'muted'
  children: React.ReactNode
}) {
  const tones = {
    danger: 'border-danger/40 text-danger',
    warning: 'border-warning/40 text-warning',
    muted: 'border-border text-muted',
  } as const

  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

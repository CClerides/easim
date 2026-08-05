import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getActivePlans, getAvailability, getPlanBySlug } from '@/lib/plans'
import { formatData, formatDuration, formatPrice } from '@/lib/format'
import { AddToCart } from '@/components/commerce/add-to-cart'

/**
 * Pre-renders the eight known slugs at build time. Unknown slugs still work,
 * they just render on demand - and 404 if the plan does not exist.
 */
export async function generateStaticParams() {
  const plans = await getActivePlans()
  return plans.map((plan) => ({ slug: plan.slug }))
}

export async function generateMetadata({ params }: PageProps<'/plans/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const plan = await getPlanBySlug(slug)
  if (!plan) return { title: 'Plan not found - Easim' }

  return {
    title: `${plan.region} ${formatData(plan.data_mb)} - Easim`,
    description: `${formatData(plan.data_mb)} of data in ${plan.region} for ${formatDuration(plan.duration_days)}.`,
  }
}

export default async function PlanPage({ params }: PageProps<'/plans/[slug]'>) {
  const { slug } = await params
  const plan = await getPlanBySlug(slug)

  if (!plan) notFound()

  const availability = await getAvailability()
  const available = availability.get(plan.id)
  const soldOut = available === 0

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <p className="text-sm tracking-[0.18em] text-muted uppercase">{plan.country_code}</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">{plan.region}</h1>

      {/* One column until all three facts fit on a row - a two-column grid
          holding three items leaves a visible empty cell. */}
      <dl className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
        <Fact label="Data" value={formatData(plan.data_mb)} />
        <Fact label="Valid for" value={formatDuration(plan.duration_days)} />
        <Fact label="Price" value={formatPrice(plan.price_cents)} />
      </dl>

      <div className="mt-10 rounded-xl border border-border bg-surface p-6">
        {soldOut ? (
          <p className="text-sm text-danger">
            This plan is sold out. Every eSIM in its pool has been issued.
          </p>
        ) : (
          <p className="text-sm text-muted">
            {available === undefined
              ? 'Delivered to your account automatically once payment is confirmed.'
              : `${available} available. Delivered to your account automatically once payment is confirmed.`}
          </p>
        )}

        <AddToCart planId={plan.id} soldOut={soldOut} />
      </div>

      <section className="mt-12 space-y-3 text-sm text-muted">
        <h2 className="text-base font-medium text-foreground">How delivery works</h2>
        <p>
          After checkout, our provider confirms the payment by calling us back -
          not through your browser. That confirmation triggers provisioning, and
          the QR code and ICCID appear in your account.
        </p>
        <p>
          If provisioning fails, your order is kept and retried. It is never
          discarded.
        </p>
      </section>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface p-5">
      <dt className="text-xs tracking-wider text-muted uppercase">{label}</dt>
      <dd className="mt-1.5 text-lg font-medium tabular-nums">{value}</dd>
    </div>
  )
}

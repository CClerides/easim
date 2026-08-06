import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getActivePlans, getAvailability, getPlanBySlug } from '@/lib/plans'
import { destinationFor } from '@/lib/destinations'
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

/**
 * One plan, and the decision to buy it.
 *
 * The page is a photograph and a purchase panel, because those are the two
 * things it does: show you where you are going, and take the order. The
 * photograph carries two thirds of the width and the panel one, and on a wide
 * screen the panel is sticky - the price and the button stay reachable while
 * the delivery explanation scrolls past, so the decision never leaves the
 * screen.
 *
 * Still a Server Component. Only the add-to-cart button is interactive, and it
 * is the only thing here that ships JavaScript.
 */
export default async function PlanPage({ params }: PageProps<'/plans/[slug]'>) {
  const { slug } = await params
  const plan = await getPlanBySlug(slug)

  if (!plan) notFound()

  const destination = destinationFor(plan.slug)
  const availability = await getAvailability()

  const available = availability?.get(plan.id)
  const soldOut = available === 0

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12 lg:py-16">
      <Link
        href="/plans"
        className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All plans
      </Link>

      {/*
        Three items, and the source order is the order a phone needs: see where
        you are going, decide, then read how it arrives. Stacked, the delivery
        explanation coming before the price would put the button below a screen
        of reassurance nobody asked for yet.

        On a wide screen the explicit rows put it back under the photograph,
        with the purchase panel spanning both rows beside them.
      */}
      <div className="mt-8 grid gap-10 lg:grid-cols-3 lg:gap-x-14 lg:gap-y-12">
        {/* The photograph: two thirds, and the reason anyone wants the plan. */}
        {/*
          No caption. The obvious one is the city these coordinates point at,
          and it would be wrong here: Europe's photograph is four countries and
          the plan covers a continent, so labelling it "Paris" states something
          untrue about what you are buying. The heading beside it already names
          the destination.
        */}
        <div className="relative aspect-4/3 overflow-hidden rounded-container shadow-[0_24px_60px_rgba(16,19,24,0.16)] lg:col-span-2 lg:col-start-1 lg:row-start-1">
          <Image
            src={destination.image}
            alt={destination.imageAlt}
            fill
            priority
            sizes="(min-width: 1024px) 736px, 100vw"
            className="object-cover"
          />
        </div>

        {/* The purchase: one third, and sticky once there is room for it. */}
        {/*
          Capped while stacked. Once this is a full-width column the paragraphs
          run past 100 characters a line and the spec rows pull their labels and
          values to opposite edges; the cap comes off when it becomes a third of
          the grid and is narrow by construction.
        */}
        <aside className="max-w-prose lg:col-span-1 lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:max-w-none">
          <div className="lg:sticky lg:top-28">
            <h1 className="text-4xl font-semibold tracking-tight">{plan.region}</h1>
            <p className="mt-3 text-muted">{destination.overview}</p>

            <p className="mt-8 text-5xl font-semibold tracking-tight tabular-nums">
              {formatPrice(plan.price_cents)}
            </p>

            <dl className="mt-8 border-t border-border text-sm">
              <Spec label="Data" value={formatData(plan.data_mb)} />
              <Spec label="Valid for" value={formatDuration(plan.duration_days)} />
              <Spec label="Delivery" value="Instant, to your account" />
            </dl>

            <p
              className={`mt-8 text-sm ${soldOut ? 'text-danger' : 'text-muted'}`}
              role={soldOut ? 'status' : undefined}
            >
              {soldOut
                ? 'Sold out. Every eSIM in this pool has been issued.'
                : available === undefined
                  ? 'Delivered automatically once payment is confirmed.'
                  : `${available} available. Delivered automatically once payment is confirmed.`}
            </p>

            <AddToCart planId={plan.id} soldOut={soldOut} />

            <p className="mt-5 text-xs leading-relaxed text-muted">
              No card details are collected anywhere on this site. Payment is
              handled by a separate service.
            </p>
          </div>
        </aside>

        <section className="max-w-prose lg:col-span-2 lg:col-start-1 lg:row-start-2">
          <h2 className="text-base font-medium">How delivery works</h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
            <p>
              After checkout, our provider confirms the payment by calling us
              back - not through your browser. That confirmation triggers
              provisioning, and the QR code and ICCID appear in your account.
            </p>
            <p>
              If provisioning fails, your order is kept and retried. It is never
              discarded.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}

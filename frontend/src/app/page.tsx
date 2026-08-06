import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { getActivePlans, getAvailability } from '@/lib/plans'
import { Reveal } from '@/components/site/reveal'
import { HeroIntro } from '@/components/site/hero-intro'
import { SimCard3D } from '@/components/site/sim-card-3d'
import { DestinationsGrid } from '@/components/site/destinations-grid'
import { CoverageMap } from '@/components/site/coverage-map'
import { SnapScope } from '@/components/site/snap-scope'

/**
 * The delivery story, told as a sequence rather than as three equal cards.
 *
 * The step that matters most is the one a customer never sees, so it gets
 * stated plainly here instead of being buried in a diagram.
 */
const DELIVERY = [
  {
    title: 'You pay',
    body: 'No card details are collected anywhere on this site. Payment is handled by a separate service.',
  },
  {
    title: 'The provider confirms, directly to us',
    body: 'That confirmation is a server to server message, not something your browser reports. You can close the tab.',
  },
  {
    title: 'We issue the eSIM',
    body: 'An eSIM is claimed from stock and provisioned. The QR code appears in your account within seconds.',
  },
  {
    title: 'If anything fails, your order survives',
    body: 'A payment that clears but cannot be fulfilled is kept, retried, and recoverable. It is never dropped.',
  },
]

/**
 * The three destinations shown on the landing page.
 *
 * Three, not eight, so each card can be large enough to be worth looking at.
 * The rest live on /plans, which the section says so explicitly rather than
 * hoping the visitor guesses.
 */
const FEATURED = ['europe-5gb-15d', 'usa-3gb-7d', 'uae-5gb-7d']

export default async function HomePage() {
  const [plans, availability] = await Promise.all([getActivePlans(), getAvailability()])

  // A Map cannot cross the server/client boundary, so it is flattened here.
  const availabilityByPlan = Object.fromEntries(availability)

  const featured = FEATURED.map((slug) => plans.find((plan) => plan.slug === slug)).filter(
    (plan): plan is NonNullable<typeof plan> => Boolean(plan),
  )

  return (
    <>
      <SnapScope />

      {/*
        Centred hero: one message, one action, then the product itself. The
        card is interactive rather than a still, so the first thing the visitor
        can do on the page is touch the thing being sold.
      */}
      {/*
        pt-28 clears the 80px sticky header. Centring a full-height section
        without it puts the headline underneath the chrome, which is what the
        first version did.
      */}
      <section className="snap-section flex min-h-[100dvh] flex-col justify-center overflow-hidden pt-28 pb-12">
        <div className="mx-auto w-full max-w-7xl px-6 lg:px-10">
          <HeroIntro>
            <h1 className="mx-auto max-w-4xl text-center text-5xl font-semibold sm:text-6xl lg:text-7xl">
              Data that works the moment you land.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-center text-lg leading-relaxed text-muted">
              Buy an eSIM before you fly. The QR code reaches your account
              seconds after payment clears.
            </p>
            <div className="mt-9 flex justify-center">
              <Link href="/plans" className="btn btn-primary group px-7 py-3.5">
                Buy now
                <ArrowRight
                  className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </div>
          </HeroIntro>

          <div className="mt-14 lg:mt-16">
            <SimCard3D />
          </div>
        </div>
      </section>

      <section className="snap-section flex min-h-[100dvh] flex-col justify-center border-t border-border py-20">
        <CoverageMap plans={plans} />
      </section>

      <section className="snap-section mx-auto w-full max-w-7xl px-6 py-24 lg:px-10">
        <Reveal className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="text-3xl font-semibold sm:text-4xl">Three to start with</h2>
            <p className="mt-3 max-w-md text-muted">
              Eight regions in total, from a week in the UAE to a month of
              global data.
            </p>
          </div>

          <Link
            href="/plans"
            className="group inline-flex items-center gap-2 text-sm font-medium text-accent"
          >
            See every plan
            <ArrowRight
              className="size-4 transition-transform duration-200 group-hover:translate-x-1"
              aria-hidden
            />
          </Link>
        </Reveal>

        <DestinationsGrid plans={featured} availability={availabilityByPlan} />
      </section>

      {/*
        A different layout family from the grid above: a sticky heading beside
        a sequence, separated by hairlines rather than boxed into cards.
      */}
      <section id="delivery" className="snap-section scroll-mt-24 border-t border-border bg-surface">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-24 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:px-10">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <h2 className="text-3xl font-semibold sm:text-4xl">What happens after you pay</h2>
            <p className="mt-4 max-w-sm text-muted">
              The interesting part of this shop is the part you never see.
            </p>
          </div>

          <ol className="divide-y divide-border">
            {DELIVERY.map((step, index) => (
              <li key={step.title}>
                <Reveal delay={index * 0.06}>
                  <div className="flex gap-6 py-7">
                    <span className="font-mono text-sm text-accent tabular-nums">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h3 className="font-medium">{step.title}</h3>
                      <p className="mt-2 max-w-md leading-relaxed text-muted">{step.body}</p>
                    </div>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="snap-section border-t border-border">
        <Reveal className="mx-auto max-w-2xl px-6 py-24 text-center">
          <h2 className="text-3xl font-semibold sm:text-4xl">Pick a destination</h2>
          <p className="mt-4 text-muted">
            Eight regions, delivered automatically the moment payment clears.
          </p>
          <Link href="/plans" className="btn btn-primary group mt-8 px-7 py-3.5">
            Browse plans
            <ArrowRight
              className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        </Reveal>
      </section>
    </>
  )
}

import Link from 'next/link'
import Image from 'next/image'
import { getActivePlans, getAvailability } from '@/lib/plans'
import { Reveal } from '@/components/site/reveal'
import { HeroIntro } from '@/components/site/hero-intro'
import { PinnedHero } from '@/components/site/pinned-hero'
import { DestinationsGrid } from '@/components/site/destinations-grid'

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

export default async function HomePage() {
  const [plans, availability] = await Promise.all([getActivePlans(), getAvailability()])

  // A Map cannot cross the server/client boundary, so it is flattened here.
  const availabilityByPlan = Object.fromEntries(availability)

  const hero = (
    <div className="relative isolate h-full">
      <Image
        src="/brand/hero-network.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-right"
      />
      {/*
        Scrim, not a wash. Opaque behind the copy and clearing quickly so the
        artwork reads on the right.
      */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-background from-30% via-background/70 via-55% to-transparent"
      />

      <div className="relative mx-auto flex h-full max-w-6xl flex-col justify-center px-6">
        <HeroIntro>
          <p className="font-mono text-xs tracking-[0.22em] text-accent uppercase">
            Prepaid eSIM data
          </p>
          <h1 className="mt-6 max-w-xl text-5xl leading-[1.05] font-semibold sm:text-6xl">
            Land with data already working.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
            Buy before you fly. Your eSIM arrives the moment payment clears.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link href="/plans" className="btn btn-primary px-6 py-3">
              Browse plans
            </Link>
            <Link href="#delivery" className="btn btn-secondary px-6 py-3">
              How delivery works
            </Link>
          </div>
        </HeroIntro>
      </div>
    </div>
  )

  return (
    <>
      {/*
        The hero holds the full viewport and pins while the destinations arrive
        over it. Scroll position drives the handover, so it moves at the
        reader's pace rather than playing at them.
      */}
      <PinnedHero hero={hero}>
        <section className="mx-auto w-full max-w-6xl px-6 pt-16 pb-24">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
            <h2 className="text-3xl font-semibold">Eight destinations</h2>
            <Link
              href="/plans"
              className="text-sm text-muted underline underline-offset-4 transition-colors hover:text-accent"
            >
              See every plan
            </Link>
          </div>

          <DestinationsGrid plans={plans} availability={availabilityByPlan} />
        </section>
      </PinnedHero>

      {/*
        A different layout family from the grid above: a sticky heading beside
        a sequence, separated by hairlines rather than boxed into cards.
      */}
      <section id="delivery" className="scroll-mt-20 border-t border-border bg-surface/40">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-24 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <h2 className="text-3xl font-semibold">What happens after you pay</h2>
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

      <section className="border-t border-border">
        <Reveal className="mx-auto max-w-2xl px-6 py-24 text-center">
          <h2 className="text-3xl font-semibold">Pick a destination</h2>
          <p className="mt-4 text-muted">
            Eight regions, from a week in the UAE to a month of global data.
          </p>
          <Link href="/plans" className="btn btn-primary mt-8 px-6 py-3">
            Browse plans
          </Link>
        </Reveal>
      </section>
    </>
  )
}

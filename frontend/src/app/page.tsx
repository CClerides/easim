import Link from 'next/link'
import { getActivePlans, getAvailability } from '@/lib/plans'
import { PlanCard } from '@/components/commerce/plan-card'

const STEPS = [
  {
    title: 'Choose a destination',
    body: 'Eight regions, from a week in the UAE to a month of global data.',
  },
  {
    title: 'Pay',
    body: 'Confirmation reaches us from the payment provider directly, never through your browser.',
  },
  {
    title: 'Scan',
    body: 'The QR code and ICCID appear in your account within seconds. Nothing ships.',
  },
]

export default async function HomePage() {
  const [plans, availability] = await Promise.all([getActivePlans(), getAvailability()])
  const featured = plans.slice(0, 3)

  return (
    <>
      <section className="relative overflow-hidden border-b border-border/70">
        {/* Decorative only — a soft accent bloom behind the headline. */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-[-30%] left-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]"
        />

        <div className="relative mx-auto max-w-6xl px-6 py-28 text-center">
          <p className="text-xs tracking-[0.24em] text-muted uppercase">Prepaid eSIM data</p>
          <h1 className="mx-auto mt-6 max-w-3xl text-5xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">
            Land with data already working.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted">
            Buy a plan before you fly. The eSIM arrives in your account the moment
            payment clears — no shop, no plastic, no roaming bill.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/plans"
              className="rounded-lg bg-accent px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-accent-strong"
            >
              Browse plans
            </Link>
            <Link
              href="#how"
              className="rounded-lg border border-border px-6 py-3 text-sm transition-colors hover:border-accent hover:text-accent"
            >
              How it works
            </Link>
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto w-full max-w-6xl px-6 py-20">
        <ol className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="bg-surface p-7">
              <span className="font-mono text-sm text-accent">0{index + 1}</span>
              <h2 className="mt-4 font-medium">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <div className="flex items-end justify-between gap-6">
          <h2 className="text-2xl font-semibold tracking-tight">Popular plans</h2>
          <Link href="/plans" className="text-sm text-muted transition-colors hover:text-accent">
            All plans →
          </Link>
        </div>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((plan) => (
            <li key={plan.id}>
              <PlanCard plan={plan} available={availability.get(plan.id)} />
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

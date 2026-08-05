import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { LoginForm } from './login-form'
import { signInAsDemoAdmin, signInAsDemoCustomer } from './actions'

export const metadata: Metadata = { title: 'Sign in - Easim' }

export default async function LoginPage() {
  // Already signed in? Nothing to do here.
  if (await getUser()) redirect('/account')

  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-3 text-sm text-muted">
        Your eSIMs are delivered to your account, so you need one to buy.
      </p>

      <LoginForm />

      <div className="my-8 flex items-center gap-4">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs tracking-wider text-muted uppercase">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-medium">Reviewing this project?</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Email delivery runs on Supabase&apos;s free mailer, which is rate
          limited to a couple of messages an hour. These buttons sign you into
          seeded accounts with no email round-trip.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <form action={signInAsDemoCustomer}>
            <button
              type="submit"
              className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-accent-strong"
            >
              Sign in as customer
            </button>
          </form>

          <form action={signInAsDemoAdmin}>
            <button
              type="submit"
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm transition-colors hover:border-accent hover:text-accent"
            >
              Sign in as admin
            </button>
          </form>
        </div>
      </div>

      <p className="mt-8 text-xs leading-relaxed text-muted">
        No password is ever created or asked for, and this site collects no card
        details anywhere.
      </p>
    </div>
  )
}

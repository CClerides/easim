'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { signInWithMagicLink, type LoginState } from './actions'

/**
 * Client component only because it shows the action's result and a pending
 * state. The page around it stays a Server Component.
 */
export function LoginForm() {
  const [state, formAction] = useActionState<LoginState, FormData>(signInWithMagicLink, null)

  return (
    <form action={formAction} className="mt-8 space-y-3">
      <label htmlFor="email" className="block text-sm text-muted">
        Email address
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted/60 focus:border-accent"
      />

      <SubmitButton />

      {state ? (
        <p
          role="status"
          className={`text-sm ${state.tone === 'error' ? 'text-danger' : 'text-success'}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg border border-border px-4 py-2.5 text-sm transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
    >
      {pending ? 'Sending…' : 'Email me a sign-in link'}
    </button>
  )
}

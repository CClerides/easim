'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { retryFulfilment, type RetryState } from './actions'

export function RetryButton({ orderId }: { orderId: string }) {
  const [state, formAction] = useActionState<RetryState, FormData>(retryFulfilment, null)

  return (
    <form action={formAction} className="flex flex-col items-end gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <SubmitButton />
      {state ? (
        <p
          role="status"
          className={`max-w-xs text-right text-xs ${
            state.tone === 'success' ? 'text-success' : 'text-danger'
          }`}
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
      className="rounded-md border border-accent px-3 py-1.5 text-xs text-accent transition-colors hover:bg-accent hover:text-background disabled:opacity-50"
    >
      {pending ? 'Retrying…' : 'Retry delivery'}
    </button>
  )
}

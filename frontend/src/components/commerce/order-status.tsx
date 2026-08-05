'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { isTerminal, type OrderStatus } from '@/lib/orders/status'

/**
 * Watches one order and updates the page as it progresses.
 *
 * Two mechanisms, deliberately:
 *
 *   Realtime  — Supabase pushes the row change the instant it happens. Row
 *               level security applies to the subscription too, so a customer
 *               can only ever receive events for an order they may read.
 *   Polling   — a fallback every four seconds. A websocket can fail for
 *               reasons that have nothing to do with us: a proxy, a captive
 *               portal, a phone waking from sleep. Without this, a customer
 *               whose socket died watches "awaiting payment" forever while
 *               their eSIM sits ready.
 *
 * Both stop once the order reaches a terminal state, because nothing more will
 * happen and there is no reason to keep a connection open.
 */
const POLL_INTERVAL_MS = 4_000

export function OrderStatusWatcher({
  orderId,
  initialStatus,
}: {
  orderId: string
  initialStatus: OrderStatus
}) {
  const router = useRouter()
  const [status, setStatus] = useState<OrderStatus>(initialStatus)

  useEffect(() => {
    if (isTerminal(status)) return

    const supabase = createClient()

    const channel = supabase
      .channel(`order:${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        (payload) => {
          const next = (payload.new as { status: OrderStatus }).status
          setStatus(next)
          // Re-render the server component so a delivered eSIM's QR code
          // actually appears, rather than only the badge changing.
          router.refresh()
        },
      )
      .subscribe()

    const poll = setInterval(() => router.refresh(), POLL_INTERVAL_MS)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  }, [orderId, status, router])

  // Keep in step when the server re-renders with a newer status than the one
  // this component last saw.
  useEffect(() => setStatus(initialStatus), [initialStatus])

  return <StatusTimeline status={status} />
}

const STEPS: { key: string; label: string; reached: (status: OrderStatus) => boolean }[] = [
  {
    key: 'placed',
    label: 'Order placed',
    reached: () => true,
  },
  {
    key: 'paid',
    label: 'Payment confirmed',
    reached: (status) => ['paid', 'fulfilling', 'fulfilled', 'fulfilment_failed'].includes(status),
  },
  {
    key: 'delivered',
    label: 'eSIM delivered',
    reached: (status) => status === 'fulfilled',
  },
]

function StatusTimeline({ status }: { status: OrderStatus }) {
  const failed = ['payment_declined', 'payment_timeout', 'cancelled'].includes(status)
  const stuck = status === 'fulfilment_failed'

  return (
    <div>
      <ol className="space-y-4">
        {STEPS.map((step, index) => {
          const done = step.reached(status)
          const active =
            !done &&
            !failed &&
            STEPS.slice(0, index).every((earlier) => earlier.reached(status))

          return (
            <li key={step.key} className="flex items-center gap-3">
              <span
                aria-hidden
                className={`grid size-6 shrink-0 place-items-center rounded-full border text-xs transition-colors ${
                  done
                    ? 'border-success bg-success/15 text-success'
                    : active
                      ? 'border-accent text-accent'
                      : 'border-border text-muted'
                }`}
              >
                {done ? '✓' : index + 1}
              </span>
              <span className={done ? '' : active ? 'text-accent' : 'text-muted'}>
                {step.label}
                {active ? <span className="ml-2 text-sm text-muted">in progress…</span> : null}
              </span>
            </li>
          )
        })}
      </ol>

      {status === 'awaiting_payment' ? (
        <p className="mt-6 rounded-lg border border-border p-4 text-sm text-muted">
          Waiting for the payment provider to confirm. That confirmation reaches
          us directly rather than through your browser, so you can safely leave
          this page — this order will finish without you.
        </p>
      ) : null}

      {status === 'paid' || status === 'fulfilling' ? (
        <p className="mt-6 rounded-lg border border-border p-4 text-sm text-muted">
          Payment confirmed. Issuing your eSIM now — this usually takes a couple
          of seconds.
        </p>
      ) : null}

      {stuck ? (
        <p className="mt-6 rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm text-warning">
          Your payment went through. We could not issue the eSIM yet and are
          retrying — your order is safe and you do not need to do anything.
        </p>
      ) : null}

      {failed ? (
        <p className="mt-6 rounded-lg border border-danger/40 bg-danger/5 p-4 text-sm text-danger">
          {status === 'payment_declined'
            ? 'The payment was declined. Nothing was charged.'
            : status === 'payment_timeout'
              ? 'The payment provider never responded, so this order timed out. Nothing was charged.'
              : 'This order was cancelled.'}
        </p>
      ) : null}
    </div>
  )
}

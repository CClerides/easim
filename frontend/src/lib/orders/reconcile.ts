import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { fulfilOrder, MAX_FULFILMENT_ATTEMPTS } from './fulfilment'
import type { OrderStatus } from './status'

/**
 * Reader-driven reconciliation — this project's replacement for a scheduler.
 *
 * Vercel's free plan runs a cron job once per day, which is useless for a
 * ninety-second payment deadline, and a paid plan is out of budget for an
 * assessment. So instead of a background worker sweeping the database,
 * *reading* an order brings it up to date.
 *
 * That works here because the people who care about an order are the ones
 * looking at it: the customer watching their receipt, the customer opening
 * their account, the admin scanning for failures. Every one of those reads
 * calls this first.
 *
 * The honest trade-off, stated in the README: an order nobody ever looks at
 * stays stale. A durable queue is the production answer.
 */

export type ReconcilableOrder = {
  id: string
  status: OrderStatus
  payment_deadline_at: string | null
}

/** Pure: has this order waited too long to be paid? */
export function hasPaymentExpired(order: ReconcilableOrder, now = Date.now()): boolean {
  if (order.status !== 'awaiting_payment') return false
  if (!order.payment_deadline_at) return false
  return new Date(order.payment_deadline_at).getTime() <= now
}

/** Pure: is a failed line item due another automatic attempt? */
export function isRetryDue(
  fulfilment: { status: string; attempts: number; next_attempt_at: string | null },
  now = Date.now(),
): boolean {
  if (fulfilment.status !== 'failed') return false
  if (fulfilment.attempts >= MAX_FULFILMENT_ATTEMPTS) return false
  if (!fulfilment.next_attempt_at) return false
  return new Date(fulfilment.next_attempt_at).getTime() <= now
}

/**
 * Bring one order up to date, returning its current status.
 *
 * Call before rendering an order anywhere.
 */
export async function reconcileOrder(order: ReconcilableOrder): Promise<OrderStatus> {
  if (hasPaymentExpired(order)) {
    const supabase = createAdminClient()

    // Scoped to `awaiting_payment` so a confirmation landing in the same
    // instant wins rather than being overwritten by this timeout.
    const { data } = await supabase
      .from('orders')
      .update({ status: 'payment_timeout', updated_at: new Date().toISOString() })
      .eq('id', order.id)
      .eq('status', 'awaiting_payment')
      .select('status')
      .maybeSingle()

    return (data?.status as OrderStatus) ?? order.status
  }

  if (order.status === 'fulfilment_failed') {
    const supabase = createAdminClient()

    const { data: items } = await supabase
      .from('order_items')
      .select('id, fulfilments(status, attempts, next_attempt_at)')
      .eq('order_id', order.id)

    const due = (items ?? []).some((item) => {
      const fulfilment = item.fulfilments as unknown as {
        status: string
        attempts: number
        next_attempt_at: string | null
      } | null
      return fulfilment ? isRetryDue(fulfilment) : false
    })

    if (due) {
      const outcome = await fulfilOrder(order.id)
      return outcome.status
    }
  }

  return order.status
}

/** Reconcile a list, preserving order. Used by the account and admin views. */
export async function reconcileOrders(orders: ReconcilableOrder[]): Promise<OrderStatus[]> {
  return Promise.all(orders.map((order) => reconcileOrder(order)))
}

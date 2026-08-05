import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatPrice } from '@/lib/format'
import type { OrderStatus } from '@/lib/orders/status'

export const metadata: Metadata = { title: 'Your order — Easim' }

/**
 * The receipt.
 *
 * Task 10 adds live status updates and the eSIM credential. For now it proves
 * the order exists and shows where it has reached.
 *
 * Note there is no `where user_id = ...` here. The query runs as the signed-in
 * user, and row level security returns nothing for an order belonging to
 * somebody else — which surfaces as a 404, exactly as it should.
 */
export default async function OrderPage({ params }: PageProps<'/orders/[id]'>) {
  const { id } = await params
  await requireUser()

  const supabase = await createClient()
  const { data: order } = await supabase
    .from('orders')
    .select('id, status, total_cents, currency, created_at, scenario')
    .eq('id', id)
    .maybeSingle()

  if (!order) notFound()

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16">
      <p className="text-sm tracking-[0.18em] text-muted uppercase">Order</p>
      <h1 className="mt-3 font-mono text-2xl break-all">{order.id}</h1>

      <div className="mt-10 rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">Status</span>
          <StatusBadge status={order.status} />
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-muted">Total</span>
          <span className="font-medium tabular-nums">{formatPrice(order.total_cents)}</span>
        </div>
      </div>

      <p className="mt-8 text-sm text-muted">{EXPLANATIONS[order.status as OrderStatus]}</p>
    </div>
  )
}

const EXPLANATIONS: Record<OrderStatus, string> = {
  created: 'Your order has been created and payment is about to be requested.',
  awaiting_payment:
    'Waiting for the payment provider to confirm. That confirmation reaches us directly, not through your browser, so you can safely leave this page.',
  paid: 'Payment confirmed. Your eSIM is being provisioned now.',
  fulfilling: 'Provisioning your eSIM.',
  fulfilled: 'Delivered. Your eSIM is in your account.',
  fulfilment_failed:
    'Your payment went through, but we could not issue the eSIM yet. The order is safe and is being retried — you do not need to do anything.',
  payment_declined: 'The payment was declined. Nothing was charged.',
  payment_timeout: 'The payment provider never responded, so the order timed out. Nothing was charged.',
  cancelled: 'This order was cancelled.',
  refunded: 'This order has been refunded.',
}

const TONES: Record<OrderStatus, string> = {
  created: 'border-border text-muted',
  awaiting_payment: 'border-warning/40 text-warning',
  paid: 'border-accent/40 text-accent',
  fulfilling: 'border-accent/40 text-accent',
  fulfilled: 'border-success/40 text-success',
  fulfilment_failed: 'border-danger/40 text-danger',
  payment_declined: 'border-danger/40 text-danger',
  payment_timeout: 'border-danger/40 text-danger',
  cancelled: 'border-border text-muted',
  refunded: 'border-border text-muted',
}

function StatusBadge({ status }: { status: string }) {
  const key = status as OrderStatus
  return (
    <span className={`rounded-full border px-3 py-1 text-xs ${TONES[key] ?? 'border-border'}`}>
      {status.replaceAll('_', ' ')}
    </span>
  )
}

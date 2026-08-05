import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatData, formatDuration, formatPrice } from '@/lib/format'
import type { OrderStatus } from '@/lib/orders/status'
import { reconcileOrder } from '@/lib/orders/reconcile'
import { ClearCartOnOrder } from '@/components/commerce/clear-cart-on-order'
import { OrderStatusWatcher } from '@/components/commerce/order-status'
import { EsimCredential } from '@/components/commerce/esim-credential'

export const metadata: Metadata = { title: 'Your order — Easim' }

type OrderRow = {
  id: string
  status: OrderStatus
  total_cents: number
  created_at: string
  payment_deadline_at: string | null
  order_items: {
    id: string
    qty: number
    unit_price_cents: number
    plans: { region: string; slug: string; data_mb: number; duration_days: number } | null
    fulfilments: {
      status: string
      last_error: string | null
      esim_profiles: { iccid: string; activation_code: string } | null
    } | null
  }[]
}

/**
 * The receipt, and where a customer watches their eSIM arrive.
 *
 * Dynamic on every request — an order's status is the least cacheable thing in
 * the application.
 *
 * There is no `where user_id = ...` anywhere below. The query runs as the
 * signed-in user and row level security returns nothing for somebody else's
 * order, which surfaces as a 404. The protection is in the database, not in a
 * condition somebody could forget to write.
 */
export default async function OrderPage({ params, searchParams }: PageProps<'/orders/[id]'>) {
  const { id } = await params
  const { placed } = await searchParams
  await requireUser()

  const supabase = await createClient()
  const { data } = await supabase
    .from('orders')
    .select(
      `id, status, total_cents, created_at, payment_deadline_at,
       order_items(id, qty, unit_price_cents,
         plans(region, slug, data_mb, duration_days),
         fulfilments(status, last_error, esim_profiles(iccid, activation_code)))`,
    )
    .eq('id', id)
    .maybeSingle()

  if (!data) notFound()

  const order = data as unknown as OrderRow

  // Reading is what advances an order here — there is no scheduler. An order
  // past its payment deadline becomes payment_timeout now; a failed fulfilment
  // whose backoff has elapsed is retried now.
  const status = await reconcileOrder({
    id: order.id,
    status: order.status,
    payment_deadline_at: order.payment_deadline_at,
  })

  const delivered = order.order_items.filter(
    (item) => item.fulfilments?.status === 'succeeded' && item.fulfilments.esim_profiles,
  )

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16">
      {placed ? <ClearCartOnOrder /> : null}

      <p className="text-sm tracking-[0.18em] text-muted uppercase">Order</p>
      <h1 className="mt-2 font-mono text-lg break-all text-muted">{order.id}</h1>

      <section className="mt-10 rounded-xl border border-border bg-surface p-6">
        <OrderStatusWatcher orderId={order.id} initialStatus={status} />
      </section>

      {delivered.length > 0 ? (
        <section className="mt-8 space-y-4">
          <h2 className="text-lg font-medium">Your eSIM{delivered.length > 1 ? 's' : ''}</h2>
          {delivered.map((item) => (
            <EsimCredential
              key={item.id}
              region={item.plans?.region ?? 'eSIM'}
              iccid={item.fulfilments!.esim_profiles!.iccid}
              activationCode={item.fulfilments!.esim_profiles!.activation_code}
            />
          ))}
        </section>
      ) : null}

      <section className="mt-8 overflow-hidden rounded-xl border border-border bg-surface">
        <h2 className="border-b border-border px-5 py-4 text-sm font-medium">Receipt</h2>
        <ul className="divide-y divide-border">
          {order.order_items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="font-medium">
                  {item.plans?.region ?? 'Plan'}
                  {item.qty > 1 ? <span className="text-muted"> × {item.qty}</span> : null}
                </p>
                {item.plans ? (
                  <p className="mt-0.5 text-sm text-muted">
                    {formatData(item.plans.data_mb)} · {formatDuration(item.plans.duration_days)}
                  </p>
                ) : null}
                {item.fulfilments?.status === 'failed' ? (
                  <p className="mt-1 font-mono text-xs text-danger">
                    delivery error: {item.fulfilments.last_error}
                  </p>
                ) : null}
              </div>
              <p className="tabular-nums">
                {formatPrice(item.unit_price_cents * item.qty)}
              </p>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-border px-5 py-4">
          <span className="text-sm text-muted">Total paid</span>
          <span className="text-xl font-semibold tabular-nums">
            {formatPrice(order.total_cents)}
          </span>
        </div>
      </section>

      <div className="mt-8 flex gap-4 text-sm">
        <Link href="/account" className="text-accent underline underline-offset-4">
          All your orders
        </Link>
        <Link href="/plans" className="text-muted underline underline-offset-4 hover:text-accent">
          Buy another plan
        </Link>
      </div>
    </div>
  )
}

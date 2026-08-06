import type { Metadata } from 'next'
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatPrice } from '@/lib/format'
import type { OrderStatus } from '@/lib/orders/status'
import { reconcileOrders } from '@/lib/orders/reconcile'
import { EsimCredential } from '@/components/commerce/esim-credential'
import { OrderStatusBadge } from '@/components/commerce/order-status-badge'

export const metadata: Metadata = { title: 'Your account - Easim' }

type AccountOrder = {
  id: string
  status: OrderStatus
  total_cents: number
  created_at: string
  payment_deadline_at: string | null
  order_items: {
    id: string
    qty: number
    plans: { region: string } | null
    fulfilments: {
      status: string
      esim_profiles: { iccid: string; activation_code: string } | null
    } | null
  }[]
}

/**
 * Everything this customer has bought.
 *
 * Two sections: the eSIMs they can actually use, and the history behind them.
 *
 * Worth noticing what is missing from the query - there is no filter by user.
 * The client runs as the signed-in person and row level security returns only
 * their rows. Isolation is enforced by the database rather than by a condition
 * in application code that a future edit could drop.
 */
export default async function AccountPage() {
  const user = await requireUser()

  const supabase = await createClient()
  const { data } = await supabase
    .from('orders')
    .select(
      `id, status, total_cents, created_at, payment_deadline_at,
       order_items(id, qty,
         plans(region),
         fulfilments(status, esim_profiles(iccid, activation_code)))`,
    )
    .order('created_at', { ascending: false })

  const orders = (data ?? []) as unknown as AccountOrder[]

  // No scheduler: loading this page is what times out a stale order and
  // retries a failed delivery whose backoff has elapsed.
  const statuses = await reconcileOrders(
    orders.map((order) => ({
      id: order.id,
      status: order.status,
      payment_deadline_at: order.payment_deadline_at,
    })),
  )

  const esims = orders.flatMap((order) =>
    order.order_items
      .filter((item) => item.fulfilments?.status === 'succeeded' && item.fulfilments.esim_profiles)
      .map((item) => ({
        key: item.id,
        region: item.plans?.region ?? 'eSIM',
        iccid: item.fulfilments!.esim_profiles!.iccid,
        activationCode: item.fulfilments!.esim_profiles!.activation_code,
      })),
  )

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Your account</h1>
      <p className="mt-2 text-sm text-muted">{user.email}</p>

      <section className="mt-12">
        <h2 className="text-lg font-medium">Your eSIMs</h2>

        {esims.length === 0 ? (
          <div className="mt-4 rounded-xl border border-border bg-surface p-8">
            <p className="text-sm text-muted">
              Nothing delivered yet. Buy a plan and its QR code appears here
              within seconds.
            </p>
            <Link
              href="/plans"
              className="btn btn-primary mt-6 px-5 py-2.5"
            >
              Browse plans
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {esims.map((esim) => (
              <EsimCredential
                key={esim.key}
                region={esim.region}
                iccid={esim.iccid}
                activationCode={esim.activationCode}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-14">
        <h2 className="text-lg font-medium">Order history</h2>

        {orders.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No orders yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {orders.map((order, index) => (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-surface-raised"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      {order.order_items
                        .map((item) => item.plans?.region ?? 'Plan')
                        .join(', ')}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-muted">
                      {new Date(order.created_at).toLocaleString('en-IE', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <OrderStatusBadge status={statuses[index]} />
                    <span className="tabular-nums">{formatPrice(order.total_cents)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

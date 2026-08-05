import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatPrice } from '@/lib/format'
import type { OrderStatus } from '@/lib/orders/status'
import { reconcileOrders } from '@/lib/orders/reconcile'
import { OrderStatusBadge } from '@/components/commerce/order-status-badge'
import { RetryButton } from './retry-button'

export const metadata: Metadata = { title: 'Admin — Easim' }

type AdminOrder = {
  id: string
  status: OrderStatus
  total_cents: number
  created_at: string
  payment_deadline_at: string | null
  scenario: string
  user_id: string
  order_items: {
    id: string
    qty: number
    plans: { region: string } | null
    fulfilments: { status: string; attempts: number; last_error: string | null } | null
  }[]
}

/**
 * Look up who each order belongs to.
 *
 * A separate query because orders reference auth.users while emails live on
 * profiles, and PostgREST will not join across that. Degrades quietly: if the
 * profiles policy has not been widened for admins, the list still renders with
 * the customer unnamed rather than failing outright.
 */
async function customerEmails(userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)]
  if (unique.length === 0) return new Map()

  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('id, email').in('id', unique)

  return new Map((data ?? []).map((row) => [row.id, row.email]))
}

const FILTERS = [
  { key: 'attention', label: 'Needs attention' },
  { key: 'all', label: 'All orders' },
] as const

/**
 * Operations view.
 *
 * Defaults to the orders that need a human rather than to everything, because
 * a list of a thousand healthy orders buries the one that is broken.
 *
 * Admin sees every order because `is_admin()` widens the row level security
 * policies (db/migrations/0002_rls.sql) — not because this page uses a key
 * that bypasses them.
 */
export default async function AdminPage({ searchParams }: PageProps<'/admin'>) {
  await requireAdmin()

  const { filter } = await searchParams
  const showAll = filter === 'all'

  const supabase = await createClient()

  // No `profiles(email)` embed here, deliberately. `orders.user_id` references
  // auth.users, not profiles, so PostgREST cannot infer that relationship and
  // rejects the query. Customer emails are fetched separately below.
  const { data, error } = await supabase
    .from('orders')
    .select(
      `id, status, total_cents, created_at, payment_deadline_at, scenario, user_id,
       order_items(id, qty, plans(region), fulfilments(status, attempts, last_error))`,
    )
    .order('created_at', { ascending: false })
    .limit(100)

  // Surfaced rather than swallowed. An earlier version ignored this, and a
  // rejected query rendered as "no orders yet" — a broken page that looked
  // like a quiet one, which is the worst way for an operations view to fail.
  if (error) {
    throw new Error(`Could not load orders: ${error.message}`)
  }

  const orders = (data ?? []) as unknown as AdminOrder[]

  const emails = await customerEmails(orders.map((order) => order.user_id))

  const statuses = await reconcileOrders(
    orders.map((order) => ({
      id: order.id,
      status: order.status,
      payment_deadline_at: order.payment_deadline_at,
    })),
  )

  const rows = orders
    .map((order, index) => ({ order, status: statuses[index] }))
    .filter(({ status }) => showAll || status === 'fulfilment_failed')

  const failingCount = statuses.filter((status) => status === 'fulfilment_failed').length

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
          <p className="mt-2 text-sm text-muted">
            {failingCount === 0
              ? 'Nothing needs attention.'
              : `${failingCount} order${failingCount === 1 ? '' : 's'} could not be delivered.`}
          </p>
        </div>

        <nav className="flex gap-2 text-sm">
          {FILTERS.map((option) => {
            const active = option.key === 'all' ? showAll : !showAll
            return (
              <Link
                key={option.key}
                href={option.key === 'all' ? '/admin?filter=all' : '/admin'}
                className={`rounded-md border px-3 py-1.5 transition-colors ${
                  active
                    ? 'border-accent text-accent'
                    : 'border-border text-muted hover:text-foreground'
                }`}
              >
                {option.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-xl border border-border bg-surface p-8">
          <p className="text-sm text-muted">
            {showAll ? 'No orders yet.' : 'No failed deliveries. Everything has been delivered.'}
          </p>
        </div>
      ) : (
        <ul className="mt-10 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {rows.map(({ order, status }) => (
            <li key={order.id} className="flex flex-wrap items-start justify-between gap-4 p-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <OrderStatusBadge status={status} />
                  <Link
                    href={`/orders/${order.id}`}
                    className="font-mono text-xs break-all text-muted hover:text-accent"
                  >
                    {order.id}
                  </Link>
                </div>

                <p className="mt-2 text-sm">
                  {emails.get(order.user_id) ?? 'customer'} ·{' '}
                  {order.order_items.map((item) => item.plans?.region ?? 'Plan').join(', ')}
                </p>

                <p className="mt-1 text-xs text-muted">
                  {new Date(order.created_at).toLocaleString('en-IE', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                  {' · scenario: '}
                  <code className="font-mono">{order.scenario}</code>
                </p>

                {order.order_items
                  .filter((item) => item.fulfilments?.status === 'failed')
                  .map((item) => (
                    <p key={item.id} className="mt-1 font-mono text-xs text-danger">
                      {item.plans?.region}: {item.fulfilments!.last_error} (attempt{' '}
                      {item.fulfilments!.attempts})
                    </p>
                  ))}
              </div>

              <div className="flex flex-col items-end gap-3">
                <span className="tabular-nums">{formatPrice(order.total_cents)}</span>
                {status === 'fulfilment_failed' ? <RetryButton orderId={order.id} /> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

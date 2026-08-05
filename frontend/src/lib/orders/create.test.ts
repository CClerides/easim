import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { createOrder } from './create'

/**
 * Order creation, against the real database.
 *
 * These are integration tests on purpose. The two behaviours that matter —
 * that the browser cannot name a price, and that submitting the same checkout
 * twice creates one order — are both enforced by Postgres constraints. Mocking
 * the database would test the mock rather than the guarantee.
 *
 * Rows created here are deleted afterwards.
 */
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false } },
)

let userId: string
let planId: string
let planPriceCents: number
const createdOrderIds: string[] = []

beforeAll(async () => {
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', process.env.DEMO_CUSTOMER_EMAIL!)
    .single()
  userId = profile!.id

  const { data: plan } = await admin
    .from('plans')
    .select('id, price_cents')
    .eq('slug', 'europe-5gb-15d')
    .single()
  planId = plan!.id
  planPriceCents = plan!.price_cents
})

afterEach(async () => {
  if (createdOrderIds.length === 0) return
  await admin.from('orders').delete().in('id', createdOrderIds)
  createdOrderIds.length = 0
})

function track<T extends { ok: boolean }>(result: T): T {
  if (result.ok && 'orderId' in result) createdOrderIds.push(result.orderId as string)
  return result
}

describe('createOrder', () => {
  it('prices the order from the database, not from the caller', async () => {
    const result = track(
      await createOrder({
        userId,
        items: [{ planId, qty: 2 }],
        idempotencyKey: randomUUID(),
        scenario: 'approve',
      }),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.totalCents).toBe(planPriceCents * 2)

    const { data: items } = await admin
      .from('order_items')
      .select('unit_price_cents, qty')
      .eq('order_id', result.orderId)

    expect(items).toHaveLength(1)
    expect(items![0].unit_price_cents).toBe(planPriceCents)
  })

  /** The double-clicked-button case. */
  it('returns the same order when the same idempotency key is used twice', async () => {
    const key = randomUUID()
    const input = {
      userId,
      items: [{ planId, qty: 1 }],
      idempotencyKey: key,
      scenario: 'approve' as const,
    }

    const first = track(await createOrder(input))
    const second = track(await createOrder(input))

    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return

    expect(second.orderId).toBe(first.orderId)
    expect(second.reused).toBe(true)
    expect(first.reused).toBe(false)

    const { data: orders } = await admin
      .from('orders')
      .select('id')
      .eq('user_id', userId)
      .eq('idempotency_key', key)

    expect(orders).toHaveLength(1)
  })

  it('survives two simultaneous submissions, not just two sequential ones', async () => {
    const key = randomUUID()
    const input = {
      userId,
      items: [{ planId, qty: 1 }],
      idempotencyKey: key,
      scenario: 'approve' as const,
    }

    const [a, b] = await Promise.all([createOrder(input), createOrder(input)])
    track(a)
    track(b)

    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect(a.orderId).toBe(b.orderId)

    const { data: orders } = await admin
      .from('orders')
      .select('id')
      .eq('user_id', userId)
      .eq('idempotency_key', key)

    expect(orders).toHaveLength(1)
  })

  it('rejects an empty cart', async () => {
    const result = await createOrder({
      userId,
      items: [],
      idempotencyKey: randomUUID(),
      scenario: 'approve',
    })
    expect(result).toEqual({ ok: false, error: 'empty_cart' })
  })

  it('rejects a plan that does not exist, rather than pricing it at zero', async () => {
    const result = await createOrder({
      userId,
      items: [{ planId: randomUUID(), qty: 1 }],
      idempotencyKey: randomUUID(),
      scenario: 'approve',
    })
    expect(result).toEqual({ ok: false, error: 'unknown_plan' })
  })

  it('writes a payment deadline so the order can time out on its own', async () => {
    const result = track(
      await createOrder({
        userId,
        items: [{ planId, qty: 1 }],
        idempotencyKey: randomUUID(),
        scenario: 'timeout',
      }),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const { data: order } = await admin
      .from('orders')
      .select('payment_deadline_at, scenario, status')
      .eq('id', result.orderId)
      .single()

    expect(order!.payment_deadline_at).not.toBeNull()
    expect(order!.scenario).toBe('timeout')
    expect(order!.status).toBe('created')
  })
})

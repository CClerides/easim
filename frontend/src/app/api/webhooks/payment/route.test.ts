import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { sign } from '@/lib/security/hmac'
import { adminClient, releaseProfilesForOrders, releaseStrandedReservations } from '@/test/db'

/**
 * The payment webhook, exercised over real HTTP against the running app.
 *
 * This endpoint is a public URL. These tests are written from the position of
 * someone who has found it and is poking at it, plus the provider legitimately
 * delivering the same message twice.
 *
 * Needs `pnpm dev`. Skips with a reason if it is not running.
 */
const admin = adminClient()

const ENDPOINT = `${process.env.APP_BASE_URL}/api/webhooks/payment`
const SECRET = process.env.PROVIDER_HMAC_SECRET!

let userId: string
let appUp = false
const orderIds: string[] = []
const eventIds: string[] = []

beforeAll(async () => {
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', process.env.DEMO_CUSTOMER_EMAIL!)
    .single()
  userId = profile!.id

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      body: '{}',
      signal: AbortSignal.timeout(3000),
    })
    // 401 is the healthy answer to an unsigned probe: the app is up.
    appUp = response.status === 401
  } catch {
    appUp = false
  }
})

afterEach(async () => {
  await releaseProfilesForOrders(admin, orderIds)

  if (orderIds.length > 0) {
    await admin.from('orders').delete().in('id', orderIds)
    orderIds.length = 0
  }
  if (eventIds.length > 0) {
    await admin.from('webhook_events').delete().in('provider_event_id', eventIds)
    eventIds.length = 0
  }
  await releaseStrandedReservations(admin)
})

async function seedAwaitingOrder(scenario = 'approve'): Promise<string> {
  const { data: plan } = await admin
    .from('plans')
    .select('id, price_cents')
    .eq('slug', 'europe-5gb-15d')
    .single()

  const { data: order } = await admin
    .from('orders')
    .insert({
      user_id: userId,
      status: 'awaiting_payment',
      subtotal_cents: plan!.price_cents,
      total_cents: plan!.price_cents,
      scenario,
      idempotency_key: randomUUID(),
      payment_deadline_at: new Date(Date.now() + 90_000).toISOString(),
    })
    .select('id')
    .single()

  await admin.from('order_items').insert({
    order_id: order!.id,
    plan_id: plan!.id,
    qty: 1,
    unit_price_cents: plan!.price_cents,
  })

  orderIds.push(order!.id)
  return order!.id
}

function buildEvent(orderId: string, overrides: Record<string, unknown> = {}) {
  const eventId = `evt_${randomUUID()}`
  eventIds.push(eventId)

  return {
    eventId,
    type: 'payment.succeeded',
    providerRef: `pay_${randomUUID()}`,
    orderId,
    amountCents: 1490,
    currency: 'EUR',
    failureReason: null,
    occurredAt: new Date().toISOString(),
    ...overrides,
  }
}

async function post(
  body: unknown,
  options: { timestamp?: string; signature?: string } = {},
): Promise<Response> {
  const raw = JSON.stringify(body)
  const timestamp = options.timestamp ?? String(Date.now())
  const signature = options.signature ?? sign(raw, timestamp, SECRET)

  return fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-provider-timestamp': timestamp,
      'x-provider-signature': signature,
    },
    body: raw,
  })
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 2500))

describe('payment webhook — rejecting what it should', () => {
  it('refuses an unsigned request', async ({ skip }) => {
    if (!appUp) skip('app not running — run pnpm dev')

    const orderId = await seedAwaitingOrder()
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildEvent(orderId)),
    })

    expect(response.status).toBe(401)

    const { data: order } = await admin
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single()
    expect(order!.status).toBe('awaiting_payment')
  })

  it('refuses a forged signature', async ({ skip }) => {
    if (!appUp) skip('app not running — run pnpm dev')

    const orderId = await seedAwaitingOrder()
    const response = await post(buildEvent(orderId), { signature: 'a'.repeat(64) })

    expect(response.status).toBe(401)
  })

  it('refuses a body altered after signing', async ({ skip }) => {
    if (!appUp) skip('app not running — run pnpm dev')

    const orderId = await seedAwaitingOrder()
    const event = buildEvent(orderId)
    const timestamp = String(Date.now())
    const signature = sign(JSON.stringify(event), timestamp, SECRET)

    // Same signature, different body — the classic tamper.
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-provider-timestamp': timestamp,
        'x-provider-signature': signature,
      },
      body: JSON.stringify({ ...event, amountCents: 1 }),
    })

    expect(response.status).toBe(401)
  })

  it('refuses a replay from outside the time window', async ({ skip }) => {
    if (!appUp) skip('app not running — run pnpm dev')

    const orderId = await seedAwaitingOrder()
    const old = String(Date.now() - 10 * 60 * 1000)
    const response = await post(buildEvent(orderId), { timestamp: old })

    expect(response.status).toBe(401)
  })

  it('acknowledges an event for an order it does not have', async ({ skip }) => {
    if (!appUp) skip('app not running — run pnpm dev')

    // 200, not an error: a rejection makes the provider retry an order that
    // will never exist, forever.
    const response = await post(buildEvent(randomUUID()))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'ignored_unknown_order' })
  })
})

describe('payment webhook — the happy path and its duplicate', () => {
  it('confirms the order and delivers the eSIM', async ({ skip }) => {
    if (!appUp) skip('app not running — run pnpm dev')

    const orderId = await seedAwaitingOrder('approve')
    const response = await post(buildEvent(orderId))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'accepted' })

    await settle()

    const { data: order } = await admin
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single()
    expect(order!.status).toBe('fulfilled')
  })

  /**
   * The single most important test in the suite. A payment provider is
   * entitled to deliver the same event twice.
   */
  it('processes the same event id exactly once', async ({ skip }) => {
    if (!appUp) skip('app not running — run pnpm dev')

    const orderId = await seedAwaitingOrder('approve')
    const event = buildEvent(orderId)

    const first = await post(event)
    const second = await post(event)

    expect(first.status).toBe(200)
    expect(await first.json()).toMatchObject({ status: 'accepted' })

    expect(second.status).toBe(200)
    expect(await second.json()).toMatchObject({ status: 'duplicate' })

    await settle()

    const { data: items } = await admin
      .from('order_items')
      .select('id')
      .eq('order_id', orderId)
    const { count } = await admin
      .from('fulfilments')
      .select('id', { count: 'exact', head: true })
      .eq('order_item_id', items![0].id)

    // One eSIM, not two.
    expect(count).toBe(1)
  })

  it('marks a declined payment without touching inventory', async ({ skip }) => {
    if (!appUp) skip('app not running — run pnpm dev')

    const { count: before } = await admin
      .from('esim_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'available')

    const orderId = await seedAwaitingOrder('decline')
    const response = await post(
      buildEvent(orderId, { type: 'payment.declined', failureReason: 'card_declined' }),
    )

    expect(response.status).toBe(200)
    await settle()

    const { data: order } = await admin
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single()
    expect(order!.status).toBe('payment_declined')

    const { count: after } = await admin
      .from('esim_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'available')
    expect(after).toBe(before)
  })

  /** A confirmation arriving after the order timed out must not revive it. */
  it('ignores a confirmation for an order that already timed out', async ({ skip }) => {
    if (!appUp) skip('app not running — run pnpm dev')

    const orderId = await seedAwaitingOrder('approve')
    await admin.from('orders').update({ status: 'payment_timeout' }).eq('id', orderId)

    const response = await post(buildEvent(orderId))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'ignored_illegal_transition' })

    const { data: order } = await admin
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single()
    expect(order!.status).toBe('payment_timeout')
  })
})

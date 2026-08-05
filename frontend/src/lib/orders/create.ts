import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateTotals } from './pricing'
import type { PaymentScenario } from '@easim/mock-provider'

/**
 * Creating an order.
 *
 * This is where the browser stops being trusted. It sends plan ids and
 * quantities; everything that matters — what those plans cost, what the total
 * is, who the order belongs to — is decided here, from the database.
 *
 * Writes use the secret-key client because no table grants write access to
 * anyone else (see db/migrations/0002_rls.sql). The caller is responsible for
 * having established who the user is; every path into this function starts
 * with requireUser().
 */

/** How long a payment may stay unconfirmed before it counts as timed out. */
export const PAYMENT_DEADLINE_MS = 90_000

export type CreateOrderInput = {
  userId: string
  items: { planId: string; qty: number }[]
  idempotencyKey: string
  scenario: PaymentScenario
}

export type CreateOrderResult =
  | { ok: true; orderId: string; totalCents: number; reused: boolean }
  | { ok: false; error: 'empty_cart' | 'unknown_plan' | 'failed' }

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  if (input.items.length === 0) return { ok: false, error: 'empty_cart' }

  const supabase = createAdminClient()

  // One query for every plan in the cart, then check we got them all. A plan
  // that is inactive or invented is a rejected order, not a zero-price line.
  const planIds = input.items.map((item) => item.planId)
  const { data: plans, error: plansError } = await supabase
    .from('plans')
    .select('id, price_cents, currency')
    .in('id', planIds)
    .eq('active', true)

  if (plansError) return { ok: false, error: 'failed' }
  if (!plans || plans.length !== new Set(planIds).size) {
    return { ok: false, error: 'unknown_plan' }
  }

  const priceById = new Map(plans.map((plan) => [plan.id, plan.price_cents]))

  const priced = input.items.map((item) => ({
    planId: item.planId,
    qty: item.qty,
    // Non-null assertion is safe: the length check above proves every id
    // in the cart came back from the database.
    unitPriceCents: priceById.get(item.planId)!,
  }))

  const { subtotalCents, totalCents } = calculateTotals(priced)

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: input.userId,
      status: 'created',
      subtotal_cents: subtotalCents,
      total_cents: totalCents,
      currency: 'EUR',
      scenario: input.scenario,
      idempotency_key: input.idempotencyKey,
      payment_deadline_at: new Date(Date.now() + PAYMENT_DEADLINE_MS).toISOString(),
    })
    .select('id, total_cents')
    .single()

  if (orderError) {
    // 23505 is a unique violation. Here it can only be
    // orders(user_id, idempotency_key): this exact checkout was already
    // submitted, so return the order that already exists rather than
    // charging the customer twice for a double-clicked button.
    if (orderError.code === '23505') {
      const { data: existing } = await supabase
        .from('orders')
        .select('id, total_cents')
        .eq('user_id', input.userId)
        .eq('idempotency_key', input.idempotencyKey)
        .maybeSingle()

      if (existing) {
        return { ok: true, orderId: existing.id, totalCents: existing.total_cents, reused: true }
      }
    }
    return { ok: false, error: 'failed' }
  }

  const { error: itemsError } = await supabase.from('order_items').insert(
    priced.map((item) => ({
      order_id: order.id,
      plan_id: item.planId,
      qty: item.qty,
      unit_price_cents: item.unitPriceCents,
    })),
  )

  if (itemsError) {
    // An order with no lines is worse than no order: it would sit in the admin
    // view forever meaning nothing. Postgres has no transaction across two
    // PostgREST calls, so clean up explicitly.
    await supabase.from('orders').delete().eq('id', order.id)
    return { ok: false, error: 'failed' }
  }

  return { ok: true, orderId: order.id, totalCents: order.total_cents, reused: false }
}

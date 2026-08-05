'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createOrder } from '@/lib/orders/create'
import { assertTransition } from '@/lib/orders/status'
import { authorizePayment } from '@/lib/provider/client'
import { MAX_QTY_PER_PLAN } from '@/lib/cart/items'
import { PAYMENT_SCENARIOS, type PaymentScenario } from '@easim/mock-provider'

export type CheckoutState = { error: string } | null

/**
 * Everything arriving from the browser, and nothing else. Note what is absent:
 * no price, no total, no user id. Those are the server's to decide.
 */
const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        planId: z.uuid(),
        qty: z.number().int().min(1).max(MAX_QTY_PER_PLAN),
      }),
    )
    .min(1)
    .max(20),
  idempotencyKey: z.uuid(),
  scenario: z.enum(PAYMENT_SCENARIOS as [PaymentScenario, ...PaymentScenario[]]),
})

export async function placeOrder(
  _previous: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const user = await requireUser()

  let payload: unknown
  try {
    payload = JSON.parse(String(formData.get('payload') ?? ''))
  } catch {
    return { error: 'That order could not be read. Please try again.' }
  }

  const parsed = checkoutSchema.safeParse(payload)
  if (!parsed.success) {
    return { error: 'That order was not valid. Please reload and try again.' }
  }

  const created = await createOrder({
    userId: user.id,
    items: parsed.data.items,
    idempotencyKey: parsed.data.idempotencyKey,
    scenario: parsed.data.scenario,
  })

  if (!created.ok) {
    const messages = {
      empty_cart: 'Your cart is empty.',
      unknown_plan: 'One of those plans is no longer available. Please reload your cart.',
      failed: 'We could not create that order. Please try again.',
    }
    return { error: messages[created.error] }
  }

  // A repeat submission of the same checkout already has its payment under
  // way. Asking the provider again would authorise twice.
  if (!created.reused) {
    const requested = await requestPayment(created.orderId, created.totalCents, parsed.data.scenario)
    if (!requested) {
      return { error: 'The payment service is unreachable. Your order was not charged.' }
    }
  }

  // `placed=1` tells the receipt page to empty the cart. The cart lives in
  // localStorage, which no server action can reach.
  //
  // Outside the try/catch: redirect() works by throwing, so catching around it
  // would swallow the navigation.
  redirect(`/orders/${created.orderId}?placed=1`)
}

/**
 * Move the order to awaiting_payment and ask the provider to authorise.
 *
 * The provider answers 202 immediately and delivers the real outcome later, by
 * callback. Nothing here learns whether the payment succeeded, and that is the
 * point — the browser is never told either.
 */
async function requestPayment(
  orderId: string,
  totalCents: number,
  scenario: PaymentScenario,
): Promise<boolean> {
  const supabase = createAdminClient()

  const { data: order } = await supabase
    .from('orders')
    .select('status')
    .eq('id', orderId)
    .single()

  if (!order) return false

  assertTransition(order.status, 'awaiting_payment')

  try {
    const { providerRef } = await authorizePayment({
      orderId,
      amountCents: totalCents,
      currency: 'EUR',
      scenario,
    })

    await supabase.from('payments').insert({
      order_id: orderId,
      provider_ref: providerRef,
      status: 'requested',
      amount_cents: totalCents,
    })

    await supabase
      .from('orders')
      .update({ status: 'awaiting_payment', updated_at: new Date().toISOString() })
      .eq('id', orderId)

    return true
  } catch {
    // The provider never accepted the request, so no money can move. Cancel
    // rather than leaving the order stuck in created forever.
    await supabase
      .from('orders')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', orderId)

    return false
  }
}

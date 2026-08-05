import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertTransition, type OrderStatus } from './status'
import { provisionEsim, ProviderError } from '@/lib/provider/client'
import type { PaymentScenario } from '@easim/mock-provider'

/**
 * Turning a paid order into a delivered eSIM.
 *
 * Called from the payment webhook once the provider confirms, never from a
 * browser. Safe to call repeatedly: it works out what is still owed and does
 * only that.
 *
 * The rule this file exists to honour: **a paid order is never lost.** If
 * provisioning fails, the money has already moved, so the order stays visible
 * as `fulfilment_failed` with its error recorded, and can be retried
 * automatically or by an admin. It is never quietly dropped and never rolled
 * back to a state that hides it.
 */

/** Attempts before an order waits for a human. */
export const MAX_FULFILMENT_ATTEMPTS = 3

/** Backoff per attempt already made: 2s, 8s, 32s. */
export function backoffMs(attempts: number): number {
  return 2_000 * 4 ** Math.max(0, attempts - 1)
}

export type FulfilmentOutcome = {
  status: Extract<OrderStatus, 'fulfilled' | 'fulfilment_failed'>
  delivered: number
  failed: number
  lastError?: string
}

export async function fulfilOrder(orderId: string): Promise<FulfilmentOutcome> {
  const supabase = createAdminClient()

  const { data: order } = await supabase
    .from('orders')
    .select('id, status, scenario')
    .eq('id', orderId)
    .single()

  if (!order) throw new Error(`Cannot fulfil unknown order ${orderId}`)

  // Already delivered: nothing owed. This is the guard that makes a replayed
  // callback harmless even before the database constraints get involved.
  if (order.status === 'fulfilled') {
    return { status: 'fulfilled', delivered: 0, failed: 0 }
  }

  assertTransition(order.status as OrderStatus, 'fulfilling')
  await setOrderStatus(orderId, 'fulfilling')

  const { data: items } = await supabase
    .from('order_items')
    .select('id, plan_id, qty, plans(provider_plan_code)')
    .eq('order_id', orderId)

  let delivered = 0
  let failed = 0
  let lastError: string | undefined

  for (const item of items ?? []) {
    const outcome = await fulfilItem({
      orderItemId: item.id,
      planId: item.plan_id,
      providerPlanCode: (item.plans as unknown as { provider_plan_code: string })
        .provider_plan_code,
      scenario: order.scenario as PaymentScenario,
    })

    if (outcome.ok) {
      delivered += 1
    } else {
      failed += 1
      lastError = outcome.error
    }
  }

  const status = failed === 0 ? 'fulfilled' : 'fulfilment_failed'
  await setOrderStatus(orderId, status)

  return { status, delivered, failed, lastError }
}

type ItemOutcome = { ok: true } | { ok: false; error: string }

async function fulfilItem(input: {
  orderItemId: string
  planId: string
  providerPlanCode: string
  scenario: PaymentScenario
}): Promise<ItemOutcome> {
  const supabase = createAdminClient()

  // fulfilments.order_item_id is UNIQUE, so a succeeded row here means this
  // line was already delivered. Even a replayed callback that got past every
  // other guard cannot produce a second eSIM.
  const { data: existing } = await supabase
    .from('fulfilments')
    .select('id, status, attempts')
    .eq('order_item_id', input.orderItemId)
    .maybeSingle()

  if (existing?.status === 'succeeded') return { ok: true }

  const attempts = (existing?.attempts ?? 0) + 1

  // Claim one profile from the pool, atomically. Returns an empty array when
  // stock is exhausted — see db/migrations/0003_functions.sql.
  const { data: claimed, error: claimError } = await supabase.rpc('claim_esim_profile', {
    p_plan_id: input.planId,
  })

  const profile = Array.isArray(claimed) ? claimed[0] : null

  if (claimError || !profile) {
    await recordFailure(input.orderItemId, attempts, 'out_of_stock')
    return { ok: false, error: 'out_of_stock' }
  }

  try {
    const provisioned = await provisionEsim({
      orderItemId: input.orderItemId,
      providerPlanCode: input.providerPlanCode,
      scenario: input.scenario,
    })

    // The provider issues the real identifiers, so store what it returned
    // rather than what was sitting in the pool.
    await supabase
      .from('esim_profiles')
      .update({
        status: 'consumed',
        iccid: provisioned.iccid,
        activation_code: provisioned.activationCode,
      })
      .eq('id', profile.id)

    await supabase.from('fulfilments').upsert(
      {
        order_item_id: input.orderItemId,
        esim_profile_id: profile.id,
        status: 'succeeded',
        attempts,
        last_error: null,
        next_attempt_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'order_item_id' },
    )

    return { ok: true }
  } catch (error) {
    // Provisioning failed after we reserved a profile. Put it back, or the
    // pool leaks one eSIM per failure and a plan silently runs dry.
    await supabase.from('esim_profiles').update({ status: 'available' }).eq('id', profile.id)

    const message =
      error instanceof ProviderError
        ? `provider_${error.status}`
        : error instanceof Error
          ? error.message
          : 'unknown_error'

    await recordFailure(input.orderItemId, attempts, message)
    return { ok: false, error: message }
  }
}

async function recordFailure(
  orderItemId: string,
  attempts: number,
  error: string,
): Promise<void> {
  const supabase = createAdminClient()

  await supabase.from('fulfilments').upsert(
    {
      order_item_id: orderItemId,
      status: 'failed',
      attempts,
      last_error: error,
      next_attempt_at:
        attempts < MAX_FULFILMENT_ATTEMPTS
          ? new Date(Date.now() + backoffMs(attempts)).toISOString()
          : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'order_item_id' },
  )
}

async function setOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  const supabase = createAdminClient()
  await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)
}

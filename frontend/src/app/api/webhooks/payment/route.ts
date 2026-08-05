import { after } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { serverEnv } from '@/lib/env.server'
import { verify } from '@/lib/security/hmac'
import { assertTransition, type OrderStatus } from '@/lib/orders/status'
import { fulfilOrder, MAX_FULFILMENT_ATTEMPTS, backoffMs } from '@/lib/orders/fulfilment'

/**
 * Payment confirmation, from the provider.
 *
 * This is the endpoint the whole assessment turns on. It is a public URL that
 * anyone can POST to, it will receive the same message more than once, and the
 * customer's browser is not involved in any of it.
 *
 * The order of operations below is deliberate and each step is load-bearing.
 */

const eventSchema = z.object({
  eventId: z.string().min(1),
  type: z.enum(['payment.succeeded', 'payment.declined']),
  providerRef: z.string().min(1),
  orderId: z.uuid(),
  amountCents: z.number().int(),
  currency: z.string(),
  failureReason: z.string().nullable(),
  occurredAt: z.string(),
})

export async function POST(request: Request) {
  // 1. Read the RAW body first.
  //    The signature covers the exact bytes the provider sent. Parsing to an
  //    object and re-serialising would reorder keys and change whitespace, and
  //    every signature would fail for reasons that look like witchcraft.
  const raw = await request.text()

  const timestamp = request.headers.get('x-provider-timestamp')
  const signature = request.headers.get('x-provider-signature')

  // 2. Verify before anything else. An unsigned or stale request writes
  //    nothing at all — not even to the event ledger.
  if (
    !timestamp ||
    !signature ||
    !verify(raw, timestamp, signature, serverEnv().PROVIDER_HMAC_SECRET)
  ) {
    return json({ error: 'invalid_signature' }, 401)
  }

  const parsed = eventSchema.safeParse(safeJson(raw))
  if (!parsed.success) return json({ error: 'invalid_payload' }, 400)

  const event = parsed.data
  const supabase = createAdminClient()

  // 3. Record the event. `provider_event_id` is UNIQUE, so a duplicate
  //    delivery fails this insert — and that failure IS the duplicate check.
  //    Doing it in the database rather than with a SELECT-then-INSERT means
  //    two callbacks arriving at the same instant cannot both get through.
  const { error: insertError } = await supabase.from('webhook_events').insert({
    provider_event_id: event.eventId,
    type: event.type,
    payload: event as unknown as Record<string, unknown>,
  })

  if (insertError) {
    if (insertError.code === '23505') {
      // Already seen. Answer 200: a provider that gets an error will keep
      // retrying forever, and there is genuinely nothing wrong.
      return json({ status: 'duplicate' }, 200)
    }
    return json({ error: 'ledger_write_failed' }, 500)
  }

  const { data: order } = await supabase
    .from('orders')
    .select('id, status')
    .eq('id', event.orderId)
    .maybeSingle()

  if (!order) {
    // Acknowledge anyway. Rejecting would make the provider retry an order we
    // will never have, forever.
    console.error('[webhook] event for unknown order', event.orderId)
    return json({ status: 'ignored_unknown_order' }, 200)
  }

  const nextStatus: OrderStatus =
    event.type === 'payment.succeeded' ? 'paid' : 'payment_declined'

  // 4. Guard the transition. A confirmation arriving after the order already
  //    timed out must not resurrect it.
  try {
    assertTransition(order.status as OrderStatus, nextStatus)
  } catch {
    await stampProcessed(event.eventId)
    return json({ status: 'ignored_illegal_transition', from: order.status }, 200)
  }

  await supabase
    .from('payments')
    .update({
      status: event.type === 'payment.succeeded' ? 'succeeded' : 'declined',
      failure_reason: event.failureReason,
      settled_at: new Date().toISOString(),
    })
    .eq('provider_ref', event.providerRef)

  await supabase
    .from('orders')
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq('id', order.id)

  // 5. Fulfil AFTER responding.
  //    Provisioning talks to another service and can take seconds. Holding the
  //    response open invites the provider to time out and redeliver, which
  //    would be handled correctly but is pointless work.
  if (nextStatus === 'paid') {
    after(async () => {
      await fulfilWithRetries(order.id)
    })
  }

  await stampProcessed(event.eventId)
  return json({ status: 'accepted' }, 200)
}

/**
 * Retry provisioning a few times before leaving the order for a human.
 *
 * There is no scheduler in this design — Vercel's Hobby plan only runs cron
 * once a day, and a paid plan is out of budget for an assessment. So retries
 * happen here, inside the request that already has the work, and afterwards on
 * read (lib/orders/reconcile.ts) or by an admin.
 */
async function fulfilWithRetries(orderId: string): Promise<void> {
  for (let attempt = 1; attempt <= MAX_FULFILMENT_ATTEMPTS; attempt++) {
    try {
      const outcome = await fulfilOrder(orderId)
      if (outcome.status === 'fulfilled') return
    } catch (error) {
      console.error('[fulfilment] attempt failed', orderId, error)
    }

    if (attempt < MAX_FULFILMENT_ATTEMPTS) {
      await sleep(backoffMs(attempt))
    }
  }
  // Still failing. The order stays `fulfilment_failed` with its error on
  // record, visible to the customer and retryable from the admin view.
}

async function stampProcessed(eventId: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase
    .from('webhook_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('provider_event_id', eventId)
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

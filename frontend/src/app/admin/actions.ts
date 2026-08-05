'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { fulfilOrder } from '@/lib/orders/fulfilment'
import { checkRateLimit } from '@/lib/security/rate-limit'

export type RetryState = { tone: 'success' | 'error'; message: string } | null

/**
 * Retry a failed fulfilment by hand.
 *
 * The brief asks for this explicitly, and it is the end of the recovery story:
 * a customer paid, the provider was down, three automatic attempts failed, and
 * a human puts it right without touching the database.
 *
 * `requireAdmin()` on the first line is the authorisation. It is not the
 * middleware's job and it is not the caller's — a server action is a public
 * HTTP endpoint, reachable by anyone who knows its identifier, so it checks
 * for itself.
 */
export async function retryFulfilment(
  _previous: RetryState,
  formData: FormData,
): Promise<RetryState> {
  const admin = await requireAdmin()

  const parsed = z.uuid().safeParse(formData.get('orderId'))
  if (!parsed.success) return { tone: 'error', message: 'That is not a valid order id.' }

  const orderId = parsed.data

  const limit = checkRateLimit(`retry:${admin.id}`, { limit: 20, windowMs: 60_000 })
  if (!limit.allowed) {
    return {
      tone: 'error',
      message: `Too many retries. Try again in ${limit.retryAfterSeconds} seconds.`,
    }
  }

  const supabase = createAdminClient()

  const { data: order } = await supabase
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) return { tone: 'error', message: 'That order no longer exists.' }

  if (order.status !== 'fulfilment_failed') {
    return {
      tone: 'error',
      message: `Only a failed delivery can be retried. This order is ${order.status.replaceAll('_', ' ')}.`,
    }
  }

  // Clear the automatic-retry bookkeeping so a manual retry is not refused by
  // the attempt limit that stopped the automatic ones.
  const { data: items } = await supabase
    .from('order_items')
    .select('id')
    .eq('order_id', orderId)

  await supabase
    .from('fulfilments')
    .update({ attempts: 0, next_attempt_at: null })
    .in(
      'order_item_id',
      (items ?? []).map((item) => item.id),
    )
    .neq('status', 'succeeded')

  await supabase.from('admin_actions').insert({
    actor_id: admin.id,
    order_id: orderId,
    action: 'retry_fulfilment',
  })

  try {
    // A manual retry models the outage being over. Automatic retries replay
    // the original scenario, which is why a provider_failure order genuinely
    // exhausts its three attempts before reaching a human.
    const outcome = await fulfilOrder(orderId, { assumeProviderRecovered: true })
    revalidatePath('/admin')

    return outcome.status === 'fulfilled'
      ? { tone: 'success', message: 'Delivered. The customer has their eSIM.' }
      : {
          tone: 'error',
          message: `Still failing: ${outcome.lastError ?? 'unknown error'}. The order is safe and can be retried again.`,
        }
  } catch (error) {
    revalidatePath('/admin')
    return {
      tone: 'error',
      message: `Retry failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    }
  }
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Shared helpers for the integration tests.
 *
 * These tests run against the real project, so they have to leave it as they
 * found it. The important part is `releaseProfilesForOrders`: fulfilment
 * consumes eSIMs from a finite pool, and a suite that consumes without
 * restoring drains the shop a little on every run — which shows up later as
 * unrelated tests failing with `out_of_stock`.
 */
export function adminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  )
}

/**
 * Return every eSIM profile these orders consumed to the available pool.
 *
 * Call before deleting the orders — once they are gone, the fulfilment rows
 * cascade away and the link to the profile is lost.
 */
export async function releaseProfilesForOrders(
  admin: SupabaseClient,
  orderIds: string[],
): Promise<void> {
  if (orderIds.length === 0) return

  const { data: items } = await admin
    .from('order_items')
    .select('id')
    .in('order_id', orderIds)

  const itemIds = (items ?? []).map((item) => item.id)
  if (itemIds.length === 0) return

  const { data: fulfilments } = await admin
    .from('fulfilments')
    .select('esim_profile_id')
    .in('order_item_id', itemIds)
    .not('esim_profile_id', 'is', null)

  const profileIds = (fulfilments ?? [])
    .map((row) => row.esim_profile_id as string)
    .filter(Boolean)

  if (profileIds.length > 0) {
    await admin.from('esim_profiles').update({ status: 'available' }).in('id', profileIds)
  }
}

/** Anything a crashed test left reserved but never consumed. */
export async function releaseStrandedReservations(admin: SupabaseClient): Promise<void> {
  await admin.from('esim_profiles').update({ status: 'available' }).eq('status', 'reserved')
}

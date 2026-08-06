import { createClient } from '@supabase/supabase-js'

/**
 * Give back every eSIM this run consumed.
 *
 * These tests buy real plans through the real UI, and each purchase claims a
 * profile from a finite pool. Without this the suite quietly drains the shop:
 * after enough runs a plan reports sold out, and the next run fails on the
 * *symptom* - an admin retry that cannot succeed because there is no stock
 * left - rather than on anything the tests were written to catch. That is
 * exactly what happened before this file existed.
 *
 * Only orders created during this run are touched, so a reviewer's own order
 * placed before it started is left alone.
 */
export default async function globalTeardown() {
  const startedAt = process.env.E2E_STARTED_AT
  if (!startedAt) return

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret = process.env.SUPABASE_SECRET_KEY
  const demoEmail = process.env.DEMO_CUSTOMER_EMAIL
  if (!url || !secret || !demoEmail) return

  const admin = createClient(url, secret, { auth: { persistSession: false } })

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', demoEmail)
    .maybeSingle()
  if (!profile) return

  const { data: orders } = await admin
    .from('orders')
    .select('id')
    .eq('user_id', profile.id)
    .gte('created_at', startedAt)

  const orderIds = (orders ?? []).map((order) => order.id)
  if (orderIds.length === 0) return

  // Release the eSIMs before deleting the orders. Once the orders go, the
  // fulfilment rows cascade away and the link to the profile is lost.
  const { data: items } = await admin
    .from('order_items')
    .select('id')
    .in('order_id', orderIds)

  const itemIds = (items ?? []).map((item) => item.id)

  if (itemIds.length > 0) {
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

  await admin.from('orders').delete().in('id', orderIds)

  // Anything a crashed test left mid-claim.
  await admin.from('esim_profiles').update({ status: 'available' }).eq('status', 'reserved')

  console.log(`[e2e teardown] released ${orderIds.length} test order(s) back to stock`)
}

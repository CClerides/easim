import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

/**
 * Row level security, proved against the real project.
 *
 * These tests use the publishable key and nothing else — exactly what an
 * attacker would have after reading the JavaScript bundle. If any of them
 * fail, the database is leaking, and no amount of careful application code
 * would fix it.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

const anon = createClient(SUPABASE_URL, PUBLISHABLE_KEY)

describe('row level security, as a signed-out visitor', () => {
  it('can read the catalogue', async () => {
    const { data, error } = await anon.from('plans').select('slug')
    expect(error).toBeNull()
    expect(data).toHaveLength(8)
  })

  it('sees no orders', async () => {
    const { data } = await anon.from('orders').select('id')
    expect(data).toEqual([])
  })

  it('sees no order items', async () => {
    const { data } = await anon.from('order_items').select('id')
    expect(data).toEqual([])
  })

  it('sees no payments', async () => {
    const { data } = await anon.from('payments').select('id')
    expect(data).toEqual([])
  })

  // The pool must not be harvestable. An unsold profile belongs to nobody, so
  // nobody can read it.
  it('cannot harvest unsold eSIM profiles', async () => {
    const { data } = await anon.from('esim_profiles').select('iccid, activation_code')
    expect(data).toEqual([])
  })

  // This table has RLS enabled and no policy at all, so it is invisible
  // rather than merely filtered.
  it('cannot reach the webhook ledger', async () => {
    const { data } = await anon.from('webhook_events').select('id')
    expect(data).toEqual([])
  })

  it('sees no admin audit trail', async () => {
    const { data } = await anon.from('admin_actions').select('id')
    expect(data).toEqual([])
  })

  it('cannot write to the catalogue', async () => {
    const { error } = await anon.from('plans').insert({
      slug: 'hacked',
      region: 'X',
      country_code: 'XX',
      data_mb: 1,
      duration_days: 1,
      price_cents: 1,
      provider_plan_code: 'X',
    })
    expect(error).not.toBeNull()
  })

  it('cannot invent an order', async () => {
    const { error } = await anon.from('orders').insert({
      user_id: '00000000-0000-0000-0000-000000000000',
      subtotal_cents: 0,
      total_cents: 0,
      idempotency_key: 'forged',
    })
    expect(error).not.toBeNull()
  })

  // The one that would matter most: marking your own order paid without paying.
  it('cannot mark an order paid', async () => {
    const { error } = await anon.from('orders').update({ status: 'paid' }).neq('id', '')
    expect(error).not.toBeNull()
  })
})

/**
 * The same checks from inside a real session.
 *
 * The tests above use the signed-out key. These mint an actual customer
 * session, because the most valuable question is not "what can a stranger
 * do" but "what can a legitimate, signed-in customer do that they should
 * not".
 */
describe('row level security, as a signed-in customer', () => {
  let customerHeaders: Record<string, string>

  beforeAll(async () => {
    const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SECRET_KEY!, {
      auth: { persistSession: false },
    })

    const { data: link } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: process.env.DEMO_CUSTOMER_EMAIL!,
    })

    const anonClientForVerify = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
      auth: { persistSession: false },
    })
    const { data: session } = await anonClientForVerify.auth.verifyOtp({
      type: 'magiclink',
      token_hash: link.properties!.hashed_token,
    })

    customerHeaders = {
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.session!.access_token}`,
      'Content-Type': 'application/json',
    }
  })

  it('reads only their own profile, never another customer or the admin', async () => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=email`, {
      headers: customerHeaders,
    })
    const rows = (await response.json()) as { email: string }[]

    expect(rows).toHaveLength(1)
    expect(rows[0].email).toBe(process.env.DEMO_CUSTOMER_EMAIL)
  })

  /**
   * The privilege escalation attempt, and the most important test in this file.
   *
   * Note what "blocked" looks like: PostgREST answers 204, because the update
   * matched zero rows once row level security filtered them out. It is not an
   * error — it is a write that touched nothing. The assertion that matters is
   * the one after it.
   */
  it('cannot promote itself to admin', async () => {
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?email=eq.${process.env.DEMO_CUSTOMER_EMAIL}`, {
      method: 'PATCH',
      headers: customerHeaders,
      body: JSON.stringify({ role: 'admin' }),
    })

    const check = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=role`, {
      headers: customerHeaders,
    })
    const rows = (await check.json()) as { role: string }[]

    expect(rows[0].role).toBe('customer')
  })

  it('cannot read another customer’s orders', async () => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=id,user_id`, {
      headers: customerHeaders,
    })
    const rows = (await response.json()) as { user_id: string }[]

    const distinctOwners = new Set(rows.map((row) => row.user_id))
    expect(distinctOwners.size).toBeLessThanOrEqual(1)
  })

  it('still cannot reach the webhook ledger while signed in', async () => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/webhook_events?select=id`, {
      headers: customerHeaders,
    })
    expect(await response.json()).toEqual([])
  })
})

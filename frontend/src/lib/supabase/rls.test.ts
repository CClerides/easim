import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

/**
 * Row level security, proved against the real project.
 *
 * These tests use the publishable key and nothing else — exactly what an
 * attacker would have after reading the JavaScript bundle. If any of them
 * fail, the database is leaking, and no amount of careful application code
 * would fix it.
 */
const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
)

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

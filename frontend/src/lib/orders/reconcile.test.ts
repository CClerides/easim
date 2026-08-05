import { describe, it, expect } from 'vitest'
import { hasPaymentExpired, isRetryDue, type ReconcilableOrder } from './reconcile'
import { MAX_FULFILMENT_ATTEMPTS } from './fulfilment'

const NOW = 1_800_000_000_000

function order(overrides: Partial<ReconcilableOrder> = {}): ReconcilableOrder {
  return {
    id: 'order-1',
    status: 'awaiting_payment',
    payment_deadline_at: new Date(NOW + 30_000).toISOString(),
    ...overrides,
  }
}

describe('hasPaymentExpired', () => {
  it('is false before the deadline', () => {
    expect(hasPaymentExpired(order(), NOW)).toBe(false)
  })

  it('is true once the deadline has passed', () => {
    expect(
      hasPaymentExpired(order({ payment_deadline_at: new Date(NOW - 1).toISOString() }), NOW),
    ).toBe(true)
  })

  it('is true exactly on the deadline', () => {
    expect(
      hasPaymentExpired(order({ payment_deadline_at: new Date(NOW).toISOString() }), NOW),
    ).toBe(true)
  })

  /**
   * Only an order still waiting can time out. Without this, a paid order whose
   * deadline has since passed would be dragged back to payment_timeout — which
   * would mean losing an order that had already been paid for.
   */
  it('never expires an order that is no longer awaiting payment', () => {
    const past = new Date(NOW - 60_000).toISOString()
    for (const status of ['paid', 'fulfilled', 'fulfilment_failed', 'payment_declined'] as const) {
      expect(hasPaymentExpired(order({ status, payment_deadline_at: past }), NOW)).toBe(false)
    }
  })

  it('is false when no deadline was recorded', () => {
    expect(hasPaymentExpired(order({ payment_deadline_at: null }), NOW)).toBe(false)
  })
})

describe('isRetryDue', () => {
  const failed = {
    status: 'failed',
    attempts: 1,
    next_attempt_at: new Date(NOW - 1).toISOString(),
  }

  it('is true once the backoff has elapsed', () => {
    expect(isRetryDue(failed, NOW)).toBe(true)
  })

  it('is false while still backing off', () => {
    expect(isRetryDue({ ...failed, next_attempt_at: new Date(NOW + 5_000).toISOString() }, NOW)).toBe(
      false,
    )
  })

  it('is false for a fulfilment that succeeded', () => {
    expect(isRetryDue({ ...failed, status: 'succeeded' }, NOW)).toBe(false)
  })

  /** After the limit it waits for an admin, not for another automatic go. */
  it('is false once the attempt limit is reached', () => {
    expect(isRetryDue({ ...failed, attempts: MAX_FULFILMENT_ATTEMPTS }, NOW)).toBe(false)
  })

  it('is false when no next attempt was scheduled', () => {
    expect(isRetryDue({ ...failed, next_attempt_at: null }, NOW)).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import {
  canTransition,
  assertTransition,
  isTerminal,
  InvalidTransitionError,
  ORDER_STATUSES,
} from './status'

describe('order state machine', () => {
  it('walks the happy path', () => {
    expect(canTransition('created', 'awaiting_payment')).toBe(true)
    expect(canTransition('awaiting_payment', 'paid')).toBe(true)
    expect(canTransition('paid', 'fulfilling')).toBe(true)
    expect(canTransition('fulfilling', 'fulfilled')).toBe(true)
  })

  it('allows both payment failure exits', () => {
    expect(canTransition('awaiting_payment', 'payment_declined')).toBe(true)
    expect(canTransition('awaiting_payment', 'payment_timeout')).toBe(true)
  })

  it('allows fulfilment to fail and be retried', () => {
    expect(canTransition('fulfilling', 'fulfilment_failed')).toBe(true)
    expect(canTransition('fulfilment_failed', 'fulfilling')).toBe(true)
  })

  it('never lets an unpaid order be fulfilled', () => {
    expect(canTransition('created', 'fulfilled')).toBe(false)
    expect(canTransition('created', 'paid')).toBe(false)
    expect(canTransition('payment_declined', 'fulfilling')).toBe(false)
    expect(canTransition('payment_timeout', 'paid')).toBe(false)
  })

  it('never leaves a terminal state', () => {
    expect(canTransition('fulfilled', 'fulfilling')).toBe(false)
    expect(canTransition('refunded', 'paid')).toBe(false)
    expect(canTransition('cancelled', 'awaiting_payment')).toBe(false)
    expect(isTerminal('fulfilled')).toBe(true)
    expect(isTerminal('payment_declined')).toBe(true)
    expect(isTerminal('fulfilment_failed')).toBe(false)
  })

  // A replayed webhook will legitimately try to move paid -> paid.
  // That must be a no-op, not an error.
  it('treats a repeat of the same status as a no-op', () => {
    expect(canTransition('paid', 'paid')).toBe(true)
    expect(canTransition('fulfilled', 'fulfilled')).toBe(true)
    expect(() => assertTransition('paid', 'paid')).not.toThrow()
  })

  it('throws with both states named when the transition is illegal', () => {
    expect(() => assertTransition('created', 'fulfilled')).toThrow(InvalidTransitionError)
    expect(() => assertTransition('created', 'fulfilled')).toThrow(/created.*fulfilled/)
  })

  it('defines a transition list for every status, so no status is unreachable by accident', () => {
    for (const status of ORDER_STATUSES) {
      expect(() => canTransition(status, 'paid')).not.toThrow()
    }
  })
})

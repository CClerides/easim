/**
 * The order state machine.
 *
 * Every change to an order's status goes through here. The point is that an
 * order can only move along paths we have thought about: an unpaid order can
 * never become fulfilled, and a delivered order can never be un-delivered by a
 * late or duplicated message from the payment provider.
 *
 * Pure functions, no database, no network — which is why it is exhaustively
 * testable and why the tests beside this file are worth reading first.
 */

export const ORDER_STATUSES = [
  'created',
  'awaiting_payment',
  'paid',
  'fulfilling',
  'fulfilled',
  'fulfilment_failed',
  'payment_declined',
  'payment_timeout',
  'cancelled',
  'refunded',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

/**
 * The only legal moves. A status with an empty list is terminal.
 * Anything absent from this table is a bug, not an undocumented feature.
 */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  created: ['awaiting_payment', 'cancelled'],
  awaiting_payment: ['paid', 'payment_declined', 'payment_timeout', 'cancelled'],
  paid: ['fulfilling', 'refunded'],
  fulfilling: ['fulfilled', 'fulfilment_failed'],
  fulfilment_failed: ['fulfilling', 'refunded'],
  fulfilled: [],
  payment_declined: [],
  payment_timeout: [],
  cancelled: [],
  refunded: [],
}

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: OrderStatus,
    readonly to: OrderStatus,
  ) {
    super(`Illegal order transition: ${from} -> ${to}`)
    this.name = 'InvalidTransitionError'
  }
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  // Staying put is always allowed. This is what makes a replayed webhook
  // harmless: the second delivery of "payment succeeded" finds the order
  // already paid and does nothing, instead of throwing.
  if (from === to) return true
  return TRANSITIONS[from].includes(to)
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to)
}

export function isTerminal(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0
}

import type { OrderStatus } from '@/lib/orders/status'

/**
 * One badge, one meaning, everywhere an order status is shown.
 *
 * Colours come from the semantic tokens rather than being chosen per screen,
 * so `fulfilled` is the same green on the receipt, the account and the admin
 * table — and adding a status is one entry here instead of three.
 */
const TONES: Record<OrderStatus, string> = {
  created: 'border-border text-muted',
  awaiting_payment: 'border-warning/40 text-warning',
  paid: 'border-accent/40 text-accent',
  fulfilling: 'border-accent/40 text-accent',
  fulfilled: 'border-success/40 text-success',
  fulfilment_failed: 'border-danger/40 text-danger',
  payment_declined: 'border-danger/40 text-danger',
  payment_timeout: 'border-danger/40 text-danger',
  cancelled: 'border-border text-muted',
  refunded: 'border-border text-muted',
}

const LABELS: Record<OrderStatus, string> = {
  created: 'Created',
  awaiting_payment: 'Awaiting payment',
  paid: 'Paid',
  fulfilling: 'Delivering',
  fulfilled: 'Delivered',
  fulfilment_failed: 'Delivery failed',
  payment_declined: 'Declined',
  payment_timeout: 'Timed out',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap ${TONES[status]}`}
    >
      {LABELS[status]}
    </span>
  )
}

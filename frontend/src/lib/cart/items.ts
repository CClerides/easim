import { z } from 'zod'

/**
 * Cart contents, as pure functions.
 *
 * Two things this file deliberately does not do:
 *
 *   It stores no prices. A cart line is a plan id and a quantity; what those
 *   cost is decided by the server at checkout. If the browser could name the
 *   price, anyone with devtools could buy the €49.90 plan for a cent.
 *
 *   It has no database table. A cart is a convenience that lives in the
 *   visitor's own browser until they commit to an order. An order is a server
 *   fact; a cart is not.
 */

export const MAX_QTY_PER_PLAN = 10

export type CartItem = {
  planId: string
  qty: number
}

const cartSchema = z.array(
  z.object({
    // A uuid because that is what a plan id is. Anything else was not put
    // there by this application.
    planId: z.uuid(),
    qty: z.number().int().min(1).max(MAX_QTY_PER_PLAN),
  }),
)

export function addItem(items: CartItem[], planId: string, qty = 1): CartItem[] {
  const existing = items.find((item) => item.planId === planId)
  if (!existing) return [...items, { planId, qty: clamp(qty) }]

  return items.map((item) =>
    item.planId === planId ? { ...item, qty: clamp(item.qty + qty) } : item,
  )
}

export function setQty(items: CartItem[], planId: string, qty: number): CartItem[] {
  if (qty < 1) return removeItem(items, planId)
  return items.map((item) => (item.planId === planId ? { ...item, qty: clamp(qty) } : item))
}

export function removeItem(items: CartItem[], planId: string): CartItem[] {
  return items.filter((item) => item.planId !== planId)
}

export function countItems(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.qty, 0)
}

/**
 * Reads whatever localStorage handed back.
 *
 * Anyone can open devtools and rewrite that value, so it is treated exactly
 * like any other untrusted input: validated, and discarded wholesale if it
 * does not fit. Returning an empty cart is the right failure — losing a cart
 * is a small annoyance, trusting a forged one is a bug.
 */
export function parseCart(raw: string | null): CartItem[] {
  if (!raw) return []

  try {
    const parsed = cartSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

function clamp(qty: number): number {
  return Math.min(Math.max(qty, 1), MAX_QTY_PER_PLAN)
}

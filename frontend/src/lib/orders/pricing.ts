/**
 * Order totals.
 *
 * Two rules are enforced here and nowhere else:
 *
 * 1. Money is always an integer number of cents. Storing money as a decimal
 *    invites floating point drift — 0.1 + 0.2 is famously not 0.3 — and a
 *    store that is a cent out on some orders is worse than one that refuses
 *    to run.
 *
 * 2. The browser never supplies a price. It sends plan IDs and quantities;
 *    the server looks up what those plans actually cost. Anything else lets a
 *    customer edit the request and buy a 49 euro plan for 1 cent.
 */

export type PricedItem = {
  unitPriceCents: number
  qty: number
}

export type OrderTotals = {
  subtotalCents: number
  totalCents: number
}

export function calculateTotals(items: PricedItem[]): OrderTotals {
  let subtotalCents = 0

  for (const item of items) {
    if (!Number.isInteger(item.unitPriceCents)) {
      throw new Error(`Price must be integer cents, received ${item.unitPriceCents}`)
    }
    if (!Number.isInteger(item.qty) || item.qty < 1) {
      throw new Error(`Quantity must be a positive integer, received ${item.qty}`)
    }
    subtotalCents += item.unitPriceCents * item.qty
  }

  // No tax or shipping on a digital product, so total equals subtotal today.
  // It exists as its own field so that adding either later touches this
  // function instead of every call site.
  return { subtotalCents, totalCents: subtotalCents }
}

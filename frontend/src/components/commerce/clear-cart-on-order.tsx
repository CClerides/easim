'use client'

import { useEffect, useRef } from 'react'
import { useCart } from '@/lib/cart/cart-context'

/**
 * Empties the cart once, after an order has just been placed.
 *
 * The cart lives in localStorage, which only the browser can clear - the
 * server action that created the order cannot reach it. So the checkout
 * redirect carries `?placed=1` and this clears the cart when it sees it.
 *
 * Keyed on that flag rather than simply "we are on an order page", because
 * revisiting an old receipt must not wipe a cart the customer has since
 * refilled.
 */
export function ClearCartOnOrder() {
  const { clear } = useCart()
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true
    clear()
  }, [clear])

  return null
}

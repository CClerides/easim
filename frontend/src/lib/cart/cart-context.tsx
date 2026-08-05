'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  addItem,
  countItems,
  parseCart,
  removeItem,
  setQty,
  type CartItem,
} from './items'

/**
 * The cart, held in React state and mirrored to localStorage.
 *
 * No state library. The cart is a list and four operations, all of which are
 * pure functions in `items.ts` with their own tests. This file is only the
 * plumbing that connects them to React and to storage.
 */

const STORAGE_KEY = 'easim.cart.v1'

type CartContextValue = {
  items: CartItem[]
  count: number
  /** False until localStorage has been read, so the UI can avoid flashing an empty cart. */
  ready: boolean
  add: (planId: string, qty?: number) => void
  update: (planId: string, qty: number) => void
  remove: (planId: string) => void
  clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [ready, setReady] = useState(false)

  // Read after mount, never during render: the server has no localStorage, and
  // reading it during render would make the server and client HTML disagree.
  useEffect(() => {
    setItems(parseCart(window.localStorage.getItem(STORAGE_KEY)))
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items, ready])

  const add = useCallback((planId: string, qty = 1) => {
    setItems((current) => addItem(current, planId, qty))
  }, [])

  const update = useCallback((planId: string, qty: number) => {
    setItems((current) => setQty(current, planId, qty))
  }, [])

  const remove = useCallback((planId: string) => {
    setItems((current) => removeItem(current, planId))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const value = useMemo(
    () => ({ items, count: countItems(items), ready, add, update, remove, clear }),
    [items, ready, add, update, remove, clear],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used inside a CartProvider')
  return context
}

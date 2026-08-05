'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useCart } from '@/lib/cart/cart-context'

export function AddToCart({ planId, soldOut }: { planId: string; soldOut: boolean }) {
  const { add } = useCart()
  const [added, setAdded] = useState(false)

  if (soldOut) {
    return (
      <button
        type="button"
        disabled
        className="mt-5 w-full cursor-not-allowed rounded-lg border border-border px-5 py-3 text-sm text-muted"
      >
        Sold out
      </button>
    )
  }

  return (
    <div className="mt-5 space-y-3">
      <button
        type="button"
        onClick={() => {
          add(planId)
          setAdded(true)
        }}
        className="w-full rounded-lg bg-accent px-5 py-3 text-sm font-medium text-background transition-colors hover:bg-accent-strong"
      >
        Add to cart
      </button>

      {added ? (
        <p role="status" className="text-center text-sm text-muted">
          Added.{' '}
          <Link href="/cart" className="text-accent underline underline-offset-4">
            Go to cart
          </Link>
        </p>
      ) : null}
    </div>
  )
}

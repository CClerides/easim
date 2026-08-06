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
        className="btn btn-secondary mt-5 w-full px-5 py-3"
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
        className="btn btn-primary w-full px-5 py-3"
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

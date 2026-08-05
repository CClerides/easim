'use client'

import Link from 'next/link'
import { useCart } from '@/lib/cart/cart-context'

/**
 * The cart link, with a count. Its own client component so the header can
 * stay a Server Component — only the number needs the browser.
 */
export function CartLink() {
  const { count, ready } = useCart()

  return (
    <Link
      href="/cart"
      className="rounded-md border border-border px-3.5 py-1.5 transition-colors hover:border-accent hover:text-accent"
    >
      Cart
      {ready && count > 0 ? <span className="ml-1.5 tabular-nums">({count})</span> : null}
    </Link>
  )
}

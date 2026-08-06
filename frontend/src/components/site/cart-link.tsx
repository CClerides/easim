'use client'

import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'
import { useCart } from '@/lib/cart/cart-context'

/**
 * The cart, as an icon with a count.
 *
 * Its own client component so the header can stay a Server Component - only
 * the number needs the browser.
 *
 * The icon carries a real accessible name and the badge is aria-hidden, so a
 * screen reader hears "Cart, 2 items" rather than a glyph followed by a
 * floating number.
 */
export function CartLink() {
  const { count, ready } = useCart()
  const showCount = ready && count > 0

  return (
    <Link
      href="/cart"
      aria-label={showCount ? `Cart, ${count} item${count === 1 ? '' : 's'}` : 'Cart'}
      className="relative grid size-10 place-items-center rounded-control text-foreground transition-[color,background-color,transform] duration-100 hover:bg-surface active:scale-[0.95]"
    >
      <ShoppingCart className="size-[18px]" strokeWidth={1.75} aria-hidden />

      {showCount ? (
        <span
          aria-hidden
          className="absolute -top-0.5 -right-0.5 grid min-w-[18px] place-items-center rounded-full bg-ink px-1 text-[11px] leading-[18px] font-medium text-white tabular-nums"
        >
          {count}
        </span>
      ) : null}
    </Link>
  )
}

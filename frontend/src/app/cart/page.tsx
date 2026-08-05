import type { Metadata } from 'next'
import { getActivePlans } from '@/lib/plans'
import { CartContents } from '@/components/commerce/cart-contents'

export const metadata: Metadata = { title: 'Cart - Easim' }

/**
 * Server Component that loads the catalogue, then hands it to a client
 * component which knows what is in the cart.
 *
 * The split is the point: the cart itself only ever existed in the browser,
 * so the server cannot render its contents - but it can supply the plan data
 * the browser needs to describe them, without a second round trip.
 */
export default async function CartPage() {
  const plans = await getActivePlans()

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Your cart</h1>
      <CartContents plans={plans} />
    </div>
  )
}

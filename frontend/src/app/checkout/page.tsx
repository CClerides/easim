import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth'
import { getActivePlans } from '@/lib/plans'
import { CheckoutForm } from './checkout-form'

export const metadata: Metadata = { title: 'Checkout — Easim' }

export default async function CheckoutPage() {
  // The authorisation boundary. Middleware also redirects here, but this is
  // what actually enforces it.
  const user = await requireUser()
  const plans = await getActivePlans()

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>
      <CheckoutForm plans={plans} email={user.email ?? 'your account'} />
    </div>
  )
}

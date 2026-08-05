import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Contact — Easim' }

export default function ContactPage() {
  return (
    <>
      <h1>Contact</h1>

      <h2>Support</h2>
      <p>
        Email{' '}
        <a href="mailto:support@easim.dev" className="underline underline-offset-4">
          support@easim.dev
        </a>
        . Include your order reference — it is the identifier at the top of your
        receipt — and we will answer within two working days.
      </p>

      <h2>Before you write</h2>
      <ul>
        <li>
          <strong>Order still pending?</strong> Payment confirmation arrives from
          our provider, not from your browser, so it can take a few seconds. The
          order page updates by itself; there is no need to refresh.
        </li>
        <li>
          <strong>Paid but no eSIM yet?</strong> Your order is safe. Delivery
          retries automatically, and our team can retry it manually. The status on
          the order page is always current.
        </li>
        <li>
          <strong>Payment declined?</strong> Nothing was charged. Place the order
          again.
        </li>
      </ul>

      <h2>Assessment note</h2>
      <p>
        This deployment is a technical assessment demonstration. The address above
        is illustrative and is not monitored.
      </p>
    </>
  )
}

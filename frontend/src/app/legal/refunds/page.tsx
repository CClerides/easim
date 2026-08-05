import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Refund policy — Easim' }

export default function RefundsPage() {
  return (
    <>
      <h1>Refund policy</h1>
      <p>Last updated 5 August 2026.</p>

      <h2>The short version</h2>
      <p>
        Once an eSIM profile has been delivered to your account, it cannot be
        refunded. Before delivery, you get your money back in full, automatically.
      </p>

      <h2>Why delivered profiles are final</h2>
      <p>
        An eSIM profile is consumed the moment it is issued. It is assigned to you
        from a finite pool, removed from stock, and cannot be returned or reissued
        to anyone else. That is why the QR code and ICCID are the point of no
        return, rather than the payment.
      </p>

      <h2>When you are refunded</h2>
      <ul>
        <li>
          <strong>Payment declined or timed out.</strong> Nothing was charged and
          nothing was issued. There is nothing to refund.
        </li>
        <li>
          <strong>Paid, but we could not deliver.</strong> If delivery fails and
          cannot be recovered, the order is refunded in full. Your order stays
          visible in your account in the meantime — it is never discarded.
        </li>
        <li>
          <strong>Plan out of stock after payment.</strong> Same as above: full
          refund, or delivery once stock returns, whichever you prefer.
        </li>
      </ul>

      <h2>When you are not refunded</h2>
      <ul>
        <li>The profile was delivered and you changed your mind.</li>
        <li>You bought the wrong country or duration and the profile was issued.</li>
        <li>
          Coverage was weaker than you hoped at a specific address. We do not
          operate the local networks and cannot guarantee performance.
        </li>
      </ul>

      <h2>How to ask</h2>
      <p>
        Use the <a href="/legal/contact" className="underline underline-offset-4">contact page</a>{' '}
        and include your order reference. Requests are answered within two working
        days.
      </p>

      <h2>Assessment note</h2>
      <p>
        This deployment takes no real money, so no refund can be issued from it. An
        administrator can mark an order refunded, which is a bookkeeping state only.
      </p>
    </>
  )
}

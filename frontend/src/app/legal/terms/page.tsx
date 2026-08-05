import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Terms of service - Easim' }

export default function TermsPage() {
  return (
    <>
      <h1>Terms of service</h1>
      <p>Last updated 5 August 2026.</p>

      <h2>1. What this service is</h2>
      <p>
        Easim offers prepaid mobile data plans delivered as eSIM profiles. A
        plan is software: an activation QR code and an ICCID, delivered to your
        account. Nothing is shipped.
      </p>
      <p>
        This deployment is a technical assessment demonstration. No real payment is
        taken and no eSIM profile issued here will connect to a mobile network.
      </p>

      <h2>2. Your account</h2>
      <p>
        You need an account to buy, because that is where your eSIM is delivered.
        You are responsible for keeping access to the email address you sign in
        with. Anyone who can read that inbox can reach your orders.
      </p>

      <h2>3. Orders and payment</h2>
      <p>
        An order is placed when you complete checkout. It is confirmed only when
        our payment provider tells us the payment succeeded - not when your browser
        finishes loading a page. Until that confirmation arrives, your order is
        pending and nothing has been delivered.
      </p>
      <p>
        Prices are shown in euro and include any applicable tax. The price charged
        is the price recorded on the server at the moment the order is created.
      </p>

      <h2>4. Delivery</h2>
      <p>
        Delivery is automatic and normally takes a few seconds after payment is
        confirmed. If our provider is unavailable, your order is retained in a paid
        state and retried. You will see its status in your account throughout. An
        order is never discarded because delivery failed.
      </p>

      <h2>5. Availability</h2>
      <p>
        Each plan draws from a finite pool of eSIM profiles. If a plan runs out
        between your payment and delivery, your order is held and visible to our
        support team for resolution rather than silently cancelled.
      </p>

      <h2>6. Acceptable use</h2>
      <ul>
        <li>Do not resell profiles issued to your account.</li>
        <li>Do not attempt to obtain profiles without paying for them.</li>
        <li>Do not use the service to break the law where you are travelling.</li>
      </ul>

      <h2>7. Liability</h2>
      <p>
        Mobile coverage depends on local networks we do not operate. We do not
        guarantee a particular speed or that coverage exists at a specific address.
      </p>

      <h2>8. Changes</h2>
      <p>
        We may update these terms. The version in force is the one published here
        when your order is placed.
      </p>
    </>
  )
}

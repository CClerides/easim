import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Privacy — Trezuz eSIM' }

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy</h1>
      <p>Last updated 5 August 2026.</p>

      <h2>What we store</h2>
      <ul>
        <li>
          <strong>Your email address.</strong> It is how you sign in and where your
          order confirmations go.
        </li>
        <li>
          <strong>Your orders.</strong> What you bought, when, what it cost, and
          what state the order reached.
        </li>
        <li>
          <strong>Your eSIM profiles.</strong> The ICCID and activation code issued
          to you.
        </li>
      </ul>

      <h2>What we do not store</h2>
      <p>
        <strong>No card details of any kind.</strong> Not a number, not an expiry,
        not a security code — no field on this site ever asks for one. Payment is
        handled by a separate service, and this deployment uses a mock one that
        takes no money at all.
      </p>
      <p>
        We do not build advertising profiles, and we do not sell or share your data
        with third parties.
      </p>

      <h2>Cookies</h2>
      <ul>
        <li>
          <strong>Strictly necessary.</strong> A session cookie that keeps you
          signed in, and a cookie recording your choice on this banner. Without
          these the site cannot work, so they are always set.
        </li>
        <li>
          <strong>Analytics.</strong> Off unless you turn them on. If you decline,
          the analytics code is never loaded at all — it is not merely hidden.
        </li>
      </ul>
      <p>
        You can change your choice at any time from the link in the footer.
      </p>

      <h2>Who can see your data</h2>
      <p>
        Access is enforced by the database itself, not only by the application.
        Every table denies access by default, and the rules grant each signed-in
        person their own rows and nothing else. An administrator can see order
        records in order to resolve failed deliveries.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Order records are retained for as long as the account exists, because they
        are your proof of purchase. Delete your account and they go with it.
      </p>

      <h2>Your rights</h2>
      <p>
        You can request a copy of your data or its deletion via the{' '}
        <a href="/legal/contact" className="underline underline-offset-4">contact page</a>.
      </p>
    </>
  )
}

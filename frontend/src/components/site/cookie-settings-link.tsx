'use client'

import { REOPEN_EVENT } from './cookie-banner'

/**
 * Reopens the consent banner. Split into its own tiny client component so the
 * footer itself can stay a Server Component - only the button needs to run in
 * the browser.
 */
export function CookieSettingsLink() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(REOPEN_EVENT))}
      className="text-muted transition-colors hover:text-foreground"
    >
      Cookie settings
    </button>
  )
}

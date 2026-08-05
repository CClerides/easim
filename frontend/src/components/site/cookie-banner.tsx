'use client'

import { useEffect, useState } from 'react'
import { Analytics } from '@vercel/analytics/react'

/**
 * Cookie consent.
 *
 * The point that matters: declining analytics means the analytics script is
 * never loaded. `<Analytics />` is mounted only when consent is granted, so
 * "off" is genuinely off rather than a banner that hides itself while the
 * tracker runs anyway.
 *
 * The choice lives in a first-party cookie rather than localStorage so that a
 * future server-rendered decision can read it too.
 */

const COOKIE_NAME = 'easim.consent.v1'
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

/** Footer dispatches this to let someone change their mind. */
export const REOPEN_EVENT = 'easim:open-cookie-settings'

type Consent = { analytics: boolean }

function readConsent(): Consent | null {
  const match = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${COOKIE_NAME}=`))
  if (!match) return null

  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(match.split('=')[1]))
    // The cookie is user-editable, so treat it as untrusted input: anything
    // unexpected means "not yet asked", and we ask again.
    if (typeof parsed === 'object' && parsed !== null && 'analytics' in parsed) {
      return { analytics: Boolean((parsed as Consent).analytics) }
    }
    return null
  } catch {
    return null
  }
}

function writeConsent(consent: Consent): void {
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(
    JSON.stringify(consent),
  )}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`
}

export function CookieBanner() {
  const [consent, setConsent] = useState<Consent | null>(null)
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    const stored = readConsent()
    setConsent(stored)
    setAsking(stored === null)

    const reopen = () => setAsking(true)
    window.addEventListener(REOPEN_EVENT, reopen)
    return () => window.removeEventListener(REOPEN_EVENT, reopen)
  }, [])

  function decide(analytics: boolean) {
    const next = { analytics }
    writeConsent(next)
    setConsent(next)
    setAsking(false)
  }

  return (
    <>
      {consent?.analytics ? <Analytics /> : null}

      {asking ? (
        <div
          role="dialog"
          aria-label="Cookie choices"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-current/15 bg-background/95 backdrop-blur"
        >
          <div className="mx-auto flex max-w-4xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm leading-relaxed">
              <p className="font-medium">Cookies</p>
              <p className="opacity-80">
                Strictly necessary cookies keep you signed in and remember this
                choice. Analytics are optional - decline and the analytics script
                is never loaded.{' '}
                <a href="/legal/privacy" className="underline underline-offset-4">
                  Details
                </a>
                .
              </p>
            </div>

            <div className="flex shrink-0 gap-3">
              <button
                type="button"
                onClick={() => decide(false)}
                className="rounded-md border border-current/25 px-4 py-2 text-sm"
              >
                Necessary only
              </button>
              <button
                type="button"
                onClick={() => decide(true)}
                className="rounded-md bg-foreground px-4 py-2 text-sm text-background"
              >
                Accept analytics
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

import Link from 'next/link'
import { CookieSettingsLink } from './cookie-settings-link'

const LEGAL = [
  { href: '/legal/terms', label: 'Terms' },
  { href: '/legal/refunds', label: 'Refunds' },
  { href: '/legal/privacy', label: 'Privacy' },
  { href: '/legal/contact', label: 'Contact' },
]

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          Easim - a technical assessment demonstration. No real payments,
          no real eSIM profiles.
        </p>

        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          {LEGAL.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          <CookieSettingsLink />
        </nav>
      </div>
    </footer>
  )
}

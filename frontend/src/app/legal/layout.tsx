import Link from 'next/link'

const PAGES = [
  { href: '/legal/terms', label: 'Terms of service' },
  { href: '/legal/refunds', label: 'Refund policy' },
  { href: '/legal/privacy', label: 'Privacy' },
  { href: '/legal/contact', label: 'Contact' },
]

/**
 * Shared shell for the four legal pages, so each page file holds only its own
 * words. All four are static — nothing here depends on who is looking.
 */
export default function LegalLayout({ children }: LayoutProps<'/legal'>) {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <nav className="mb-12 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {PAGES.map((page) => (
          <Link key={page.href} href={page.href} className="underline underline-offset-4">
            {page.label}
          </Link>
        ))}
      </nav>

      <article className="space-y-6 leading-relaxed [&_h1]:text-3xl [&_h1]:font-semibold [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:opacity-90 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_ul]:opacity-90">
        {children}
      </article>

      <p className="mt-16 rounded-lg border border-current/15 p-4 text-sm opacity-70">
        This site is a technical assessment demonstration. It sells nothing real,
        processes no real payments, and issues no real eSIM profiles.
      </p>
    </div>
  )
}

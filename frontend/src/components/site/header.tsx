import Link from 'next/link'

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="size-2.5 rounded-full bg-accent shadow-[0_0_12px_var(--accent)]"
          />
          <span className="text-sm font-semibold tracking-[0.18em] uppercase">Trezuz</span>
        </Link>

        <nav className="flex items-center gap-7 text-sm">
          <Link href="/plans" className="text-muted transition-colors hover:text-foreground">
            Plans
          </Link>
          <Link href="/account" className="text-muted transition-colors hover:text-foreground">
            Account
          </Link>
          <Link
            href="/cart"
            className="rounded-md border border-border px-3.5 py-1.5 transition-colors hover:border-accent hover:text-accent"
          >
            Cart
          </Link>
        </nav>
      </div>
    </header>
  )
}

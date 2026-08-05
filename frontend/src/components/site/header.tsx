import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { signOut } from '@/app/login/actions'
import { CartLink } from './cart-link'

export async function Header() {
  const user = await getUser()

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span
            aria-hidden
            className="size-2.5 rounded-full bg-accent shadow-[0_0_12px_var(--accent)]"
          />
          <span className="text-sm font-semibold tracking-[0.18em] uppercase">Easim</span>
        </Link>

        {/* Tight on a narrow phone, comfortable once there is room. Every item
            stays on one line — a wrapped "Sign out" reads as a bug. */}
        <nav className="flex items-center gap-3.5 text-xs whitespace-nowrap sm:gap-6 sm:text-sm">
          <Link href="/plans" className="text-muted transition-colors hover:text-foreground">
            Plans
          </Link>

          {user ? (
            <>
              <Link href="/account" className="text-muted transition-colors hover:text-foreground">
                Account
              </Link>
              <form action={signOut}>
                <button type="submit" className="text-muted transition-colors hover:text-foreground">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="text-muted transition-colors hover:text-foreground">
              Sign in
            </Link>
          )}

          <CartLink />
        </nav>
      </div>
    </header>
  )
}

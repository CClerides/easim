import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { signOut } from '@/app/login/actions'
import { CartLink } from './cart-link'

export async function Header() {
  const user = await getUser()

  return (
    // A floating material with content passing beneath it, and a scroll edge
    // instead of a hard rule. See `.material-chrome` in globals.css.
    <header className="material-chrome sticky top-0 z-40">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 transition-transform duration-100 active:scale-[0.98]"
        >
          <span aria-hidden className="size-2 rounded-full bg-accent" />
          <span className="text-sm font-semibold tracking-[0.18em] uppercase">Easim</span>
        </Link>

        {/* Tight on a narrow phone, comfortable once there is room. Every item
            stays on one line - a wrapped "Sign out" reads as a bug. */}
        <nav className="flex items-center gap-3.5 text-xs whitespace-nowrap sm:gap-6 sm:text-sm">
          <NavLink href="/plans">Plans</NavLink>

          {user ? (
            <>
              <NavLink href="/account">Account</NavLink>
              <form action={signOut}>
                {/*
                  Feedback belongs on the press, not on the release. Waiting
                  for a click to acknowledge a tap is what makes an interface
                  feel dead, and it costs nothing to fix.
                */}
                <button
                  type="submit"
                  className="text-muted transition-[color,transform] duration-100 hover:text-foreground active:scale-[0.97] active:text-foreground"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <NavLink href="/login">Sign in</NavLink>
          )}

          <CartLink />
        </nav>
      </div>
    </header>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-muted transition-[color,transform] duration-100 hover:text-foreground active:scale-[0.97] active:text-foreground"
    >
      {children}
    </Link>
  )
}

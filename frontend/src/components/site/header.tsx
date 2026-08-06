import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { signOut } from '@/app/login/actions'
import { CartLink } from './cart-link'

/**
 * Logo hard left, everything else hard right.
 *
 * `justify-between` on two children does that with no spacer divs and no
 * absolute positioning, so it survives the nav growing or shrinking with the
 * signed-in state.
 */
export async function Header() {
  const user = await getUser()

  return (
    <header className="material-chrome sticky top-0 z-40">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-10">
        <Link
          href="/"
          className="shrink-0 text-xl font-semibold tracking-tight transition-transform duration-100 active:scale-[0.98]"
        >
          EASIM
        </Link>

        <nav className="flex items-center gap-2 sm:gap-5">
          <NavLink href="/plans">Plans</NavLink>

          {user ? (
            <>
              <NavLink href="/account">Account</NavLink>
              <form action={signOut}>
                {/* Feedback belongs on the press, not the release. */}
                <button
                  type="submit"
                  className="rounded-control px-2 py-1 text-sm text-muted transition-[color,transform] duration-100 hover:text-foreground active:scale-[0.97]"
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
      className="rounded-control px-2 py-1 text-sm text-muted transition-[color,transform] duration-100 hover:text-foreground active:scale-[0.97]"
    >
      {children}
    </Link>
  )
}

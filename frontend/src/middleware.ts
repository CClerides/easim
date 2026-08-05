import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Session refresh, and redirects for convenience.
 *
 * Two jobs, and it is worth being precise about the second one:
 *
 * 1. Supabase access tokens are short-lived. This refreshes them on each
 *    request so a signed-in customer is not logged out mid-browse.
 *
 * 2. It bounces signed-out visitors away from private pages.
 *
 * **The second job is not security.** It exists so people see a sign-in form
 * instead of an empty page. Every protected page and action independently
 * calls requireUser() or requireAdmin(), and the database enforces row level
 * security underneath both. If this file were deleted tomorrow, nothing would
 * become readable that is not readable now — the experience would just get
 * worse.
 */
const PRIVATE_PREFIXES = ['/account', '/checkout', '/admin', '/orders']

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (!user && PRIVATE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Carry the destination so signing in returns you where you were headed.
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    // Everything except static assets and image files. The webhook and the
    // mock provider are excluded too: they authenticate with an HMAC
    // signature, not a session, and running them through session refresh
    // would be pointless work on every callback.
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/mock-provider|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

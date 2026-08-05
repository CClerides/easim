import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Supabase client for Server Components and Server Actions.
 *
 * Runs as the signed-in user: it reads the session from cookies and sends the
 * user's token with every query, so row level security applies exactly as it
 * would in the browser. A page built with this client physically cannot render
 * another customer's order — there is no `where user_id = ...` to forget,
 * because the database applies it.
 *
 * Reads only. Writes use the secret-key client in `admin.ts`.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Server Components cannot set cookies. Middleware refreshes the
            // session instead, so ignoring this is correct rather than lazy.
          }
        },
      },
    },
  )
}

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Session-less Supabase client for public data.
 *
 * Carries the publishable key and no user session, so every caller sees
 * exactly the same rows — which is what makes its results safe to cache.
 *
 * This exists because `unstable_cache` refuses to run `cookies()` inside it,
 * and rightly so: caching the output of a user-scoped query would serve one
 * customer's data to the next. Anything cached must be identical for everyone,
 * and that is precisely what this client guarantees.
 *
 * Use for: the catalogue, stock counts.
 * Do not use for: anything belonging to a signed-in person — that is
 * `server.ts`, which applies row level security as the user.
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

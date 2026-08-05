import { createBrowserClient } from '@supabase/ssr'

/**
 * Supabase client for the browser.
 *
 * Carries the publishable key, which is genuinely public — it ships inside the
 * JavaScript bundle. It is safe there because row level security decides what
 * it may read, and no table grants it write access at all.
 *
 * Used only for the Realtime subscription on the order status page.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
}

import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { serverEnv } from '@/lib/env.server'

/**
 * Supabase client holding the secret key. **Bypasses row level security.**
 *
 * The `server-only` import on line 1 is the guard: if any client component
 * ever imports this file, even transitively, the build fails. It cannot leak
 * to a browser by accident.
 *
 * Every write in this application goes through here, because no table grants
 * write access to anyone else. That places the entire burden of "is this
 * person allowed to do this?" on the calling code — which is why every server
 * action starts with requireUser() or requireAdmin(), and why the webhook
 * verifies its HMAC signature before touching anything.
 *
 * Legitimate callers:
 *   - Server Actions, after authorising the caller
 *   - The payment webhook, after verifying the signature
 *   - Fulfilment, which runs from the webhook
 */
export function createAdminClient() {
  const env = serverEnv()

  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

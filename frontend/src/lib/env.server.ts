import 'server-only'
import { parseEnv, type Env } from './env'

/**
 * Server-side environment access.
 *
 * The `server-only` import above is the guard: if any client component ever
 * imports this module, the build fails. That is deliberate — this is the only
 * path to SUPABASE_SERVICE_ROLE_KEY and PROVIDER_HMAC_SECRET, and neither may
 * ever reach a browser.
 *
 * Parsed once and cached, so a bad environment fails on first use rather than
 * being re-validated on every request.
 */
let cached: Env | undefined

export function serverEnv(): Env {
  cached ??= parseEnv(process.env)
  return cached
}

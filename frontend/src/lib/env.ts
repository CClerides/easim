import { z } from 'zod'

/**
 * Environment access, validated once at import time.
 *
 * A missing or malformed variable fails the build rather than failing a
 * customer's checkout at 3am. Everything downstream can treat these values as
 * present and well-formed.
 *
 * On the two Supabase keys, because the names matter:
 *
 *   PUBLISHABLE  is sent to the browser. It is safe there only because row
 *                level security decides what it may read, and it may write
 *                nothing at all.
 *   SECRET       bypasses row level security completely. It is reachable only
 *                through env.server.ts, which is marked `server-only`.
 */
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  PROVIDER_BASE_URL: z.url(),
  PROVIDER_HMAC_SECRET: z.string().min(16),
  APP_BASE_URL: z.url(),
  DEMO_CUSTOMER_EMAIL: z.email(),
  DEMO_ADMIN_EMAIL: z.email(),
})

export type Env = z.infer<typeof schema>

/**
 * Works out this deployment's own origin.
 *
 * You cannot know your production URL before the first deploy, so requiring
 * APP_BASE_URL by hand makes the first deploy fail for a reason nobody
 * enjoys diagnosing. Vercel injects its own hostname, so derive from that and
 * let an explicit value win when there is one — a custom domain, or localhost
 * in development.
 */
function resolveOrigin(source: Record<string, unknown>): string | undefined {
  const explicit = source.APP_BASE_URL
  if (typeof explicit === 'string' && explicit.length > 0) return explicit

  // Set by Vercel. The production one is stable across deployments; VERCEL_URL
  // changes per deployment and is the fallback for previews.
  const vercelHost =
    source.VERCEL_PROJECT_PRODUCTION_URL ?? source.VERCEL_URL

  return typeof vercelHost === 'string' && vercelHost.length > 0
    ? `https://${vercelHost}`
    : undefined
}

/**
 * Takes the source object instead of reading `process.env` directly, so tests
 * can feed it a broken environment without mutating the real one.
 */
export function parseEnv(source: Record<string, unknown>): Env {
  const origin = resolveOrigin(source)

  const withDefaults = {
    ...source,
    APP_BASE_URL: origin,
    // The mock provider is mounted inside this app, so it lives at this
    // origin unless it has been split out to its own deployment.
    PROVIDER_BASE_URL:
      source.PROVIDER_BASE_URL || (origin ? `${origin}/api/mock-provider` : undefined),
  }

  const result = schema.safeParse(withDefaults)
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new Error(`Invalid environment: ${detail}`)
  }
  return result.data
}

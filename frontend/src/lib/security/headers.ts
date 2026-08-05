/**
 * Security response headers.
 *
 * These are defence in depth: none of them fix a broken authorisation check,
 * but each closes off a class of attack that would otherwise turn a small bug
 * into a large one. Applied to every route from next.config.ts.
 */

const isDev = process.env.NODE_ENV === 'development'

/** Supabase needs to be reachable over HTTPS and, for Realtime, WebSocket. */
function supabaseOrigins(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return ''
  return ` ${url} ${url.replace('https://', 'wss://')}`
}

function contentSecurityPolicy(): string {
  return [
    `default-src 'self'`,
    // 'unsafe-inline' is required by Next's inline bootstrap script, and
    // 'unsafe-eval' by the dev bundler's hot reload. The production policy
    // drops eval.
    // va.vercel-scripts.com is Vercel Web Analytics. Listing it here does not
    // load it: the <Analytics /> component is mounted only after the visitor
    // accepts analytics cookies. Without this entry the script is blocked and
    // analytics silently never work, which is worse than not having them.
    `script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    // blob: and data: cover the QR code, which is generated in memory rather
    // than fetched from anywhere.
    `img-src 'self' data: blob:`,
    `font-src 'self' data:`,
    // The dev-only `ws:` is the hot-reload socket. Production never needs it.
    `connect-src 'self'${supabaseOrigins()}${isDev ? ' ws://localhost:*' : ''}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
  ].join('; ')
}

export function securityHeaders() {
  return [
    // Stops this site being framed by another — the classic clickjacking
    // defence, where an invisible iframe sits under a decoy button.
    { key: 'X-Frame-Options', value: 'DENY' },

    // Stops the browser guessing that an uploaded .txt is really JavaScript.
    { key: 'X-Content-Type-Options', value: 'nosniff' },

    // Leaks the origin, never the path, to other sites. An order URL contains
    // an order id we would rather not hand to whatever the user clicks next.
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

    // We ask for none of these, so deny them outright.
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    },

    // Once seen over HTTPS, never speak HTTP to this host again.
    {
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload',
    },

    { key: 'Content-Security-Policy', value: contentSecurityPolicy() },
  ]
}

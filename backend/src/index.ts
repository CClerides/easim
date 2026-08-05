import { authorize, isAuthorizeRequest } from './payments'
import { isProvisionRequest, provision } from './esim'

export type { PaymentScenario, AuthorizeRequest } from './payments'
export type { ProvisionRequest, ProvisionResult } from './esim'
export { PAYMENT_SCENARIOS } from './payments'

/**
 * The mock provider service — the "outside world" this store integrates with.
 *
 * The store never imports anything from this package except the type of its
 * request bodies. It reaches these endpoints over HTTP, at PROVIDER_BASE_URL.
 * That is what makes this a real integration boundary rather than a function
 * call wearing a costume, and it is why moving this package to its own
 * deployment later costs a wrapper file and one environment variable.
 *
 * Two endpoints:
 *   POST /payments/authorize  — 202 now, outcome by callback later
 *   POST /esim/provision      — an eSIM, or 503
 */

/**
 * Runs work after the response has been sent.
 *
 * A serverless function may be frozen the moment it responds, which would kill
 * a pending callback. The host passes in its own mechanism: `after()` inside
 * Next.js, `waitUntil()` on a standalone deployment. Injecting it keeps this
 * package free of any host-specific import.
 */
export type Scheduler = (task: () => Promise<void>) => void

export type ProviderConfig = {
  secret: string
  schedule: Scheduler
}

export async function handleProviderRequest(
  request: Request,
  config: ProviderConfig,
): Promise<Response> {
  const { pathname } = new URL(request.url)

  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  if (pathname.endsWith('/payments/authorize')) {
    if (!isAuthorizeRequest(body)) return json({ error: 'invalid_request' }, 400)
    const result = authorize(body, config.secret, config.schedule)
    // 202: accepted, not settled. The answer arrives at the callback URL.
    return json(result, 202)
  }

  if (pathname.endsWith('/esim/provision')) {
    if (!isProvisionRequest(body)) return json({ error: 'invalid_request' }, 400)
    const result = provision(body)
    if ('failure' in result) {
      return json({ error: 'provider_unavailable' }, 503)
    }
    return json(result, 200)
  }

  return json({ error: 'not_found' }, 404)
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

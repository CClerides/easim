import { randomUUID } from 'node:crypto'
import { sign } from './hmac'
import type { Scheduler } from './index'

/**
 * The mock payment service.
 *
 * It behaves the way a real one does in the ways that matter: it accepts the
 * request, answers immediately with a reference, and delivers the actual
 * outcome later, over the network, to a URL we gave it. The store learns
 * whether the payment worked from that callback — never from the response to
 * its own request, and never from the browser.
 */

export type PaymentScenario = 'approve' | 'decline' | 'timeout' | 'provider_failure'

export const PAYMENT_SCENARIOS: PaymentScenario[] = [
  'approve',
  'decline',
  'timeout',
  'provider_failure',
]

/** How long the provider "thinks" before calling back. */
const SETTLEMENT_DELAY_MS = 2_000

export type AuthorizeRequest = {
  orderId: string
  amountCents: number
  currency: string
  scenario: PaymentScenario
  callbackUrl: string
}

export function isAuthorizeRequest(value: unknown): value is AuthorizeRequest {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.orderId === 'string' &&
    typeof v.amountCents === 'number' &&
    Number.isInteger(v.amountCents) &&
    v.amountCents > 0 &&
    typeof v.currency === 'string' &&
    typeof v.callbackUrl === 'string' &&
    typeof v.scenario === 'string' &&
    PAYMENT_SCENARIOS.includes(v.scenario as PaymentScenario)
  )
}

export function authorize(
  body: AuthorizeRequest,
  secret: string,
  schedule: Scheduler,
): { providerRef: string } {
  const providerRef = `pay_${randomUUID()}`

  // The whole point of the exercise: the outcome is decided and delivered
  // after we have already responded.
  if (body.scenario !== 'timeout') {
    schedule(async () => {
      await sleep(SETTLEMENT_DELAY_MS)
      await deliverCallback(body, providerRef, secret)
    })
  }
  // 'timeout' schedules nothing at all. The store is left waiting, exactly as
  // it would be if a real provider silently dropped the request. Its order
  // reconciles itself to payment_timeout once its deadline passes.

  return { providerRef }
}

async function deliverCallback(
  body: AuthorizeRequest,
  providerRef: string,
  secret: string,
): Promise<void> {
  // 'provider_failure' means the payment itself succeeds. The failure comes
  // later, when the store asks us to provision the eSIM — which is the case
  // the brief cares about, because the customer has already been charged.
  const succeeded = body.scenario === 'approve' || body.scenario === 'provider_failure'

  const payload = JSON.stringify({
    // A fresh id per delivery attempt would defeat deduplication, so this is
    // derived from the payment reference: a retry of the same event carries
    // the same id, and the store ignores the second copy.
    eventId: `evt_${providerRef}`,
    type: succeeded ? 'payment.succeeded' : 'payment.declined',
    providerRef,
    orderId: body.orderId,
    amountCents: body.amountCents,
    currency: body.currency,
    failureReason: succeeded ? null : 'card_declined',
    occurredAt: new Date().toISOString(),
  })

  const timestamp = String(Date.now())

  try {
    await fetch(body.callbackUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-provider-timestamp': timestamp,
        'x-provider-signature': sign(payload, timestamp, secret),
      },
      body: payload,
    })
  } catch (error) {
    // A real provider would queue and retry. Ours logs and gives up — the
    // store's own deadline reconciliation covers a lost callback anyway.
    console.error('[mock-provider] callback delivery failed', error)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

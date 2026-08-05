import { randomUUID } from 'node:crypto'
import type { PaymentScenario } from './payments'

/**
 * The mock eSIM provisioning service.
 *
 * This is the second half of the "background provider" the brief describes.
 * Once an order is paid, the store asks here for an actual eSIM, and gets back
 * an ICCID and an activation code — or a 503, which is the failure the whole
 * retry and admin-recovery story exists for.
 */

export type ProvisionRequest = {
  orderItemId: string
  providerPlanCode: string
  scenario: PaymentScenario
}

export type ProvisionResult = {
  iccid: string
  activationCode: string
  providerRef: string
}

export function isProvisionRequest(value: unknown): value is ProvisionRequest {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.orderItemId === 'string' &&
    typeof v.providerPlanCode === 'string' &&
    typeof v.scenario === 'string'
  )
}

/**
 * Why the caller passes the scenario rather than us remembering it:
 *
 * This runs as a serverless function. Two requests are two separate
 * invocations that share no memory, and there is no database on this side —
 * it is a mock. Keeping it stateless is both honest about that and simpler to
 * reason about.
 *
 * The practical consequence is a good one: when an admin retries a failed
 * fulfilment, the store sends `approve`, provisioning succeeds, and the order
 * completes. That is exactly the recovery story the brief asks to see.
 */
export function provision(body: ProvisionRequest): ProvisionResult | { failure: 'unavailable' } {
  if (body.scenario === 'provider_failure') {
    return { failure: 'unavailable' }
  }

  return {
    iccid: generateIccid(),
    activationCode: `LPA:1$rsp.trezuz.dev$${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`,
    providerRef: `esim_${randomUUID()}`,
  }
}

/** 19 digits, prefixed 8944 the way real eSIM ICCIDs are. */
function generateIccid(): string {
  let digits = ''
  while (digits.length < 15) {
    digits += Math.floor(Math.random() * 10).toString()
  }
  return `8944${digits}`
}

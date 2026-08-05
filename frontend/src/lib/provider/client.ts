import 'server-only'
import { serverEnv } from '@/lib/env.server'
import type { PaymentScenario } from '@trezuz/mock-provider'

/**
 * The store's HTTP client for the payment and eSIM provider.
 *
 * Everything the store knows about the provider goes through this file, and it
 * is all over the network. There is no import of provider internals anywhere
 * else — only the request/response types, which are the wire contract.
 *
 * There is no retry logic here on purpose. A retry has to decide whether the
 * previous attempt half-succeeded, and that decision needs the order's state,
 * which lives in `lib/orders/fulfilment.ts`. Retrying blindly at the transport
 * layer is how customers end up with two eSIMs.
 */

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}

const REQUEST_TIMEOUT_MS = 8_000

export async function authorizePayment(input: {
  orderId: string
  amountCents: number
  currency: string
  scenario: PaymentScenario
}): Promise<{ providerRef: string }> {
  const env = serverEnv()

  const response = await post(`${env.PROVIDER_BASE_URL}/payments/authorize`, {
    ...input,
    // We hand the provider the address to answer at. The browser is not
    // involved in the answer at any point.
    callbackUrl: `${env.APP_BASE_URL}/api/webhooks/payment`,
  })

  if (response.status !== 202) {
    throw new ProviderError(`Authorize failed with ${response.status}`, response.status)
  }

  return (await response.json()) as { providerRef: string }
}

export async function provisionEsim(input: {
  orderItemId: string
  providerPlanCode: string
  scenario: PaymentScenario
}): Promise<{ iccid: string; activationCode: string; providerRef: string }> {
  const env = serverEnv()

  const response = await post(`${env.PROVIDER_BASE_URL}/esim/provision`, input)

  if (!response.ok) {
    throw new ProviderError(`Provisioning failed with ${response.status}`, response.status)
  }

  return (await response.json()) as {
    iccid: string
    activationCode: string
    providerRef: string
  }
}

async function post(url: string, body: unknown): Promise<Response> {
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      // Without a timeout, a provider that hangs holds our request open until
      // the platform kills it, and the customer watches a spinner.
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: 'no-store',
    })
  } catch (error) {
    throw new ProviderError(
      error instanceof Error ? error.message : 'Provider unreachable',
      503,
    )
  }
}

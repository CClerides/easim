import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Webhook signatures.
 *
 * The store and the mock provider each hold the same shared secret. The
 * provider signs every callback it sends; the store refuses any callback whose
 * signature does not match. Without this, the payment webhook is a public URL
 * that anyone could POST "this order is paid" to.
 *
 * NOTE: `backend/src/hmac.ts` is a deliberate copy of this file. The two are
 * meant to be separate services that agree on a wire format, not one codebase
 * sharing a helper — so that moving the provider to its own deployment is a
 * config change rather than an untangling. Twenty-five duplicated lines is the
 * cheaper of the two costs.
 */

const MAX_SKEW_MS = 5 * 60 * 1000

/** Signs `timestamp.body`, so the timestamp cannot be swapped independently. */
export function sign(body: string, timestamp: string, secret: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
}

export function verify(
  body: string,
  timestamp: string,
  signature: string,
  secret: string,
  now: number = Date.now(),
): boolean {
  const sentAt = Number(timestamp)

  // A captured request replayed tomorrow fails here. The timestamp is covered
  // by the signature, so an attacker cannot simply update it.
  if (!Number.isFinite(sentAt) || Math.abs(now - sentAt) > MAX_SKEW_MS) return false

  const expected = Buffer.from(sign(body, timestamp, secret))
  const received = Buffer.from(signature)

  // timingSafeEqual throws when the buffers differ in length, so check first.
  // Comparing with === would leak how much of the signature was correct via
  // how long the comparison took.
  if (expected.length !== received.length) return false

  return timingSafeEqual(expected, received)
}

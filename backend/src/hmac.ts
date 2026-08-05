import { createHmac } from 'node:crypto'

/**
 * The provider's own copy of the signing scheme.
 *
 * This is duplicated from `frontend/src/lib/security/hmac.ts` on purpose. These
 * are two services that agree on a wire format. Sharing a module would couple
 * them, and this package is meant to be liftable into its own deployment
 * without dragging the store's source along.
 *
 * The provider only ever signs; it never verifies. Verification lives on the
 * store side, which is why there is no `verify` here.
 */
export function sign(body: string, timestamp: string, secret: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
}

import { after } from 'next/server'
import { handleProviderRequest } from '@easim/mock-provider'
import { serverEnv } from '@/lib/env.server'

/**
 * Mounts the mock provider inside this app.
 *
 * This file is the entire coupling between the store and the provider. To give
 * the provider its own deployment, copy these lines into a new project and
 * point PROVIDER_BASE_URL at it — no other file changes.
 *
 * `after()` runs the delayed callback once the response has been sent, which
 * is what stops the serverless function being frozen mid-flight.
 */
export const POST = (request: Request) =>
  handleProviderRequest(request, {
    secret: serverEnv().PROVIDER_HMAC_SECRET,
    schedule: (task) => after(task),
  })

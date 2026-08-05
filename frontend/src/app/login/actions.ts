'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { serverEnv } from '@/lib/env.server'
import { checkRateLimit } from '@/lib/security/rate-limit'

export type LoginState = { message: string; tone: 'info' | 'error' } | null

const emailSchema = z.email()

async function clientKey(prefix: string): Promise<string> {
  const headerList = await headers()
  const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  return `${prefix}:${ip}`
}

/**
 * Send a magic link.
 *
 * Known limitation, stated plainly in the README and on the page itself: this
 * uses Supabase's built-in mailer, which is rate limited to a couple of
 * messages an hour on the free tier and may refuse addresses outside the
 * project team. The demo buttons exist so a reviewer is never stuck behind
 * that.
 */
export async function signInWithMagicLink(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = emailSchema.safeParse(formData.get('email'))
  if (!parsed.success) {
    return { message: 'That does not look like an email address.', tone: 'error' }
  }

  const limit = checkRateLimit(await clientKey('magic-link'), { limit: 3, windowMs: 60_000 })
  if (!limit.allowed) {
    return {
      message: `Too many attempts. Try again in ${limit.retryAfterSeconds} seconds.`,
      tone: 'error',
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: `${serverEnv().APP_BASE_URL}/api/auth/confirm` },
  })

  if (error) {
    return {
      message:
        'The mail service refused that request — it is rate limited on the free tier. Use a demo sign-in below.',
      tone: 'error',
    }
  }

  // Deliberately identical whether or not that address has an account. A
  // different message for known addresses would let anyone test which emails
  // are registered here.
  return {
    message: 'If that address can receive mail from us, a sign-in link is on its way.',
    tone: 'info',
  }
}

/**
 * One-click sign-in as a seeded demo account.
 *
 * No password exists for these accounts and none is created. The server asks
 * Supabase for a magic-link token and redeems it immediately, server-side, so
 * no email is sent and nothing reaches the browser but the session cookie.
 *
 * The detail that matters: `role` is not user input. It selects between two
 * addresses held in the environment. There is no value a caller could supply
 * to sign in as somebody else.
 */
async function signInAsDemo(role: 'customer' | 'admin'): Promise<void> {
  const limit = checkRateLimit(await clientKey('demo-signin'), { limit: 10, windowMs: 60_000 })
  if (!limit.allowed) throw new Error('Too many sign-in attempts. Wait a moment.')

  const env = serverEnv()
  const email = role === 'admin' ? env.DEMO_ADMIN_EMAIL : env.DEMO_CUSTOMER_EMAIL

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })

  if (error || !data.properties?.hashed_token) {
    throw new Error(`Could not create a demo session: ${error?.message ?? 'no token returned'}`)
  }

  const supabase = await createClient()
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: data.properties.hashed_token,
  })

  if (verifyError) throw new Error(`Could not redeem the demo session: ${verifyError.message}`)
}

export async function signInAsDemoCustomer(): Promise<void> {
  await signInAsDemo('customer')
  redirect('/plans')
}

export async function signInAsDemoAdmin(): Promise<void> {
  await signInAsDemo('admin')
  redirect('/admin')
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}

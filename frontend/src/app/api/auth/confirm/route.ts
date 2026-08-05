import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { safeRedirectPath } from '@/lib/security/safe-redirect'

/**
 * Where a magic link lands.
 *
 * The link carries a one-time token; this exchanges it for a session cookie
 * and sends the visitor on their way.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeRedirectPath(searchParams.get('next'))

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}/login?error=missing_token`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=invalid_or_expired`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}

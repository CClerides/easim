import 'server-only'
import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/**
 * The authorisation boundary.
 *
 * Every protected page and every server action begins with one of these. Not
 * the middleware — middleware only redirects to make the experience sensible,
 * and a request that skips it must still be refused. Security that lives in
 * one place, called explicitly, is security you can audit by grepping for it.
 */

export async function getUser(): Promise<User | null> {
  const supabase = await createClient()
  // getUser() re-validates the token with Supabase. getSession() would just
  // decode the cookie, which the browser could have edited.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function requireUser(): Promise<User> {
  const user = await getUser()
  if (!user) redirect('/login')
  return user
}

export async function isAdmin(userId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
  return data?.role === 'admin'
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser()

  if (!(await isAdmin(user.id))) {
    // Deliberately the same destination a signed-out visitor gets. A distinct
    // "forbidden" page would confirm to a prodding customer that /admin exists
    // and that they simply lack the role.
    redirect('/')
  }

  return user
}

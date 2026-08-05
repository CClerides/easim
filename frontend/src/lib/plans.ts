import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'

/**
 * Reading the catalogue.
 *
 * The caching split here is deliberate, and it is the interesting decision in
 * this file:
 *
 *   Plan content — name, price, data, duration — changes about never. It is
 *   cached for an hour and tagged, so a price change can invalidate it
 *   immediately rather than waiting for the hour to pass.
 *
 *   Availability changes on every purchase. It is never cached. A plan shown
 *   as in stock when it is not would send a customer through checkout to a
 *   failure, which is precisely the experience the brief is testing.
 *
 * So a plan card is assembled from one cached read and one live read.
 */

export type Plan = {
  id: string
  slug: string
  region: string
  country_code: string
  data_mb: number
  duration_days: number
  price_cents: number
  currency: string
  provider_plan_code: string
}

const PLAN_COLUMNS =
  'id, slug, region, country_code, data_mb, duration_days, price_cents, currency, provider_plan_code'

export const PLANS_CACHE_TAG = 'plans'

/**
 * Every active plan, cheapest first. Cached for an hour under the `plans` tag.
 */
export const getActivePlans = unstable_cache(
  async (): Promise<Plan[]> => {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('plans')
      .select(PLAN_COLUMNS)
      .eq('active', true)
      .order('price_cents', { ascending: true })

    if (error) throw new Error(`Failed to load plans: ${error.message}`)
    return data ?? []
  },
  ['active-plans'],
  { revalidate: 3600, tags: [PLANS_CACHE_TAG] },
)

export const getPlanBySlug = unstable_cache(
  async (slug: string): Promise<Plan | null> => {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('plans')
      .select(PLAN_COLUMNS)
      .eq('slug', slug)
      .eq('active', true)
      .maybeSingle()

    if (error) throw new Error(`Failed to load plan ${slug}: ${error.message}`)
    return data
  },
  ['plan-by-slug'],
  { revalidate: 3600, tags: [PLANS_CACHE_TAG] },
)

/**
 * How many eSIMs are left, per plan. Never cached.
 *
 * Goes through the `plan_availability()` database function rather than
 * querying the table. The RLS policy on esim_profiles only lets you read a
 * profile that was sold to you, so a direct count would return zero for
 * everyone. The function returns aggregates only — the count is public
 * information, the ICCID and activation code never are.
 */
export async function getAvailability(): Promise<Map<string, number>> {
  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('plan_availability')

  // Availability is a nicety on the listing page. If it fails, the shop should
  // still open, so this degrades to "unknown" rather than throwing.
  if (error || !data) return new Map()

  return new Map(
    (data as { plan_id: string; available_count: number }[]).map((row) => [
      row.plan_id,
      Number(row.available_count),
    ]),
  )
}

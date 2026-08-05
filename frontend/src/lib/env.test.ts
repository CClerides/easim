import { describe, it, expect } from 'vitest'
import { parseEnv } from './env'

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
  PROVIDER_BASE_URL: 'http://localhost:3000/api/mock-provider',
  PROVIDER_HMAC_SECRET: 'a-secret-at-least-16-chars',
  APP_BASE_URL: 'http://localhost:3000',
  DEMO_CUSTOMER_EMAIL: 'demo@easim.dev',
  DEMO_ADMIN_EMAIL: 'admin@easim.dev',
}

describe('parseEnv', () => {
  it('returns typed values when every variable is present', () => {
    expect(parseEnv(valid).APP_BASE_URL).toBe('http://localhost:3000')
  })

  it('throws naming the variable when a required one is missing', () => {
    const { SUPABASE_SECRET_KEY: _omitted, ...missing } = valid
    expect(() => parseEnv(missing)).toThrow(/SUPABASE_SECRET_KEY/)
  })

  it('rejects an HMAC secret too short to be safe', () => {
    expect(() => parseEnv({ ...valid, PROVIDER_HMAC_SECRET: 'short' })).toThrow()
  })

  it('rejects a malformed URL', () => {
    expect(() => parseEnv({ ...valid, APP_BASE_URL: 'not-a-url' })).toThrow()
  })

  it('rejects a demo address that is not an email', () => {
    expect(() => parseEnv({ ...valid, DEMO_ADMIN_EMAIL: 'nope' })).toThrow()
  })
})

describe('parseEnv — deriving this deployment\'s own origin', () => {
  const withoutOrigin = { ...valid } as Record<string, unknown>
  delete withoutOrigin.APP_BASE_URL
  delete withoutOrigin.PROVIDER_BASE_URL

  it('derives both URLs from the Vercel production hostname', () => {
    const parsed = parseEnv({ ...withoutOrigin, VERCEL_PROJECT_PRODUCTION_URL: 'easim.vercel.app' })
    expect(parsed.APP_BASE_URL).toBe('https://easim.vercel.app')
    expect(parsed.PROVIDER_BASE_URL).toBe('https://easim.vercel.app/api/mock-provider')
  })

  it('falls back to the per-deployment hostname for previews', () => {
    const parsed = parseEnv({ ...withoutOrigin, VERCEL_URL: 'easim-abc123.vercel.app' })
    expect(parsed.APP_BASE_URL).toBe('https://easim-abc123.vercel.app')
  })

  it('lets an explicit value win, for a custom domain or localhost', () => {
    const parsed = parseEnv({
      ...withoutOrigin,
      APP_BASE_URL: 'https://easim.com',
      VERCEL_PROJECT_PRODUCTION_URL: 'easim.vercel.app',
    })
    expect(parsed.APP_BASE_URL).toBe('https://easim.com')
    expect(parsed.PROVIDER_BASE_URL).toBe('https://easim.com/api/mock-provider')
  })

  it('still fails loudly when there is nothing to derive from', () => {
    expect(() => parseEnv(withoutOrigin)).toThrow(/APP_BASE_URL/)
  })

  it('keeps an explicit provider URL, for a separately deployed provider', () => {
    const parsed = parseEnv({
      ...withoutOrigin,
      APP_BASE_URL: 'https://easim.com',
      PROVIDER_BASE_URL: 'https://provider.easim.com',
    })
    expect(parsed.PROVIDER_BASE_URL).toBe('https://provider.easim.com')
  })
})

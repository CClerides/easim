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

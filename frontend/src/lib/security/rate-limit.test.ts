import { describe, it, expect, beforeEach } from 'vitest'
import { checkRateLimit, resetRateLimits } from './rate-limit'

describe('checkRateLimit', () => {
  beforeEach(() => resetRateLimits())

  it('allows requests up to the limit', () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit('user-a', { limit: 5, windowMs: 60_000 }).allowed).toBe(true)
    }
  })

  it('refuses the request after the limit', () => {
    for (let i = 0; i < 5; i++) checkRateLimit('user-a', { limit: 5, windowMs: 60_000 })
    expect(checkRateLimit('user-a', { limit: 5, windowMs: 60_000 }).allowed).toBe(false)
  })

  it('keys are independent', () => {
    for (let i = 0; i < 5; i++) checkRateLimit('user-a', { limit: 5, windowMs: 60_000 })
    expect(checkRateLimit('user-b', { limit: 5, windowMs: 60_000 }).allowed).toBe(true)
  })

  it('lets the caller through again once the window has passed', () => {
    const now = 1_000_000
    const options = { limit: 2, windowMs: 60_000 }

    expect(checkRateLimit('user-a', options, now).allowed).toBe(true)
    expect(checkRateLimit('user-a', options, now).allowed).toBe(true)
    expect(checkRateLimit('user-a', options, now).allowed).toBe(false)

    expect(checkRateLimit('user-a', options, now + 60_001).allowed).toBe(true)
  })

  it('reports how long to wait when refused', () => {
    const now = 1_000_000
    const options = { limit: 1, windowMs: 60_000 }

    checkRateLimit('user-a', options, now)
    const refused = checkRateLimit('user-a', options, now + 10_000)

    expect(refused.allowed).toBe(false)
    expect(refused.retryAfterSeconds).toBe(50)
  })
})

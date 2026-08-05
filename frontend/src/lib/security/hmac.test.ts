import { describe, it, expect } from 'vitest'
import { sign, verify } from './hmac'

const SECRET = 'test-secret-at-least-16-chars'
const BODY = JSON.stringify({ eventId: 'evt_1', type: 'payment.succeeded' })
const NOW = 1_800_000_000_000

describe('webhook signatures', () => {
  it('verifies a signature it just produced', () => {
    const ts = String(NOW)
    expect(verify(BODY, ts, sign(BODY, ts, SECRET), SECRET, NOW)).toBe(true)
  })

  it('rejects a tampered body', () => {
    const ts = String(NOW)
    const signature = sign(BODY, ts, SECRET)
    const tampered = JSON.stringify({ eventId: 'evt_1', type: 'payment.declined' })
    expect(verify(tampered, ts, signature, SECRET, NOW)).toBe(false)
  })

  it('rejects a signature made with a different secret', () => {
    const ts = String(NOW)
    expect(verify(BODY, ts, sign(BODY, ts, 'a-different-secret-here'), SECRET, NOW)).toBe(false)
  })

  // The timestamp is inside the signed payload, so an attacker who captures a
  // valid request cannot resend it later with a fresh timestamp.
  it('rejects a timestamp older than the replay window', () => {
    const ts = String(NOW - 6 * 60 * 1000)
    expect(verify(BODY, ts, sign(BODY, ts, SECRET), SECRET, NOW)).toBe(false)
  })

  it('rejects a timestamp too far in the future', () => {
    const ts = String(NOW + 6 * 60 * 1000)
    expect(verify(BODY, ts, sign(BODY, ts, SECRET), SECRET, NOW)).toBe(false)
  })

  it('accepts a timestamp inside the window', () => {
    const ts = String(NOW - 60 * 1000)
    expect(verify(BODY, ts, sign(BODY, ts, SECRET), SECRET, NOW)).toBe(true)
  })

  it('rejects a non-numeric timestamp instead of coercing it', () => {
    expect(verify(BODY, 'not-a-number', sign(BODY, 'not-a-number', SECRET), SECRET, NOW)).toBe(false)
  })

  // timingSafeEqual throws on length mismatch, so length is checked first.
  it('rejects a malformed signature without throwing', () => {
    expect(() => verify(BODY, String(NOW), 'short', SECRET, NOW)).not.toThrow()
    expect(verify(BODY, String(NOW), 'short', SECRET, NOW)).toBe(false)
    expect(verify(BODY, String(NOW), '', SECRET, NOW)).toBe(false)
  })

  it('binds the signature to the timestamp, not just the body', () => {
    const signature = sign(BODY, String(NOW), SECRET)
    // Same body, different timestamp: the captured signature must not verify.
    expect(verify(BODY, String(NOW - 1000), signature, SECRET, NOW)).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import { safeRedirectPath } from './safe-redirect'

describe('safeRedirectPath', () => {
  it('allows a path on this site', () => {
    expect(safeRedirectPath('/account')).toBe('/account')
    expect(safeRedirectPath('/orders/abc-123')).toBe('/orders/abc-123')
    expect(safeRedirectPath('/plans?region=japan')).toBe('/plans?region=japan')
  })

  it('falls back when nothing was supplied', () => {
    expect(safeRedirectPath(null)).toBe('/account')
    expect(safeRedirectPath(undefined)).toBe('/account')
    expect(safeRedirectPath('')).toBe('/account')
  })

  it('refuses an absolute URL to another site', () => {
    expect(safeRedirectPath('https://evil.example')).toBe('/account')
    expect(safeRedirectPath('http://evil.example/path')).toBe('/account')
  })

  // Starts with a slash, but browsers read it as protocol-relative and leave.
  it('refuses a protocol-relative URL', () => {
    expect(safeRedirectPath('//evil.example')).toBe('/account')
    expect(safeRedirectPath('//evil.example/steal')).toBe('/account')
  })

  it('refuses a backslash-escaped authority', () => {
    expect(safeRedirectPath('/\\evil.example')).toBe('/account')
  })

  it('honours a caller-supplied fallback', () => {
    expect(safeRedirectPath('https://evil.example', '/')).toBe('/')
  })
})

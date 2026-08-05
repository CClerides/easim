import { describe, it, expect } from 'vitest'
import { calculateTotals } from './pricing'

describe('calculateTotals', () => {
  it('sums line items in integer cents', () => {
    expect(
      calculateTotals([
        { unitPriceCents: 1490, qty: 2 },
        { unitPriceCents: 990, qty: 1 },
      ]),
    ).toEqual({ subtotalCents: 3970, totalCents: 3970 })
  })

  it('returns zero for an empty cart', () => {
    expect(calculateTotals([])).toEqual({ subtotalCents: 0, totalCents: 0 })
  })

  it('rejects a non-integer price rather than rounding silently', () => {
    expect(() => calculateTotals([{ unitPriceCents: 14.9, qty: 1 }])).toThrow(/integer cents/)
  })

  it('rejects a zero or negative quantity', () => {
    expect(() => calculateTotals([{ unitPriceCents: 100, qty: 0 }])).toThrow(/positive integer/)
    expect(() => calculateTotals([{ unitPriceCents: 100, qty: -3 }])).toThrow(/positive integer/)
  })

  it('rejects a fractional quantity', () => {
    expect(() => calculateTotals([{ unitPriceCents: 100, qty: 1.5 }])).toThrow(/positive integer/)
  })

  it('stays exact where floating point money would drift', () => {
    // 0.1 + 0.2 !== 0.3 in floats. In cents it is simply 10 + 20 === 30.
    expect(
      calculateTotals([
        { unitPriceCents: 10, qty: 1 },
        { unitPriceCents: 20, qty: 1 },
      ]).totalCents,
    ).toBe(30)
  })
})

import { describe, it, expect } from 'vitest'
import { formatPrice, formatData, formatDuration } from './format'

describe('formatPrice', () => {
  it('renders integer cents as euro', () => {
    expect(formatPrice(1490)).toBe('€14.90')
    expect(formatPrice(990)).toBe('€9.90')
    expect(formatPrice(4990)).toBe('€49.90')
  })

  it('keeps trailing zeroes so prices line up', () => {
    expect(formatPrice(1400)).toBe('€14.00')
    expect(formatPrice(0)).toBe('€0.00')
  })
})

describe('formatData', () => {
  it('renders whole gigabytes without a decimal point', () => {
    expect(formatData(5120)).toBe('5 GB')
    expect(formatData(20480)).toBe('20 GB')
  })

  it('falls back to megabytes below a gigabyte', () => {
    expect(formatData(512)).toBe('512 MB')
  })

  it('keeps one decimal for a partial gigabyte', () => {
    expect(formatData(1536)).toBe('1.5 GB')
  })
})

describe('formatDuration', () => {
  it('pluralises correctly', () => {
    expect(formatDuration(1)).toBe('1 day')
    expect(formatDuration(15)).toBe('15 days')
  })
})

import { describe, expect, it } from 'vitest'
import { formatPct } from '../utils/formatters.js'

describe('formatPct', () => {
  it('omits unnecessary decimal zeros in customer-facing percentages', () => {
    expect(formatPct(10)).toBe('10%')
    expect(formatPct(13)).toBe('13%')
    expect(formatPct(12.5)).toBe('12.5%')
    expect(formatPct(12.25)).toBe('12.25%')
  })
})

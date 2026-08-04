import { describe, expect, it } from 'vitest'
import { formatMoney, formatMinutes } from './money'

/**
 * Money is stored as integer centavos everywhere. Every screen that shows a
 * price goes through here, so rounding and currency live in one place.
 */

describe('formatMoney', () => {
  it('renders whole pesos without stray decimals', () => {
    expect(formatMoney(60000, 'PHP')).toBe('₱600')
  })

  it('keeps centavos when a price is not a whole peso', () => {
    expect(formatMoney(60050, 'PHP')).toBe('₱600.50')
  })

  it('renders zero as a price, not as an empty string', () => {
    expect(formatMoney(0, 'PHP')).toBe('₱0')
  })

  it('groups thousands so a five-figure total stays readable', () => {
    expect(formatMoney(1234500, 'PHP')).toBe('₱12,345')
  })

  it('falls back to the currency code for a currency with no symbol', () => {
    expect(formatMoney(60000, 'XYZ')).toContain('600')
  })
})

describe('formatMinutes', () => {
  it('renders a round hour as hours', () => {
    expect(formatMinutes(60)).toBe('1 hr')
  })

  it('pluralises multiple hours', () => {
    expect(formatMinutes(120)).toBe('2 hrs')
  })

  it('renders a half hour as minutes', () => {
    expect(formatMinutes(30)).toBe('30 min')
  })

  it('combines hours and minutes', () => {
    expect(formatMinutes(90)).toBe('1 hr 30 min')
  })
})

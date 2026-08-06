import { describe, expect, it } from 'vitest'
import { describePricingRules } from './pricing'
import { club, makeCourt } from '../../../../test/admin-fixtures'
import type { PricingRule } from '@/lib/domain/types'

const harbor = makeCourt({ id: 'court-1', name: 'Harbor Court' })

function makeRule(overrides: Partial<PricingRule> = {}): PricingRule {
  return {
    id: 'rule-1',
    label: 'Evening peak',
    courtId: null,
    daysOfWeek: [],
    startsAtTime: null,
    endsAtTime: null,
    minDurationMinutes: null,
    appliesToTier: null,
    kind: 'fixed',
    valueCents: 75_000,
    valuePercent: null,
    priority: 10,
    ...overrides,
  }
}

describe('describePricingRules', () => {
  it('numbers rules by the order they are evaluated in, highest priority first', () => {
    // Arrange — the first match wins, so the ordering is the rule.
    const rules = [
      makeRule({ id: 'low', label: 'Base rate', priority: 1 }),
      makeRule({ id: 'high', label: 'Evening peak', priority: 20 }),
    ]

    // Act
    const rows = describePricingRules(rules, [harbor], club)

    // Assert
    expect(rows.map((row) => [row.order, row.name])).toEqual([
      [1, 'Evening peak'],
      [2, 'Base rate'],
    ])
  })

  it('says a rule applies to every court when it names none', () => {
    // Act
    const [row] = describePricingRules([makeRule()], [harbor], club)

    // Assert
    expect(row.courts).toEqual(['All courts'])
  })

  it('names the court a scoped rule targets', () => {
    // Act
    const [row] = describePricingRules([makeRule({ courtId: harbor.id })], [harbor], club)

    // Assert
    expect(row.courts).toEqual(['Harbor Court'])
  })

  it('still renders a rule whose court has since been removed', () => {
    // Arrange — a deactivated court must not blank out the rule that used it.
    // Act
    const [row] = describePricingRules([makeRule({ courtId: 'gone' })], [harbor], club)

    // Assert
    expect(row.courts).toEqual(['Unknown court'])
  })

  it('spells out the day, time, duration, and tier conditions together', () => {
    // Arrange
    const rule = makeRule({
      daysOfWeek: [1, 2, 3, 4, 5],
      startsAtTime: '18:00',
      endsAtTime: '22:00',
      minDurationMinutes: 90,
      appliesToTier: 'pro',
    })

    // Act
    const [row] = describePricingRules([rule], [harbor], club)

    // Assert
    expect(row.condition).toBe('Mon, Tue, Wed, Thu, Fri · 6:00 PM–10:00 PM · 1 hr 30 min or longer · Pro tier')
  })

  it('describes an unconditional rule as applying always', () => {
    // Act
    const [row] = describePricingRules([makeRule()], [harbor], club)

    // Assert
    expect(row.condition).toBe('Any day, any time')
  })

  it('renders a fixed rate as an hourly price', () => {
    // Act
    const [row] = describePricingRules([makeRule({ kind: 'fixed', valueCents: 75_000 })], [], club)

    // Assert
    expect(row.rate).toBe('₱750/hr')
  })

  it('renders an amount adjustment with its sign, so a discount cannot read as a surcharge', () => {
    // Arrange
    const surcharge = makeRule({ id: 'up', kind: 'amount_delta', valueCents: 10_000 })
    const discount = makeRule({ id: 'down', kind: 'amount_delta', valueCents: -10_000 })

    // Act
    const rows = describePricingRules([surcharge, discount], [], club)

    // Assert
    expect(rows.map((row) => row.rate)).toEqual(['+₱100/hr', '−₱100/hr'])
  })

  it('renders a percentage adjustment with its sign', () => {
    // Arrange
    const rule = makeRule({ kind: 'percent_delta', valueCents: null, valuePercent: -15 })

    // Act
    const [row] = describePricingRules([rule], [], club)

    // Assert
    expect(row.rate).toBe('−15%')
  })

  it('says the rate is unset rather than printing a bare currency symbol', () => {
    // Arrange — a half-configured rule is a real row in the table.
    const rule = makeRule({ kind: 'fixed', valueCents: null })

    // Act
    const [row] = describePricingRules([rule], [], club)

    // Assert
    expect(row.rate).toBe('Not set')
  })
})

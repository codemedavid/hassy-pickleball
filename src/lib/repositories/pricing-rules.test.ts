import { describe, expect, it } from 'vitest'
import { fakeClient, fakeTable } from '../../../test/postgrest-fake'
import { listActivePricingRules } from './pricing-rules'

const RULE_ROW = {
  id: 'rule-1',
  club_id: 'club-1',
  court_id: null,
  label: 'Prime time',
  days_of_week: [1, 2, 3, 4, 5],
  starts_at_time: '17:00:00',
  ends_at_time: '21:00:00',
  min_duration_minutes: null,
  applies_to_tier: null,
  kind: 'percent_delta' as const,
  value_cents: null,
  value_percent: '20.000',
  priority: 10,
  is_active: true,
}

describe('listActivePricingRules', () => {
  it('orders rules by priority so the pricing engine stacks them correctly', async () => {
    const rules = fakeTable({ data: [], error: null })

    await listActivePricingRules(fakeClient({ pricing_rules: rules }), 'club-1')

    expect(rules.calls).toContainEqual({ method: 'order', args: ['priority', { ascending: true }] })
  })

  it('leaves disabled rules out of the quote', async () => {
    const rules = fakeTable({ data: [], error: null })

    await listActivePricingRules(fakeClient({ pricing_rules: rules }), 'club-1')

    expect(rules.calls).toContainEqual({ method: 'eq', args: ['is_active', true] })
  })

  it('coerces a numeric-string percent into a number for the pricing engine', async () => {
    const client = fakeClient({ pricing_rules: fakeTable({ data: [RULE_ROW], error: null }) })

    const [rule] = await listActivePricingRules(client, 'club-1')

    expect(rule?.valuePercent).toBe(20)
  })

  it('throws with context when the query errors', async () => {
    const client = fakeClient({ pricing_rules: fakeTable({ data: null, error: { message: 'x' } }) })

    await expect(listActivePricingRules(client, 'club-1')).rejects.toThrow(
      /Failed to load pricing rules/,
    )
  })
})

import { describe, expect, it } from 'vitest'
import { callsFor, fakeClient, fakeTable } from '../../../test/postgrest-fake'
import {
  createPricingRule,
  listActivePricingRules,
  listAllPricingRules,
  updatePricingRule,
} from './pricing-rules'

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

describe('listAllPricingRules', () => {
  it('includes disabled rules, because the admin editor must show them', async () => {
    const rules = fakeTable({ data: [RULE_ROW], error: null })

    await listAllPricingRules(fakeClient({ pricing_rules: rules }), 'club-1')

    expect(rules.calls).not.toContainEqual({ method: 'eq', args: ['is_active', true] })
  })
})

describe('createPricingRule', () => {
  it('writes a percent rule with the percent column and a null cents column', async () => {
    const rules = fakeTable({ data: RULE_ROW, error: null })

    await createPricingRule(fakeClient({ pricing_rules: rules }), {
      clubId: 'club-1',
      courtId: null,
      label: 'Prime time',
      daysOfWeek: [1, 2, 3, 4, 5],
      startsAtTime: '17:00',
      endsAtTime: '21:00',
      minDurationMinutes: null,
      appliesToTier: null,
      kind: 'percent_delta',
      valueCents: null,
      valuePercent: 20,
      priority: 10,
    })

    expect(callsFor(rules, 'insert')[0]?.args[0]).toMatchObject({
      club_id: 'club-1',
      court_id: null,
      label: 'Prime time',
      days_of_week: [1, 2, 3, 4, 5],
      starts_at_time: '17:00',
      ends_at_time: '21:00',
      kind: 'percent_delta',
      value_cents: null,
      value_percent: 20,
      priority: 10,
    })
  })

  it('throws with context when the database rejects the rule shape', async () => {
    const client = fakeClient({
      pricing_rules: fakeTable({
        data: null,
        error: { message: 'violates pricing_rules_value_matches_kind' },
      }),
    })

    await expect(
      createPricingRule(client, {
        clubId: 'club-1',
        courtId: null,
        label: 'Broken',
        daysOfWeek: [],
        startsAtTime: null,
        endsAtTime: null,
        minDurationMinutes: null,
        appliesToTier: null,
        kind: 'percent_delta',
        valueCents: 100,
        valuePercent: null,
        priority: 0,
      }),
    ).rejects.toThrow(/Failed to create pricing rule/)
  })
})

describe('updatePricingRule', () => {
  it('sends only the supplied fields', async () => {
    const rules = fakeTable({ data: RULE_ROW, error: null })

    await updatePricingRule(fakeClient({ pricing_rules: rules }), 'rule-1', { priority: 5 })

    expect(callsFor(rules, 'update')[0]?.args[0]).toEqual({ priority: 5 })
    expect(rules.calls).toContainEqual({ method: 'eq', args: ['id', 'rule-1'] })
  })

  it('rejects an empty patch instead of issuing a no-op write', async () => {
    const client = fakeClient({ pricing_rules: fakeTable({ data: RULE_ROW, error: null }) })

    await expect(updatePricingRule(client, 'rule-1', {})).rejects.toThrow(/nothing to update/i)
  })
})

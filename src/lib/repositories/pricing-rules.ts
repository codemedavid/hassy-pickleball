import 'server-only'

import { toPricingRule } from './mappers'
import { raise, RepositoryError, type Client } from './support'
import type { Tables } from './rows'
import type { CustomerTier, PricingRule, RateKind } from '@/lib/domain/types'

type PricingRuleUpdate = Tables['pricing_rules']['Update']

/**
 * Pricing rules: customer-facing reads plus the admin editor's writes.
 * The database enforces that a percent rule carries a percent and a cash rule
 * carries cents (`pricing_rules_value_matches_kind`); this layer does not
 * duplicate that check, it surfaces the failure.
 */

export type CreatePricingRuleInput = {
  readonly clubId: string
  /** Null applies the rule to every court in the club. */
  readonly courtId: string | null
  readonly label: string
  readonly daysOfWeek: readonly number[]
  readonly startsAtTime: string | null
  readonly endsAtTime: string | null
  readonly minDurationMinutes: number | null
  readonly appliesToTier: CustomerTier | null
  readonly kind: RateKind
  readonly valueCents: number | null
  readonly valuePercent: number | null
  readonly priority: number
}

export type PricingRulePatch = Partial<Omit<CreatePricingRuleInput, 'clubId'>> & {
  readonly isActive?: boolean
}

export async function listActivePricingRules(
  client: Client,
  clubId: string,
): Promise<PricingRule[]> {
  const { data, error } = await client
    .from('pricing_rules')
    .select('*')
    .eq('club_id', clubId)
    .eq('is_active', true)
    .order('priority', { ascending: true })

  raise('Failed to load pricing rules', error)

  return (data ?? []).map(toPricingRule)
}

export async function listAllPricingRules(client: Client, clubId: string): Promise<PricingRule[]> {
  const { data, error } = await client
    .from('pricing_rules')
    .select('*')
    .eq('club_id', clubId)
    .order('priority', { ascending: true })

  raise('Failed to load pricing rules', error)

  return (data ?? []).map(toPricingRule)
}

export async function createPricingRule(
  client: Client,
  input: CreatePricingRuleInput,
): Promise<PricingRule> {
  const { data, error } = await client
    .from('pricing_rules')
    .insert({
      club_id: input.clubId,
      court_id: input.courtId,
      label: input.label,
      days_of_week: [...input.daysOfWeek],
      starts_at_time: input.startsAtTime,
      ends_at_time: input.endsAtTime,
      min_duration_minutes: input.minDurationMinutes,
      applies_to_tier: input.appliesToTier,
      kind: input.kind,
      value_cents: input.valueCents,
      value_percent: input.valuePercent,
      priority: input.priority,
    })
    .select('*')
    .single()

  raise('Failed to create pricing rule', error)

  return toPricingRule(data as NonNullable<typeof data>)
}

function toRuleRowPatch(patch: PricingRulePatch): PricingRuleUpdate {
  const columns: PricingRuleUpdate = {}

  if (patch.courtId !== undefined) columns.court_id = patch.courtId
  if (patch.label !== undefined) columns.label = patch.label
  if (patch.daysOfWeek !== undefined) columns.days_of_week = [...patch.daysOfWeek]
  if (patch.startsAtTime !== undefined) columns.starts_at_time = patch.startsAtTime
  if (patch.endsAtTime !== undefined) columns.ends_at_time = patch.endsAtTime
  if (patch.minDurationMinutes !== undefined)
    columns.min_duration_minutes = patch.minDurationMinutes
  if (patch.appliesToTier !== undefined) columns.applies_to_tier = patch.appliesToTier
  if (patch.kind !== undefined) columns.kind = patch.kind
  if (patch.valueCents !== undefined) columns.value_cents = patch.valueCents
  if (patch.valuePercent !== undefined) columns.value_percent = patch.valuePercent
  if (patch.priority !== undefined) columns.priority = patch.priority
  if (patch.isActive !== undefined) columns.is_active = patch.isActive

  return columns
}

export async function updatePricingRule(
  client: Client,
  ruleId: string,
  patch: PricingRulePatch,
): Promise<PricingRule> {
  const columns = toRuleRowPatch(patch)

  if (Object.keys(columns).length === 0) {
    throw new RepositoryError('Nothing to update on this pricing rule')
  }

  const { data, error } = await client
    .from('pricing_rules')
    .update(columns)
    .eq('id', ruleId)
    .select('*')
    .single()

  raise('Failed to update pricing rule', error)

  return toPricingRule(data as NonNullable<typeof data>)
}

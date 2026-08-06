import { parseClockTime } from '@/lib/domain/time'
import { formatMinutes, formatMoney } from '@/lib/format/money'
import type { Club, Court } from '@/lib/repositories/mappers'
import type { CustomerTier, PricingRule } from '@/lib/domain/types'

/**
 * Human descriptions of the pricing rules.
 *
 * The engine evaluates rules highest priority first and stops at the first
 * match, so the numbering here is not decoration — it is the rule itself, and
 * the list is sorted to match.
 */

export type PricingRuleRow = {
  readonly id: string
  readonly order: number
  readonly name: string
  readonly condition: string
  readonly courts: readonly string[]
  readonly rate: string
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const TIER_LABELS: Record<CustomerTier, string> = {
  standard: 'Standard tier',
  regular: 'Regular tier',
  pro: 'Pro tier',
}

const ALL_COURTS = 'All courts'
const MISSING_COURT = 'Unknown court'
const NO_CONDITIONS = 'Any day, any time'
const NO_RATE = 'Not set'

/** Minus sign, not a hyphen: it has to read as a reduction at a glance. */
const MINUS = '−'

function formatClock(value: string): string {
  const minutes = parseClockTime(value)
  const hour = Math.floor(minutes / 60)
  const suffix = hour < 12 ? 'AM' : 'PM'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12

  return `${hour12}:${String(minutes % 60).padStart(2, '0')} ${suffix}`
}

function describeCondition(rule: PricingRule): string {
  const parts = [
    rule.daysOfWeek.length > 0 ? rule.daysOfWeek.map((day) => DAY_NAMES[day]).join(', ') : null,
    rule.startsAtTime && rule.endsAtTime
      ? `${formatClock(rule.startsAtTime)}–${formatClock(rule.endsAtTime)}`
      : null,
    rule.minDurationMinutes ? `${formatMinutes(rule.minDurationMinutes)} or longer` : null,
    rule.appliesToTier ? TIER_LABELS[rule.appliesToTier] : null,
  ].filter((part): part is string => part !== null)

  return parts.length > 0 ? parts.join(' · ') : NO_CONDITIONS
}

function signed(value: number, formatted: string): string {
  return value < 0 ? `${MINUS}${formatted}` : `+${formatted}`
}

function describeRate(rule: PricingRule, club: Club): string {
  if (rule.kind === 'percent_delta') {
    return rule.valuePercent === null
      ? NO_RATE
      : signed(rule.valuePercent, `${Math.abs(rule.valuePercent)}%`)
  }

  if (rule.valueCents === null) {
    return NO_RATE
  }

  const money = `${formatMoney(Math.abs(rule.valueCents), club.currency)}/hr`

  return rule.kind === 'fixed' ? money : signed(rule.valueCents, money)
}

function describeCourts(rule: PricingRule, courts: readonly Court[]): readonly string[] {
  if (rule.courtId === null) {
    return [ALL_COURTS]
  }

  // A rule outliving the court it named still has to render, or the row goes blank.
  return [courts.find((court) => court.id === rule.courtId)?.name ?? MISSING_COURT]
}

export function describePricingRules(
  rules: readonly PricingRule[],
  courts: readonly Court[],
  club: Club,
): readonly PricingRuleRow[] {
  return [...rules]
    .sort((a, b) => b.priority - a.priority)
    .map((rule, index) => ({
      id: rule.id,
      order: index + 1,
      name: rule.label,
      condition: describeCondition(rule),
      courts: describeCourts(rule, courts),
      rate: describeRate(rule, club),
    }))
}

import { MINUTES_PER_HOUR, getZonedParts, parseClockTime } from './time'
import type { CustomerTier, PricingRule } from './types'

const PERCENT_DIVISOR = 100

export type SegmentContext = {
  readonly courtId: string
  readonly startsAt: Date
  readonly durationMinutes: number
  readonly timeZone: string
  readonly tier: CustomerTier
}

/**
 * Whether a rule's constraints all hold for this segment. Day and time are
 * evaluated in club-local terms — a 22:30 UTC start is Sunday morning in Manila.
 */
export function ruleApplies(rule: PricingRule, context: SegmentContext): boolean {
  if (rule.courtId !== null && rule.courtId !== context.courtId) {
    return false
  }

  if (rule.appliesToTier !== null && rule.appliesToTier !== context.tier) {
    return false
  }

  if (rule.minDurationMinutes !== null && context.durationMinutes < rule.minDurationMinutes) {
    return false
  }

  const { dayOfWeek, minutesOfDay } = getZonedParts(context.startsAt, context.timeZone)

  if (rule.daysOfWeek.length > 0 && !rule.daysOfWeek.includes(dayOfWeek)) {
    return false
  }

  if (rule.startsAtTime !== null && minutesOfDay < parseClockTime(rule.startsAtTime)) {
    return false
  }

  if (rule.endsAtTime !== null && minutesOfDay >= parseClockTime(rule.endsAtTime)) {
    return false
  }

  return true
}

function applyRule(hourlyRateCents: number, rule: PricingRule): number {
  switch (rule.kind) {
    case 'fixed':
      return rule.valueCents ?? hourlyRateCents
    case 'amount_delta':
      return hourlyRateCents + (rule.valueCents ?? 0)
    case 'percent_delta':
      return hourlyRateCents * (1 + (rule.valuePercent ?? 0) / PERCENT_DIVISOR)
  }
}

export type CourtQuote = {
  readonly hourlyRateCents: number
  readonly totalCents: number
  readonly appliedRules: readonly PricingRule[]
}

export type QuoteCourtSegmentInput = SegmentContext & {
  readonly basePriceCents: number
  readonly rules: readonly PricingRule[]
}

/**
 * Quotes one court segment. Rules transform the hourly rate in `priority`
 * order (lowest first); the session total is that rate prorated by duration.
 *
 * This is the single source of truth for court pricing — `create_booking`
 * accepts the resulting per-segment price rather than recomputing it in SQL.
 */
export function quoteCourtSegment(input: QuoteCourtSegmentInput): CourtQuote {
  if (input.durationMinutes <= 0) {
    throw new Error('durationMinutes must be greater than 0')
  }

  const appliedRules = [...input.rules]
    .filter((rule) => ruleApplies(rule, input))
    .sort((a, b) => a.priority - b.priority)

  const hourlyRateCents = appliedRules.reduce(applyRule, input.basePriceCents)
  const total = (hourlyRateCents * input.durationMinutes) / MINUTES_PER_HOUR

  return {
    hourlyRateCents: Math.round(hourlyRateCents),
    totalCents: Math.max(0, Math.round(total)),
    appliedRules,
  }
}

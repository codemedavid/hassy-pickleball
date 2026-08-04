import { quoteCourtSegment } from '@/lib/domain/pricing'
import { durationMinutes } from '@/lib/domain/time'
import type { CourtSelection, CustomerTier, PricingRule } from '@/lib/domain/types'

export type QuotableCourt = {
  readonly id: string
  readonly basePriceCents: number
}

export type RequestedSelection = {
  readonly courtId: string
  readonly startsAt: Date
  readonly endsAt: Date
}

export type QuoteSelectionsInput = {
  readonly selections: readonly RequestedSelection[]
  readonly courts: readonly QuotableCourt[]
  readonly rules: readonly PricingRule[]
  readonly timeZone: string
  readonly tier: CustomerTier
}

/**
 * Turns client-requested windows into priced segments. This is the only place
 * a price is attached to a booking request — the client never supplies one.
 */
export function quoteSelections(input: QuoteSelectionsInput): CourtSelection[] {
  const courtsById = new Map(input.courts.map((court) => [court.id, court]))

  return input.selections.map((selection) => {
    const court = courtsById.get(selection.courtId)

    if (!court) {
      throw new Error(`Unknown court: ${selection.courtId}`)
    }

    const quote = quoteCourtSegment({
      basePriceCents: court.basePriceCents,
      courtId: selection.courtId,
      startsAt: selection.startsAt,
      durationMinutes: durationMinutes(selection),
      timeZone: input.timeZone,
      tier: input.tier,
      rules: input.rules.filter((rule) => rule.courtId === null || rule.courtId === court.id),
    })

    return {
      courtId: selection.courtId,
      startsAt: selection.startsAt,
      endsAt: selection.endsAt,
      priceCents: quote.totalCents,
    }
  })
}

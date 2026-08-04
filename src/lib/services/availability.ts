import { findOpenStartTimes, mergeBusyRanges } from '@/lib/domain/availability'
import { quoteCourtSegment } from '@/lib/domain/pricing'
import { addMinutes, enumerateStartTimes } from '@/lib/domain/time'
import type { CustomerTier, PricingRule, TimeRange } from '@/lib/domain/types'
import type { Club } from '@/lib/repositories/mappers'

export type AvailabilityCourt = {
  readonly id: string
  readonly name: string
  readonly basePriceCents: number
}

export type AvailabilitySlot = {
  readonly startsAt: Date
  readonly endsAt: Date
  readonly priceCents: number
  readonly isAvailable: boolean
}

export type CourtAvailability = {
  readonly courtId: string
  readonly courtName: string
  readonly slots: readonly AvailabilitySlot[]
  readonly openCount: number
}

export type BuildCourtAvailabilityInput = {
  readonly club: Club
  readonly courts: readonly AvailabilityCourt[]
  /** Bookings and maintenance blocks, already grouped by court id. */
  readonly busyByCourt: Readonly<Record<string, readonly TimeRange[]>>
  /** Club-local calendar day, "YYYY-MM-DD". */
  readonly day: string
  readonly durationMinutes: number
  readonly rules: readonly PricingRule[]
  readonly tier: CustomerTier
}

/**
 * The read model behind the booking calendar: for each court, every start time
 * on `day`, priced, and flagged available or not.
 *
 * Unavailable slots are returned rather than filtered out — the design shows
 * taken times greyed with their rate, not hidden.
 */
export function buildCourtAvailability(
  input: BuildCourtAvailabilityInput,
): readonly CourtAvailability[] {
  const candidates = enumerateStartTimes({
    day: input.day,
    timeZone: input.club.timeZone,
    opensAt: input.club.opensAt,
    closesAt: input.club.closesAt,
    slotMinutes: input.club.slotMinutes,
    durationMinutes: input.durationMinutes,
  })

  return input.courts.map((court) => {
    const busy = mergeBusyRanges(input.busyByCourt[court.id] ?? [])
    const openStarts = new Set(
      findOpenStartTimes({
        candidates,
        durationMinutes: input.durationMinutes,
        busy,
      }).map((start) => start.getTime()),
    )

    const courtRules = input.rules.filter(
      (rule) => rule.courtId === null || rule.courtId === court.id,
    )

    const slots = candidates.map((startsAt) => ({
      startsAt,
      endsAt: addMinutes(startsAt, input.durationMinutes),
      priceCents: quoteCourtSegment({
        basePriceCents: court.basePriceCents,
        courtId: court.id,
        startsAt,
        durationMinutes: input.durationMinutes,
        timeZone: input.club.timeZone,
        tier: input.tier,
        rules: courtRules,
      }).totalCents,
      isAvailable: openStarts.has(startsAt.getTime()),
    }))

    return {
      courtId: court.id,
      courtName: court.name,
      slots,
      openCount: slots.filter((slot) => slot.isAvailable).length,
    }
  })
}

import 'server-only'

import { findOpenStartTimes, mergeBusyRanges } from '@/lib/domain/availability'
import { enumerateStartTimes, zonedTimeToUtc } from '@/lib/domain/time'
import { findBusyRangesByCourt } from '@/lib/repositories/availability'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { Club } from '@/lib/repositories/mappers'

/**
 * How many start times are still free on a day, per court.
 *
 * Split out from getAvailability because the catalog needs only the count. The
 * full read model prices every slot on every court, and re-reads the club, the
 * court list, and the pricing rules the catalog page already holds — work the
 * storefront would otherwise pay for on every render to display one number.
 *
 * Reads with the service-role client for the same reason getAvailability does:
 * availability must reflect every booking, including the ones RLS hides from
 * anon. Nothing customer-identifying leaves this function — only counts.
 */

const DAY_MS = 24 * 60 * 60 * 1000

export type CountOpenSlotsInput = {
  readonly club: Club
  readonly courtIds: readonly string[]
  /** Club-local calendar day, "YYYY-MM-DD". */
  readonly day: string
}

/** Open start times keyed by court id. */
export type OpenSlotCounts = Readonly<Record<string, number>>

/**
 * Returns undefined when the read fails. The catalog still renders, just
 * without the counts — a wrong "fully booked" would cost a booking, so an
 * unknown count is left unsaid rather than guessed.
 */
export async function countOpenSlots({
  club,
  courtIds,
  day,
}: CountOpenSlotsInput): Promise<OpenSlotCounts | undefined> {
  if (courtIds.length === 0) {
    return {}
  }

  // Counted at the club's shortest bookable session, which is the most
  // openings a court can offer.
  const durationMinutes = club.minDurationMinutes

  try {
    // The busy window is the club-local calendar day, not a UTC day — in
    // Asia/Manila those differ by eight hours.
    const from = zonedTimeToUtc(day, 0, club.timeZone)
    const to = new Date(from.getTime() + DAY_MS)

    const busyByCourt = await findBusyRangesByCourt(createSupabaseAdminClient(), {
      courtIds: [...courtIds],
      from,
      to,
    })

    const candidates = enumerateStartTimes({
      day,
      timeZone: club.timeZone,
      opensAt: club.opensAt,
      closesAt: club.closesAt,
      slotMinutes: club.slotMinutes,
      durationMinutes,
    })

    return Object.fromEntries(
      courtIds.map((courtId) => [
        courtId,
        findOpenStartTimes({
          candidates,
          durationMinutes,
          busy: mergeBusyRanges(busyByCourt[courtId] ?? []),
        }).length,
      ]),
    )
  } catch {
    return undefined
  }
}

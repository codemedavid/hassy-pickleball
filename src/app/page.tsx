import { notFound } from 'next/navigation'
import { getAvailability } from '@/features/booking/server/availability'
import { CourtsBrowse } from '@/features/courts/courts-browse'
import { parseCourtLayout } from '@/features/courts/court-layout'
import { toDayStringInZone } from '@/lib/format/time'
import { findClubBySlug } from '@/lib/repositories/clubs'
import { listActiveCourts } from '@/lib/repositories/courts'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Club } from '@/lib/repositories/mappers'

/** Single-club deployment for now; the schema is multi-club ready. */
const CLUB_SLUG = 'baseline'

type HomePageProps = {
  searchParams: Promise<{ filter?: string; layout?: string }>
}

/**
 * How many start times are still free today, per court.
 *
 * Counted at the club's shortest bookable session, which is the most openings
 * a court can offer. Availability is a privileged read that can fail on its
 * own; when it does the catalog still renders, just without the counts — a
 * wrong "fully booked" would cost a booking.
 */
async function countOpenSlotsToday(club: Club): Promise<Record<string, number> | undefined> {
  const availability = await getAvailability({
    clubId: club.id,
    day: toDayStringInZone(new Date(), club.timeZone),
    durationMinutes: club.minDurationMinutes,
  })

  if (!availability.success) {
    return undefined
  }

  return Object.fromEntries(availability.data.map((court) => [court.courtId, court.openCount]))
}

/**
 * The storefront, served at the root so the catalog is the first thing a
 * visitor sees. Courts are public catalog data, readable under the
 * `courts_public_read` policy with the anon key, so this stays a Server
 * Component with no client fetch.
 */
export default async function HomePage({ searchParams }: HomePageProps) {
  const { filter, layout } = await searchParams
  const client = await createSupabaseServerClient()

  const club = await findClubBySlug(client, CLUB_SLUG)

  if (!club) {
    notFound()
  }

  const [courts, openSlotsByCourt] = await Promise.all([
    listActiveCourts(client, club.id),
    countOpenSlotsToday(club),
  ])

  return (
    <CourtsBrowse
      club={club}
      courts={courts}
      filter={filter}
      layout={parseCourtLayout(layout)}
      openSlotsByCourt={openSlotsByCourt}
    />
  )
}

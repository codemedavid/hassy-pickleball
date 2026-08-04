import type { Court } from '@/lib/repositories/mappers'

/**
 * The filter chips above the courts grid, matching the design's filter row.
 * Pure so the page, the client island, and the tests all agree on what a
 * filter means.
 */
export type CourtFilter = {
  readonly id: string
  readonly label: string
  readonly matches: (court: Court) => boolean
}

export const COURT_FILTERS: readonly CourtFilter[] = [
  { id: 'all', label: 'All courts', matches: () => true },
  { id: 'indoor', label: 'Indoor', matches: (court) => court.environment === 'indoor' },
  { id: 'outdoor', label: 'Outdoor', matches: (court) => court.environment === 'outdoor' },
  { id: 'tournament', label: 'Tournament grade', matches: (court) => court.isTournamentGrade },
]

export function isCourtFilterId(value: string): boolean {
  return COURT_FILTERS.some((filter) => filter.id === value)
}

/**
 * An unrecognised id shows everything rather than an empty page — a stale
 * bookmark or hand-edited query should degrade to the full list.
 */
export function filterCourts(courts: readonly Court[], filterId: string): Court[] {
  const filter = COURT_FILTERS.find((candidate) => candidate.id === filterId)

  if (!filter) {
    return [...courts]
  }

  return courts.filter(filter.matches)
}

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
 * The filter id to use for a raw search param.
 *
 * Called once at the page boundary so the value echoed back into every link on
 * the page is one we recognise, rather than whatever the URL happened to carry.
 */
export function parseCourtFilter(value: string | undefined): string {
  return value !== undefined && isCourtFilterId(value) ? value : 'all'
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

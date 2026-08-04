import { addMinutes, rangesOverlap } from './time'
import type { TimeRange } from './types'

/** True when `range` conflicts with none of the busy intervals. */
export function isRangeFree(range: TimeRange, busy: readonly TimeRange[]): boolean {
  return !busy.some((occupied) => rangesOverlap(range, occupied))
}

/**
 * Collapses bookings and blocks into a minimal sorted set of busy intervals.
 * Adjacent intervals are merged, which keeps the overlap scan cheap.
 */
export function mergeBusyRanges(busy: readonly TimeRange[]): TimeRange[] {
  if (busy.length === 0) {
    return []
  }

  const sorted = [...busy].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())

  return sorted.reduce<TimeRange[]>((merged, current) => {
    const previous = merged.at(-1)

    if (previous && current.startsAt <= previous.endsAt) {
      const endsAt = current.endsAt > previous.endsAt ? current.endsAt : previous.endsAt
      return [...merged.slice(0, -1), { startsAt: previous.startsAt, endsAt }]
    }

    return [...merged, current]
  }, [])
}

export type FindOpenStartTimesInput = {
  readonly candidates: readonly Date[]
  readonly durationMinutes: number
  readonly busy: readonly TimeRange[]
}

/** Filters candidate start times down to those whose full session is free. */
export function findOpenStartTimes(input: FindOpenStartTimesInput): Date[] {
  if (input.durationMinutes <= 0) {
    throw new Error('durationMinutes must be greater than 0')
  }

  const busy = mergeBusyRanges(input.busy)

  return input.candidates.filter((startsAt) =>
    isRangeFree({ startsAt, endsAt: addMinutes(startsAt, input.durationMinutes) }, busy),
  )
}

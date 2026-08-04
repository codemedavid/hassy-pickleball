import { describe, expect, it } from 'vitest'
import { findOpenStartTimes, isRangeFree, mergeBusyRanges } from './availability'
import type { TimeRange } from './types'

function range(startIso: string, endIso: string): TimeRange {
  return { startsAt: new Date(startIso), endsAt: new Date(endIso) }
}

describe('isRangeFree', () => {
  const busy = [range('2026-03-16T02:00:00Z', '2026-03-16T03:00:00Z')]

  it('returns true when nothing conflicts', () => {
    expect(isRangeFree(range('2026-03-16T04:00:00Z', '2026-03-16T05:00:00Z'), busy)).toBe(true)
  })

  it('returns false when the range overlaps a busy interval', () => {
    expect(isRangeFree(range('2026-03-16T02:30:00Z', '2026-03-16T03:30:00Z'), busy)).toBe(false)
  })

  it('returns true when the range starts exactly as a busy interval ends', () => {
    expect(isRangeFree(range('2026-03-16T03:00:00Z', '2026-03-16T04:00:00Z'), busy)).toBe(true)
  })

  it('returns true against an empty busy list', () => {
    expect(isRangeFree(range('2026-03-16T02:00:00Z', '2026-03-16T03:00:00Z'), [])).toBe(true)
  })
})

describe('mergeBusyRanges', () => {
  it('merges overlapping and adjacent intervals into one', () => {
    const merged = mergeBusyRanges([
      range('2026-03-16T04:00:00Z', '2026-03-16T05:00:00Z'),
      range('2026-03-16T02:00:00Z', '2026-03-16T03:00:00Z'),
      range('2026-03-16T02:30:00Z', '2026-03-16T04:00:00Z'),
    ])

    expect(merged).toHaveLength(1)
    expect(merged[0].startsAt.toISOString()).toBe('2026-03-16T02:00:00.000Z')
    expect(merged[0].endsAt.toISOString()).toBe('2026-03-16T05:00:00.000Z')
  })

  it('keeps disjoint intervals separate and sorted', () => {
    const merged = mergeBusyRanges([
      range('2026-03-16T06:00:00Z', '2026-03-16T07:00:00Z'),
      range('2026-03-16T02:00:00Z', '2026-03-16T03:00:00Z'),
    ])

    expect(merged.map((r) => r.startsAt.toISOString())).toEqual([
      '2026-03-16T02:00:00.000Z',
      '2026-03-16T06:00:00.000Z',
    ])
  })

  it('does not mutate the input array', () => {
    const input = [
      range('2026-03-16T06:00:00Z', '2026-03-16T07:00:00Z'),
      range('2026-03-16T02:00:00Z', '2026-03-16T03:00:00Z'),
    ]

    mergeBusyRanges(input)

    expect(input[0].startsAt.toISOString()).toBe('2026-03-16T06:00:00.000Z')
  })

  it('returns an empty array for no input', () => {
    expect(mergeBusyRanges([])).toEqual([])
  })
})

describe('findOpenStartTimes', () => {
  const candidates = [
    new Date('2026-03-16T02:00:00Z'),
    new Date('2026-03-16T02:30:00Z'),
    new Date('2026-03-16T03:00:00Z'),
  ]

  it('drops candidates whose session would overlap a booking', () => {
    // Busy 03:00-04:00. Only the 02:00 start finishes before it begins;
    // 02:30 and 03:00 both run into the booking.
    const open = findOpenStartTimes({
      candidates,
      durationMinutes: 60,
      busy: [range('2026-03-16T03:00:00Z', '2026-03-16T04:00:00Z')],
    })

    expect(open.map((d) => d.toISOString())).toEqual(['2026-03-16T02:00:00.000Z'])
  })

  it('keeps every candidate when the court is free all day', () => {
    expect(findOpenStartTimes({ candidates, durationMinutes: 60, busy: [] })).toHaveLength(3)
  })

  it('returns an empty list when every candidate conflicts', () => {
    const open = findOpenStartTimes({
      candidates,
      durationMinutes: 60,
      busy: [range('2026-03-16T00:00:00Z', '2026-03-16T12:00:00Z')],
    })

    expect(open).toEqual([])
  })

  it('rejects a non-positive duration', () => {
    expect(() => findOpenStartTimes({ candidates, durationMinutes: 0, busy: [] })).toThrow(
      /durationMinutes/i,
    )
  })
})

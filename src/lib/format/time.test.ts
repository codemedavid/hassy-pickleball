import { describe, expect, it } from 'vitest'
import { formatDayInZone, formatTimeInZone, parseDayString, toDayStringInZone } from './time'

const MANILA = 'Asia/Manila'

describe('formatTimeInZone', () => {
  it("renders the club-local clock time, not the viewer's", () => {
    // 22:00 UTC is 06:00 the next day in Manila.
    expect(formatTimeInZone(new Date('2026-03-15T22:00:00Z'), MANILA)).toBe('6:00 AM')
  })

  it('renders afternoon times with PM', () => {
    expect(formatTimeInZone(new Date('2026-03-16T08:30:00Z'), MANILA)).toBe('4:30 PM')
  })

  it('renders midnight as 12:00 AM rather than 0:00', () => {
    expect(formatTimeInZone(new Date('2026-03-15T16:00:00Z'), MANILA)).toBe('12:00 AM')
  })

  it('renders noon as 12:00 PM', () => {
    expect(formatTimeInZone(new Date('2026-03-16T04:00:00Z'), MANILA)).toBe('12:00 PM')
  })

  it('reflects the zone it is given, not a fixed offset', () => {
    const instant = new Date('2026-03-16T00:00:00Z')

    expect(formatTimeInZone(instant, 'UTC')).toBe('12:00 AM')
    expect(formatTimeInZone(instant, MANILA)).toBe('8:00 AM')
  })
})

describe('formatDayInZone', () => {
  it('renders a readable club-local date', () => {
    expect(formatDayInZone(new Date('2026-03-15T22:00:00Z'), MANILA)).toBe('Mon, 16 Mar 2026')
  })

  it('uses the club day, which can differ from the UTC day', () => {
    // Still 15 March in UTC, already 16 March in Manila.
    expect(formatDayInZone(new Date('2026-03-15T20:00:00Z'), MANILA)).toContain('16 Mar')
  })
})

describe('toDayStringInZone', () => {
  it('returns the club-local calendar day as YYYY-MM-DD', () => {
    expect(toDayStringInZone(new Date('2026-03-15T22:00:00Z'), MANILA)).toBe('2026-03-16')
  })

  it('zero-pads single-digit months and days', () => {
    expect(toDayStringInZone(new Date('2026-01-04T02:00:00Z'), MANILA)).toBe('2026-01-04')
  })

  it('matches the format enumerateStartTimes expects', () => {
    expect(toDayStringInZone(new Date('2026-03-16T02:00:00Z'), MANILA)).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    )
  })
})

describe('parseDayString', () => {
  it('keeps a well-formed day', () => {
    expect(parseDayString('2026-03-01', '2026-01-01')).toBe('2026-03-01')
  })

  it('falls back when the day is missing', () => {
    expect(parseDayString(undefined, '2026-01-01')).toBe('2026-01-01')
  })

  // An unvalidated day reaches `new Date()` and renders "Invalid Date" in the
  // page heading while the slot grid separately reports the error.
  it('falls back for a malformed day rather than producing an invalid date', () => {
    expect(parseDayString('not-a-day', '2026-01-01')).toBe('2026-01-01')
  })

  it('falls back for a shape that matches but is not a real date', () => {
    expect(parseDayString('2026-13-45', '2026-01-01')).toBe('2026-01-01')
  })

  it('falls back for a day carrying extra path or query characters', () => {
    expect(parseDayString('2026-03-01?x=1', '2026-01-01')).toBe('2026-01-01')
  })
})

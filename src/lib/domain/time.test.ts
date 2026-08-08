import { describe, expect, it } from 'vitest'
import {
  addMinutes,
  durationMinutes,
  enumerateStartTimes,
  getZonedParts,
  parseClockTime,
  rangesOverlap,
  shiftDayString,
} from './time'

const MANILA = 'Asia/Manila'

describe('addMinutes', () => {
  it('returns a new Date without mutating the input', () => {
    // Arrange
    const original = new Date('2026-03-14T08:00:00Z')

    // Act
    const result = addMinutes(original, 90)

    // Assert
    expect(result.toISOString()).toBe('2026-03-14T09:30:00.000Z')
    expect(original.toISOString()).toBe('2026-03-14T08:00:00.000Z')
  })

  it('moves backwards for negative minutes', () => {
    expect(addMinutes(new Date('2026-03-14T08:00:00Z'), -30).toISOString()).toBe(
      '2026-03-14T07:30:00.000Z',
    )
  })
})

describe('durationMinutes', () => {
  it('returns the length of the range in minutes', () => {
    const range = {
      startsAt: new Date('2026-03-14T08:00:00Z'),
      endsAt: new Date('2026-03-14T09:30:00Z'),
    }

    expect(durationMinutes(range)).toBe(90)
  })

  it('returns 0 for a zero-length range', () => {
    const instant = new Date('2026-03-14T08:00:00Z')

    expect(durationMinutes({ startsAt: instant, endsAt: instant })).toBe(0)
  })
})

describe('rangesOverlap', () => {
  const base = {
    startsAt: new Date('2026-03-14T08:00:00Z'),
    endsAt: new Date('2026-03-14T10:00:00Z'),
  }

  it('detects a partial overlap', () => {
    const other = {
      startsAt: new Date('2026-03-14T09:00:00Z'),
      endsAt: new Date('2026-03-14T11:00:00Z'),
    }

    expect(rangesOverlap(base, other)).toBe(true)
  })

  it('treats ranges as half-open so touching ranges do not overlap', () => {
    const other = {
      startsAt: new Date('2026-03-14T10:00:00Z'),
      endsAt: new Date('2026-03-14T11:00:00Z'),
    }

    expect(rangesOverlap(base, other)).toBe(false)
  })

  it('detects full containment in both directions', () => {
    const inner = {
      startsAt: new Date('2026-03-14T08:30:00Z'),
      endsAt: new Date('2026-03-14T09:00:00Z'),
    }

    expect(rangesOverlap(base, inner)).toBe(true)
    expect(rangesOverlap(inner, base)).toBe(true)
  })

  it('returns false for disjoint ranges', () => {
    const other = {
      startsAt: new Date('2026-03-14T11:00:00Z'),
      endsAt: new Date('2026-03-14T12:00:00Z'),
    }

    expect(rangesOverlap(base, other)).toBe(false)
  })
})

describe('parseClockTime', () => {
  it('converts "HH:MM" to minutes since midnight', () => {
    expect(parseClockTime('06:00')).toBe(360)
    expect(parseClockTime('16:30')).toBe(990)
    expect(parseClockTime('00:00')).toBe(0)
  })

  it('accepts the "HH:MM:SS" form Postgres returns for a time column', () => {
    expect(parseClockTime('16:30:00')).toBe(990)
  })

  it('throws on malformed input rather than returning NaN', () => {
    expect(() => parseClockTime('not-a-time')).toThrow(/invalid clock time/i)
    expect(() => parseClockTime('25:00')).toThrow(/invalid clock time/i)
    expect(() => parseClockTime('12:60')).toThrow(/invalid clock time/i)
  })
})

describe('getZonedParts', () => {
  it('reports the club-local day of week and minute of day', () => {
    // 2026-03-14T22:30Z is 2026-03-15 06:30 in Manila (UTC+8) — a Sunday.
    const parts = getZonedParts(new Date('2026-03-14T22:30:00Z'), MANILA)

    expect(parts.dayOfWeek).toBe(0)
    expect(parts.minutesOfDay).toBe(390)
  })

  it('uses Sunday = 0 to match the Postgres dow convention', () => {
    // 2026-03-16T02:00Z is Monday 10:00 in Manila.
    expect(getZonedParts(new Date('2026-03-16T02:00:00Z'), MANILA).dayOfWeek).toBe(1)
  })

  it('respects daylight saving in zones that observe it', () => {
    // New York leaves EST (UTC-5) for EDT (UTC-4) at 2026-03-08T07:00Z.
    const beforeDst = getZonedParts(new Date('2026-03-08T06:00:00Z'), 'America/New_York')
    const afterDst = getZonedParts(new Date('2026-03-08T08:00:00Z'), 'America/New_York')

    expect(beforeDst.minutesOfDay).toBe(60)
    expect(afterDst.minutesOfDay).toBe(240)
  })
})

describe('enumerateStartTimes', () => {
  it('lists every start that fits the duration before closing', () => {
    // 06:00–08:00 local, 30-minute grid, 60-minute sessions -> 06:00, 06:30, 07:00
    const starts = enumerateStartTimes({
      day: '2026-03-16',
      timeZone: MANILA,
      opensAt: '06:00',
      closesAt: '08:00',
      slotMinutes: 30,
      durationMinutes: 60,
    })

    expect(starts.map((d) => d.toISOString())).toEqual([
      '2026-03-15T22:00:00.000Z',
      '2026-03-15T22:30:00.000Z',
      '2026-03-15T23:00:00.000Z',
    ])
  })

  it('returns an empty list when the duration exceeds the opening window', () => {
    const starts = enumerateStartTimes({
      day: '2026-03-16',
      timeZone: MANILA,
      opensAt: '06:00',
      closesAt: '08:00',
      slotMinutes: 30,
      durationMinutes: 180,
    })

    expect(starts).toEqual([])
  })

  it('includes the last start that ends exactly at closing', () => {
    const starts = enumerateStartTimes({
      day: '2026-03-16',
      timeZone: MANILA,
      opensAt: '06:00',
      closesAt: '07:00',
      slotMinutes: 30,
      durationMinutes: 60,
    })

    expect(starts).toHaveLength(1)
    expect(starts[0].toISOString()).toBe('2026-03-15T22:00:00.000Z')
  })

  it('rejects a non-positive slot size instead of looping forever', () => {
    expect(() =>
      enumerateStartTimes({
        day: '2026-03-16',
        timeZone: MANILA,
        opensAt: '06:00',
        closesAt: '08:00',
        slotMinutes: 0,
        durationMinutes: 60,
      }),
    ).toThrow(/slotMinutes/i)
  })
})

describe('shiftDayString', () => {
  it('steps forward to the next calendar day', () => {
    // Act & Assert
    expect(shiftDayString('2026-08-04', 1)).toBe('2026-08-05')
  })

  it('steps back across a month boundary', () => {
    // Act & Assert
    expect(shiftDayString('2026-08-01', -1)).toBe('2026-07-31')
  })

  it('rolls over a year end', () => {
    // Act & Assert
    expect(shiftDayString('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('handles a leap day rather than skipping it', () => {
    // Act & Assert
    expect(shiftDayString('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('returns the same day when nothing is shifted', () => {
    // Act & Assert
    expect(shiftDayString('2026-08-04', 0)).toBe('2026-08-04')
  })

  it('rejects a day it cannot parse instead of returning "NaN-NaN-NaN"', () => {
    // Act & Assert
    expect(() => shiftDayString('04/08/2026', 1)).toThrow(/day/i)
  })
})

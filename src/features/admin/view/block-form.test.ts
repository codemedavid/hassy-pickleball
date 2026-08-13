import { describe, expect, it } from 'vitest'
import { blankBlockForm, blockFormError, toBlockPayload } from './block-form'
import { at, club, DAY } from '../../../../test/admin-fixtures'

/**
 * The block form is the only place a staff member turns club-local wall-clock
 * times into the UTC instants the database holds, so the conversion is tested
 * here rather than through the DOM.
 */

const harbor = 'court-1'

function form(overrides: Partial<ReturnType<typeof blankBlockForm>> = {}) {
  return { ...blankBlockForm({ courtId: harbor, opensAt: club.opensAt, day: DAY }), ...overrides }
}

describe('blankBlockForm', () => {
  it('opens on the club’s first bookable hour so the common case needs no typing', () => {
    // Act
    const state = blankBlockForm({ courtId: harbor, opensAt: club.opensAt, day: DAY })

    // Assert
    expect(state.day).toBe(DAY)
    expect(state.startTime).toBe('07:00')
    expect(state.endTime).toBe('08:00')
  })

  it('defaults to maintenance, the reason most court time is held', () => {
    // Act
    const state = blankBlockForm({ courtId: harbor, opensAt: club.opensAt, day: DAY })

    // Assert
    expect(state.kind).toBe('maintenance')
    expect(state.courtId).toBe(harbor)
    expect(state.reason).toBe('')
  })
})

describe('blockFormError', () => {
  it('accepts a well-formed block', () => {
    // Act & Assert
    expect(blockFormError(form())).toBeNull()
  })

  it('asks for a court when none is chosen', () => {
    // Act
    const error = blockFormError(form({ courtId: '' }))

    // Assert
    expect(error).toMatch(/court/i)
  })

  it('asks for the unavailable date when it is missing', () => {
    // Act
    const error = blockFormError(form({ day: '' }))

    // Assert
    expect(error).toMatch(/date/i)
  })

  it('asks for both times when one is missing', () => {
    // Act
    const error = blockFormError(form({ endTime: '' }))

    // Assert
    expect(error).toMatch(/time/i)
  })

  it('rejects a block that ends before it starts', () => {
    // Act
    const error = blockFormError(form({ startTime: '14:00', endTime: '12:00' }))

    // Assert
    expect(error).toMatch(/end after it starts/i)
  })

  it('rejects a zero-length block, which would hold nothing', () => {
    // Act
    const error = blockFormError(form({ startTime: '14:00', endTime: '14:00' }))

    // Assert
    expect(error).toMatch(/end after it starts/i)
  })
})

describe('toBlockPayload', () => {
  it('uses the unavailable date selected in the form', () => {
    // Arrange
    const state = form({ day: '2026-08-09', startTime: '09:00', endTime: '10:30' })

    // Act
    const payload = toBlockPayload(state, { timeZone: club.timeZone })

    // Assert
    expect(payload.startsAt.toISOString()).toBe(at('09:00', '2026-08-09').toISOString())
    expect(payload.endsAt.toISOString()).toBe(at('10:30', '2026-08-09').toISOString())
  })

  it('reads the typed times through the club’s timezone, not the browser’s', () => {
    // Arrange
    const state = form({ startTime: '09:00', endTime: '10:30' })

    // Act
    const payload = toBlockPayload(state, { timeZone: club.timeZone })

    // Assert
    expect(payload.startsAt.toISOString()).toBe(at('09:00').toISOString())
    expect(payload.endsAt.toISOString()).toBe(at('10:30').toISOString())
  })

  it('carries the court and the kind through untouched', () => {
    // Arrange
    const state = form({ kind: 'league' })

    // Act
    const payload = toBlockPayload(state, { timeZone: club.timeZone })

    // Assert
    expect(payload.courtId).toBe(harbor)
    expect(payload.kind).toBe('league')
  })

  it('sends a blank reason as null rather than an empty string', () => {
    // Arrange
    const state = form({ reason: '   ' })

    // Act
    const payload = toBlockPayload(state, { timeZone: club.timeZone })

    // Assert
    expect(payload.reason).toBeNull()
  })

  it('trims a reason the staff member typed with stray spacing', () => {
    // Arrange
    const state = form({ reason: '  Net repair ' })

    // Act
    const payload = toBlockPayload(state, { timeZone: club.timeZone })

    // Assert
    expect(payload.reason).toBe('Net repair')
  })
})

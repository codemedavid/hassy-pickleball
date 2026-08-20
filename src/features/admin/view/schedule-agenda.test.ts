import { describe, expect, it } from 'vitest'
import { buildScheduleAgenda, SCHEDULE_TONE_LABELS } from './schedule-agenda'
import { buildScheduleGrid } from './schedule'
import { club, DAY, makeBlock, makeBooking, makeCourt } from '../../../../test/admin-fixtures'

/**
 * The day read as a list rather than as a grid.
 *
 * A grid of court columns needs horizontal room the club's phone does not
 * have, so the same day is offered court by court, in the order the day runs.
 */

const harbor = makeCourt({ id: 'court-1', name: 'Harbor Court' })
const maple = makeCourt({ id: 'court-2', name: 'Maple Court', environment: 'outdoor' })

const bookings = [
  makeBooking({
    contactName: 'Maya Halvorsen',
    segments: [{ courtId: harbor.id, from: '17:00', to: '18:30' }],
  }),
]

const blocks = [
  makeBlock({
    id: 'block-7',
    courtId: harbor.id,
    kind: 'maintenance',
    reason: 'Net repair',
    from: '09:00',
    to: '10:00',
  }),
]

function agenda(courts = [harbor, maple]) {
  return buildScheduleAgenda(buildScheduleGrid({ club, courts, bookings, blocks, day: DAY }))
}

describe('buildScheduleAgenda', () => {
  it('gives each court a section headed by its name, rate, and free time', () => {
    // Act
    const [first] = agenda()

    // Assert
    expect(first.courtId).toBe('court-1')
    expect(first.courtName).toBe('Harbor Court')
    expect(first.meta).toBe('Indoor · ₱600/hr')
    expect(first.openLabel).toBe('12.5 hrs open')
  })

  it('lists a court’s entries in the order the day runs', () => {
    // Act
    const [harborSection] = agenda()

    // Assert — the 9am hold comes before the 5pm booking.
    expect(harborSection.entries.map((entry) => entry.title)).toEqual([
      'Net repair',
      'Maya Halvorsen',
    ])
  })

  it('carries the time range each entry covers', () => {
    // Act
    const [harborSection] = agenda()

    // Assert
    expect(harborSection.entries[1].detail).toBe('5:00 PM – 6:30 PM')
  })

  /**
   * The grid could lean on colour because the legend sat under it. A list has
   * no legend in view, so every entry says what it is.
   */
  it('names the tone in words, so nothing is carried by colour alone', () => {
    // Act
    const [harborSection] = agenda()

    // Assert
    expect(harborSection.entries[0].toneLabel).toBe(SCHEDULE_TONE_LABELS.blocked)
    expect(harborSection.entries[1].toneLabel).toBe(SCHEDULE_TONE_LABELS.confirmed)
  })

  it('counts the bookings and the staff holds separately', () => {
    // Act
    const [harborSection] = agenda()

    // Assert — one of each, and a hold is not a booking.
    expect(harborSection.summary).toBe('1 booking · 1 hold')
  })

  it('says a court is free rather than heading an empty section', () => {
    // Act
    const [, mapleSection] = agenda()

    // Assert
    expect(mapleSection.entries).toEqual([])
    expect(mapleSection.summary).toBe('Nothing booked')
  })

  it('pluralises the count rather than printing "1 bookings"', () => {
    // Arrange
    const two = [
      ...bookings,
      makeBooking({
        contactName: 'Jun Park',
        segments: [{ courtId: maple.id, from: '11:00', to: '13:00' }],
      }),
      makeBooking({
        contactName: 'Ana Cruz',
        segments: [{ courtId: maple.id, from: '14:00', to: '15:00' }],
      }),
    ]

    // Act
    const sections = buildScheduleAgenda(
      buildScheduleGrid({ club, courts: [maple], bookings: two, blocks: [], day: DAY }),
    )

    // Assert
    expect(sections[0].summary).toBe('2 bookings')
  })

  it('keeps the release handle on a staff hold and withholds it from a booking', () => {
    // Act
    const [harborSection] = agenda()

    // Assert — a booking is cancelled through its own screen, not released.
    expect(harborSection.entries[0].blockId).toBe('block-7')
    expect(harborSection.entries[1].blockId).toBeNull()
  })

  it('has nothing to show when the club has no active courts', () => {
    // Act
    const sections = buildScheduleAgenda(
      buildScheduleGrid({ club, courts: [], bookings: [], blocks: [], day: DAY }),
    )

    // Assert
    expect(sections).toEqual([])
  })
})

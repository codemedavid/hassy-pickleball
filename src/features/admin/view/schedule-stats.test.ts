import { describe, expect, it } from 'vitest'
import { buildScheduleStats } from './schedule-stats'
import { club, DAY, makeBooking, makeCourt } from '../../../../test/admin-fixtures'

const harbor = makeCourt({ id: 'court-1', name: 'Harbor Court' })
const maple = makeCourt({ id: 'court-2', name: 'Maple Court' })

function statFor(label: string, stats: ReturnType<typeof buildScheduleStats>) {
  const stat = stats.find((candidate) => candidate.label === label)

  if (!stat) {
    throw new Error(`No stat card labelled "${label}"`)
  }

  return stat
}

describe('buildScheduleStats', () => {
  it('counts the day’s live bookings, ignoring cancellations', () => {
    // Arrange
    const bookings = [
      makeBooking({ id: 'b1', segments: [{ courtId: harbor.id, from: '08:00', to: '09:00' }] }),
      makeBooking({ id: 'b2', segments: [{ courtId: harbor.id, from: '09:00', to: '10:00' }] }),
      makeBooking({
        id: 'b3',
        status: 'cancelled',
        segments: [{ courtId: harbor.id, from: '10:00', to: '11:00' }],
      }),
    ]

    // Act
    const stats = buildScheduleStats({ club, courts: [harbor], bookings, day: DAY })

    // Assert
    expect(statFor('Today', stats).value).toBe('2 bookings')
  })

  it('reads utilization as booked court time over the whole day’s capacity', () => {
    // Arrange — 90 booked minutes against two courts × 900 open minutes.
    const bookings = [
      makeBooking({ segments: [{ courtId: harbor.id, from: '08:00', to: '09:30' }] }),
    ]

    // Act
    const stats = buildScheduleStats({ club, courts: [harbor, maple], bookings, day: DAY })

    // Assert — 90 / 1800 = 5%.
    expect(statFor('Utilization', stats).value).toBe('5%')
  })

  it('reports zero utilization rather than dividing by no courts', () => {
    // Arrange — a club with no active courts is a real state during setup.
    // Act
    const stats = buildScheduleStats({ club, courts: [], bookings: [], day: DAY })

    // Assert
    expect(statFor('Utilization', stats).value).toBe('0%')
  })

  it('counts how many bookings are still waiting on payment', () => {
    // Arrange
    const bookings = [
      makeBooking({
        id: 'b1',
        status: 'awaiting_payment',
        segments: [{ courtId: harbor.id, from: '08:00', to: '09:00' }],
      }),
      makeBooking({
        id: 'b2',
        status: 'pending',
        segments: [{ courtId: harbor.id, from: '09:00', to: '10:00' }],
      }),
      makeBooking({
        id: 'b3',
        status: 'confirmed',
        segments: [{ courtId: harbor.id, from: '10:00', to: '11:00' }],
      }),
    ]

    // Act
    const stats = buildScheduleStats({ club, courts: [harbor], bookings, day: DAY })

    // Assert — pending and awaiting_payment both still owe money.
    expect(statFor('Awaiting payment', stats).value).toBe('2')
  })

  it('totals the day’s revenue and calls out the share coming from add-ons', () => {
    // Arrange
    const bookings = [
      makeBooking({
        id: 'b1',
        segments: [{ courtId: harbor.id, from: '08:00', to: '09:00', priceCents: 60_000 }],
        items: [{ name: 'Flat white', unitPriceCents: 15_000, quantity: 2 }],
      }),
      makeBooking({
        id: 'b2',
        status: 'cancelled',
        segments: [{ courtId: harbor.id, from: '09:00', to: '10:00', priceCents: 99_900 }],
      }),
    ]

    // Act
    const stats = buildScheduleStats({ club, courts: [harbor], bookings, day: DAY })
    const revenue = statFor('Revenue today', stats)

    // Assert — the cancelled booking earns nothing.
    expect(revenue.value).toBe('₱900')
    expect(revenue.detail).toBe('₱300 from add-ons')
  })

  it('always returns the four cards the design lays out', () => {
    // Act
    const stats = buildScheduleStats({ club, courts: [harbor], bookings: [], day: DAY })

    // Assert
    expect(stats.map((stat) => stat.label)).toEqual([
      'Today',
      'Utilization',
      'Awaiting payment',
      'Revenue today',
    ])
  })
})

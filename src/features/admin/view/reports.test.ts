import { describe, expect, it } from 'vitest'
import { buildReports } from './reports'
import { club, DAY, makeBooking, makeCourt } from '../../../../test/admin-fixtures'

const harbor = makeCourt({ id: 'court-1', name: 'Harbor Court' })
const maple = makeCourt({ id: 'court-2', name: 'Maple Court' })

const DAYS_IN_RANGE = 1

describe('buildReports', () => {
  it('bars utilization for every open hour of the club’s day', () => {
    // Act
    const report = buildReports({
      club,
      courts: [harbor],
      bookings: [],
      days: DAYS_IN_RANGE,
      day: DAY,
    })

    // Assert — 07:00 to 21:00 inclusive is fifteen hourly bars.
    expect(report.utilization).toHaveLength(15)
    expect(report.utilization[0].label).toBe('7am')
    expect(report.utilization.at(-1)?.label).toBe('9pm')
  })

  it('fills an hour’s bar in proportion to the court time booked in it', () => {
    // Arrange — one of two courts busy for the whole 10:00 hour.
    const bookings = [
      makeBooking({ segments: [{ courtId: harbor.id, from: '10:00', to: '11:00' }] }),
    ]

    // Act
    const report = buildReports({
      club,
      courts: [harbor, maple],
      bookings,
      days: DAYS_IN_RANGE,
      day: DAY,
    })

    // Assert
    const tenAm = report.utilization.find((hour) => hour.label === '10am')
    expect(tenAm?.percent).toBe(50)
  })

  it('counts only the minutes that fall inside the hour being measured', () => {
    // Arrange — a 10:30–11:30 booking straddles two hourly buckets.
    const bookings = [
      makeBooking({ segments: [{ courtId: harbor.id, from: '10:30', to: '11:30' }] }),
    ]

    // Act
    const report = buildReports({
      club,
      courts: [harbor],
      bookings,
      days: DAYS_IN_RANGE,
      day: DAY,
    })

    // Assert
    expect(report.utilization.find((hour) => hour.label === '10am')?.percent).toBe(50)
    expect(report.utilization.find((hour) => hour.label === '11am')?.percent).toBe(50)
  })

  it('ranks revenue by court and scales each bar against the strongest one', () => {
    // Arrange
    const bookings = [
      makeBooking({
        id: 'b1',
        segments: [{ courtId: harbor.id, from: '10:00', to: '11:00', priceCents: 80_000 }],
      }),
      makeBooking({
        id: 'b2',
        segments: [{ courtId: maple.id, from: '10:00', to: '11:00', priceCents: 40_000 }],
      }),
    ]

    // Act
    const report = buildReports({
      club,
      courts: [harbor, maple],
      bookings,
      days: DAYS_IN_RANGE,
      day: DAY,
    })

    // Assert
    expect(report.revenueByCourt).toEqual([
      { courtId: harbor.id, name: 'Harbor Court', value: '₱800', percent: 100 },
      { courtId: maple.id, name: 'Maple Court', value: '₱400', percent: 50 },
    ])
  })

  it('leaves every bar empty rather than dividing by zero revenue', () => {
    // Act
    const report = buildReports({
      club,
      courts: [harbor],
      bookings: [],
      days: DAYS_IN_RANGE,
      day: DAY,
    })

    // Assert
    expect(report.revenueByCourt).toEqual([
      { courtId: harbor.id, name: 'Harbor Court', value: '₱0', percent: 0 },
    ])
  })

  it('measures the café attach rate as the share of bookings that added something', () => {
    // Arrange
    const bookings = [
      makeBooking({
        id: 'b1',
        segments: [{ courtId: harbor.id, from: '10:00', to: '11:00' }],
        items: [{ name: 'Flat white' }],
      }),
      makeBooking({
        id: 'b2',
        segments: [{ courtId: harbor.id, from: '11:00', to: '12:00' }],
      }),
      makeBooking({
        id: 'b3',
        segments: [{ courtId: harbor.id, from: '12:00', to: '13:00' }],
      }),
      makeBooking({
        id: 'b4',
        segments: [{ courtId: harbor.id, from: '13:00', to: '14:00' }],
        items: [{ name: 'Paddle rental' }],
      }),
    ]

    // Act
    const report = buildReports({
      club,
      courts: [harbor],
      bookings,
      days: DAYS_IN_RANGE,
      day: DAY,
    })

    // Assert
    expect(report.attachRatePercent).toBe(50)
  })

  it('reports a zero attach rate when there are no bookings to divide by', () => {
    // Act
    const report = buildReports({
      club,
      courts: [harbor],
      bookings: [],
      days: DAYS_IN_RANGE,
      day: DAY,
    })

    // Assert
    expect(report.attachRatePercent).toBe(0)
  })

  it('heads the page with revenue, booking count, and average utilization', () => {
    // Arrange
    const bookings = [
      makeBooking({
        segments: [{ courtId: harbor.id, from: '10:00', to: '11:00', priceCents: 60_000 }],
        items: [{ name: 'Flat white', unitPriceCents: 15_000, quantity: 1 }],
      }),
    ]

    // Act
    const report = buildReports({
      club,
      courts: [harbor],
      bookings,
      days: DAYS_IN_RANGE,
      day: DAY,
    })

    // Assert
    expect(report.stats.map((stat) => [stat.label, stat.value])).toEqual([
      ['Revenue', '₱750'],
      ['Bookings', '1'],
      ['Avg utilization', '7%'],
      ['Add-on revenue', '₱150'],
    ])
  })

  it('excludes cancelled bookings from every figure on the page', () => {
    // Arrange
    const bookings = [
      makeBooking({
        status: 'cancelled',
        segments: [{ courtId: harbor.id, from: '10:00', to: '11:00', priceCents: 60_000 }],
        items: [{ name: 'Flat white' }],
      }),
    ]

    // Act
    const report = buildReports({
      club,
      courts: [harbor],
      bookings,
      days: DAYS_IN_RANGE,
      day: DAY,
    })

    // Assert
    expect(report.stats[0].value).toBe('₱0')
    expect(report.stats[1].value).toBe('0')
    expect(report.attachRatePercent).toBe(0)
    expect(report.utilization.every((hour) => hour.percent === 0)).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { toBookingRows } from './bookings'
import { club, makeBooking } from '../../../../test/admin-fixtures'

describe('toBookingRows', () => {
  it('carries the reference, customer, and contact the desk needs to call someone', () => {
    // Arrange
    const bookings = [
      makeBooking({
        reference: 'PB-4820',
        contactName: 'Jun Park',
        contactEmail: 'jun@example.com',
        contactPhone: '(555) 771-2280',
        segments: [{ courtId: 'court-1', from: '20:00', to: '21:00' }],
      }),
    ]

    // Act
    const [row] = toBookingRows(bookings, club)

    // Assert — a phone number beats an email when staff have to reach someone.
    expect(row.reference).toBe('PB-4820')
    expect(row.name).toBe('Jun Park')
    expect(row.contact).toBe('(555) 771-2280')
  })

  it('falls back to the email when no phone number was given', () => {
    // Arrange
    const bookings = [
      makeBooking({
        contactEmail: 'maya@example.com',
        contactPhone: null,
        segments: [{ courtId: 'court-1', from: '17:00', to: '18:00' }],
      }),
    ]

    // Act
    const [row] = toBookingRows(bookings, club)

    // Assert
    expect(row.contact).toBe('maya@example.com')
  })

  it('spells out when the session runs in club-local time', () => {
    // Arrange — 5:00 PM Manila for 90 minutes.
    const bookings = [
      makeBooking({ segments: [{ courtId: 'court-1', from: '17:00', to: '18:30' }] }),
    ]

    // Act
    const [row] = toBookingRows(bookings, club)

    // Assert
    expect(row.when).toBe('Tue, 04 Aug 2026 · 5:00 PM · 1 hr 30 min')
  })

  it('lists every court a multi-court booking holds, without repeating one', () => {
    // Arrange
    const bookings = [
      makeBooking({
        segments: [
          { courtId: 'court-1', courtName: 'Harbor Court', from: '17:00', to: '18:00' },
          { courtId: 'court-2', courtName: 'Maple Court', from: '17:00', to: '18:00' },
          { courtId: 'court-1', courtName: 'Harbor Court', from: '18:00', to: '19:00' },
        ],
      }),
    ]

    // Act
    const [row] = toBookingRows(bookings, club)

    // Assert
    expect(row.court).toBe('Harbor Court, Maple Court')
  })

  it('summarises add-ons with their quantities, or an em dash when there are none', () => {
    // Arrange
    const withExtras = makeBooking({
      id: 'b1',
      segments: [{ courtId: 'court-1', from: '17:00', to: '18:00' }],
      items: [
        { name: 'Paddle rental', quantity: 2 },
        { name: 'Coaching 30 min', quantity: 1 },
      ],
    })
    const withoutExtras = makeBooking({
      id: 'b2',
      segments: [{ courtId: 'court-1', from: '19:00', to: '20:00' }],
    })

    // Act
    const [first, second] = toBookingRows([withExtras, withoutExtras], club)

    // Assert
    expect(first.extras).toBe('Paddle rental ×2, Coaching 30 min')
    expect(second.extras).toBe('—')
  })

  it('formats the total in the club’s currency', () => {
    // Arrange
    const bookings = [
      makeBooking({
        segments: [{ courtId: 'court-1', from: '17:00', to: '18:00', priceCents: 60_000 }],
        items: [{ name: 'Balls', unitPriceCents: 5_000, quantity: 1 }],
      }),
    ]

    // Act
    const [row] = toBookingRows(bookings, club)

    // Assert
    expect(row.total).toBe('₱650')
  })

  it('passes the raw status through so the badge, not this layer, picks the wording', () => {
    // Arrange
    const bookings = [
      makeBooking({
        status: 'awaiting_payment',
        segments: [{ courtId: 'court-1', from: '17:00', to: '18:00' }],
      }),
    ]

    // Act
    const [row] = toBookingRows(bookings, club)

    // Assert
    expect(row.status).toBe('awaiting_payment')
  })
})

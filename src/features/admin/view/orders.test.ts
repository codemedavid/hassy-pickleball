import { describe, expect, it } from 'vitest'
import { toOrderDetail, toOrderRows } from './orders'
import { club, makeBooking } from '../../../../test/admin-fixtures'

/**
 * The orders ledger is the payments view of the same bookings the Bookings
 * screen lists. Its status is the payment's, not the booking's — a confirmed
 * booking with an unpaid bank transfer must still read as awaiting.
 */

describe('toOrderRows', () => {
  it('describes the order line as court time plus any add-ons', () => {
    // Arrange
    const bookings = [
      makeBooking({
        segments: [{ courtId: 'court-1', from: '17:00', to: '18:30' }],
        items: [{ name: 'Paddle rental', quantity: 2 }, { name: 'Flat white' }],
      }),
    ]

    // Act
    const [row] = toOrderRows(bookings, club)

    // Assert
    expect(row.items).toBe('Court 1 hr 30 min + Paddle rental ×2 + Flat white')
  })

  it('names the payment method in words staff use, not database enums', () => {
    // Arrange
    const bookings = [
      makeBooking({
        segments: [{ courtId: 'court-1', from: '17:00', to: '18:00' }],
        payments: [{ method: 'bank_transfer', status: 'pending' }],
      }),
    ]

    // Act
    const [row] = toOrderRows(bookings, club)

    // Assert
    expect(row.method).toBe('Bank transfer')
  })

  it('reads as unpaid when no payment has been recorded at all', () => {
    // Arrange
    const bookings = [
      makeBooking({ segments: [{ courtId: 'court-1', from: '17:00', to: '18:00' }] }),
    ]

    // Act
    const [row] = toOrderRows(bookings, club)

    // Assert
    expect(row.method).toBe('Not recorded')
    expect(row.status).toBe('awaiting')
  })

  it('reports paid once a payment has settled', () => {
    // Arrange
    const bookings = [
      makeBooking({
        segments: [{ courtId: 'court-1', from: '17:00', to: '18:00' }],
        payments: [{ method: 'card', status: 'paid' }],
      }),
    ]

    // Act
    const [row] = toOrderRows(bookings, club)

    // Assert
    expect(row.status).toBe('paid')
  })

  it('reports a refund even when an earlier payment on the same booking succeeded', () => {
    // Arrange — the refund is the later, and truer, fact about the money.
    const bookings = [
      makeBooking({
        segments: [{ courtId: 'court-1', from: '17:00', to: '18:00' }],
        payments: [
          { method: 'card', status: 'paid' },
          { method: 'card', status: 'refunded' },
        ],
      }),
    ]

    // Act
    const [row] = toOrderRows(bookings, club)

    // Assert
    expect(row.status).toBe('refunded')
  })

  it('flags a failed payment so it is not mistaken for one merely awaiting', () => {
    // Arrange
    const bookings = [
      makeBooking({
        segments: [{ courtId: 'court-1', from: '17:00', to: '18:00' }],
        payments: [{ method: 'online', status: 'failed' }],
      }),
    ]

    // Act
    const [row] = toOrderRows(bookings, club)

    // Assert
    expect(row.status).toBe('failed')
  })
})

describe('toOrderDetail', () => {
  it('breaks the total into the court and add-on lines behind it', () => {
    // Arrange
    const booking = makeBooking({
      reference: 'PB-4821',
      segments: [{ courtId: 'court-1', from: '17:00', to: '18:30', priceCents: 90_000 }],
      items: [{ name: 'Paddle rental', unitPriceCents: 10_000, quantity: 2 }],
    })

    // Act
    const detail = toOrderDetail(booking, club)

    // Assert
    expect(detail.reference).toBe('PB-4821')
    expect(detail.lines).toEqual([
      { label: 'Court time', value: '₱900' },
      { label: 'Paddle rental ×2', value: '₱200' },
    ])
    expect(detail.total).toBe('₱1,100')
  })

  it('lists the metadata staff scan first: customer, when, and how they paid', () => {
    // Arrange
    const booking = makeBooking({
      contactName: 'Maya Halvorsen',
      segments: [{ courtId: 'court-1', courtName: 'Harbor Court', from: '17:00', to: '18:00' }],
      payments: [{ method: 'gcash', status: 'paid' }],
    })

    // Act
    const detail = toOrderDetail(booking, club)

    // Assert
    expect(detail.meta).toEqual([
      { label: 'Customer', value: 'Maya Halvorsen' },
      { label: 'Court', value: 'Harbor Court' },
      { label: 'When', value: 'Tue, 04 Aug 2026 · 5:00 PM' },
      { label: 'Method', value: 'GCash' },
    ])
  })

  it('shows the booking note when there is one, and says so plainly when there is not', () => {
    // Arrange
    const withNote = makeBooking({
      id: 'b1',
      notes: 'Member — approved for desk payment.',
      segments: [{ courtId: 'court-1', from: '17:00', to: '18:00' }],
    })
    const withoutNote = makeBooking({
      id: 'b2',
      segments: [{ courtId: 'court-1', from: '17:00', to: '18:00' }],
    })

    // Act & Assert
    expect(toOrderDetail(withNote, club).note).toBe('Member — approved for desk payment.')
    expect(toOrderDetail(withoutNote, club).note).toBe('No note on this order.')
  })

  it('omits the add-on lines entirely for a court-only booking', () => {
    // Arrange
    const booking = makeBooking({
      segments: [{ courtId: 'court-1', from: '17:00', to: '18:00', priceCents: 60_000 }],
    })

    // Act
    const detail = toOrderDetail(booking, club)

    // Assert
    expect(detail.lines).toEqual([{ label: 'Court time', value: '₱600' }])
  })
})

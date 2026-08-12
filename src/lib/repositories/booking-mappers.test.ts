import { describe, expect, it } from 'vitest'
import {
  toAvailabilityBlock,
  toBooking,
  toBookingItemLine,
  toBookingSegment,
  toCustomer,
  toPayment,
} from './booking-mappers'

/**
 * Guarantees that timestamps become Date objects and snake_case never escapes
 * the repository layer, so no caller has to re-parse or re-name anything.
 */

const BOOKING_ROW = {
  id: 'booking-1',
  club_id: 'club-1',
  reference: 'PB-4G6JVH',
  customer_id: 'customer-1',
  contact_name: 'Ana Cruz',
  contact_email: 'ana@example.com',
  contact_phone: null,
  status: 'awaiting_payment' as const,
  starts_at: '2026-03-01T02:00:00.000Z',
  ends_at: '2026-03-01T03:00:00.000Z',
  courts_subtotal_cents: 60000,
  items_subtotal_cents: 40000,
  total_cents: 100000,
  will_present_id: true,
  notes: null,
  confirmed_at: null,
  cancelled_at: null,
  created_at: '2026-02-20T10:00:00.000Z',
}

describe('toBooking', () => {
  it('parses every timestamp into a Date', () => {
    const booking = toBooking(BOOKING_ROW)

    expect(booking.startsAt).toBeInstanceOf(Date)
    expect(booking.startsAt.toISOString()).toBe('2026-03-01T02:00:00.000Z')
    expect(booking.endsAt.toISOString()).toBe('2026-03-01T03:00:00.000Z')
  })

  it('leaves an unset confirmation or cancellation as null rather than an epoch date', () => {
    const booking = toBooking(BOOKING_ROW)

    expect(booking.confirmedAt).toBeNull()
    expect(booking.cancelledAt).toBeNull()
  })

  it('parses a set cancellation timestamp', () => {
    const booking = toBooking({ ...BOOKING_ROW, cancelled_at: '2026-02-25T08:30:00.000Z' })

    expect(booking.cancelledAt?.toISOString()).toBe('2026-02-25T08:30:00.000Z')
  })

  it('exposes camelCase money and contact fields', () => {
    const booking = toBooking(BOOKING_ROW)

    expect(booking.courtsSubtotalCents).toBe(60000)
    expect(booking.itemsSubtotalCents).toBe(40000)
    expect(booking.totalCents).toBe(100000)
    expect(booking.contactEmail).toBe('ana@example.com')
    expect(booking.willPresentId).toBe(true)
  })
})

describe('toBookingSegment', () => {
  it('maps a segment and keeps its own price', () => {
    const segment = toBookingSegment({
      id: 'segment-1',
      court_id: 'court-1',
      status: 'confirmed',
      starts_at: '2026-03-01T02:00:00.000Z',
      ends_at: '2026-03-01T03:00:00.000Z',
      price_cents: 60000,
    })

    expect(segment).toMatchObject({ courtId: 'court-1', priceCents: 60000, status: 'confirmed' })
    expect(segment.startsAt).toBeInstanceOf(Date)
  })

  it('picks up the joined court name when the query selected one', () => {
    const segment = toBookingSegment({
      id: 'segment-1',
      court_id: 'court-1',
      status: 'confirmed',
      starts_at: '2026-03-01T02:00:00.000Z',
      ends_at: '2026-03-01T03:00:00.000Z',
      price_cents: 60000,
      courts: { name: 'Court 3' },
    })

    expect(segment.courtName).toBe('Court 3')
  })

  it('reports a null court name when the query did not join courts', () => {
    const segment = toBookingSegment({
      id: 'segment-1',
      court_id: 'court-1',
      status: 'confirmed',
      starts_at: '2026-03-01T02:00:00.000Z',
      ends_at: '2026-03-01T03:00:00.000Z',
      price_cents: 60000,
    })

    expect(segment.courtName).toBeNull()
  })
})

describe('toBookingItemLine', () => {
  it('uses the snapshot name so a renamed product does not rewrite history', () => {
    const line = toBookingItemLine({
      id: 'item-1',
      product_id: 'product-1',
      name_snapshot: 'Paddle rental',
      unit_price_cents: 20000,
      quantity: 2,
      line_total_cents: 40000,
    })

    expect(line.name).toBe('Paddle rental')
    expect(line.lineTotalCents).toBe(40000)
  })

  it('survives a product that has since been deleted', () => {
    const line = toBookingItemLine({
      id: 'item-1',
      product_id: null,
      name_snapshot: 'Discontinued drink',
      unit_price_cents: 9000,
      quantity: 1,
      line_total_cents: 9000,
    })

    expect(line.productId).toBeNull()
    expect(line.name).toBe('Discontinued drink')
  })
})

describe('toPayment', () => {
  it('maps method, status and amount', () => {
    const payment = toPayment({
      id: 'payment-1',
      booking_id: 'booking-1',
      method: 'gcash',
      status: 'paid',
      amount_cents: 100000,
      external_reference: 'GC-123',
      paid_at: '2026-02-21T04:00:00.000Z',
      refunded_at: null,
      proof_url: null,
    })

    expect(payment).toMatchObject({
      method: 'gcash',
      status: 'paid',
      amountCents: 100000,
      externalReference: 'GC-123',
    })
    expect(payment.paidAt?.toISOString()).toBe('2026-02-21T04:00:00.000Z')
    expect(payment.refundedAt).toBeNull()
  })

  it('carries the stored proof path so the console can sign a link to it', () => {
    const payment = toPayment({
      id: 'payment-1',
      booking_id: 'booking-1',
      method: 'bank_transfer',
      status: 'pending',
      amount_cents: 60000,
      external_reference: null,
      paid_at: null,
      refunded_at: null,
      proof_url: 'PB-4G6JVH/proof.png',
    })

    expect(payment.proofUrl).toBe('PB-4G6JVH/proof.png')
  })

  it('reads a cash payment with no uploaded proof as having none', () => {
    const payment = toPayment({
      id: 'payment-2',
      booking_id: 'booking-1',
      method: 'cash',
      status: 'paid',
      amount_cents: 60000,
      external_reference: null,
      paid_at: '2026-02-21T04:00:00.000Z',
      refunded_at: null,
      proof_url: null,
    })

    expect(payment.proofUrl).toBeNull()
  })
})

describe('toCustomer', () => {
  it('maps the rollup counters the customers screen displays', () => {
    const customer = toCustomer({
      id: 'customer-1',
      club_id: 'club-1',
      full_name: 'Ana Cruz',
      email: 'ana@example.com',
      phone: '+639170000000',
      tier: 'regular',
      total_spend_cents: 450000,
      bookings_count: 7,
      last_visit_at: '2026-02-18T09:00:00.000Z',
    })

    expect(customer).toMatchObject({
      fullName: 'Ana Cruz',
      tier: 'regular',
      totalSpendCents: 450000,
      bookingsCount: 7,
    })
    expect(customer.lastVisitAt?.toISOString()).toBe('2026-02-18T09:00:00.000Z')
  })

  it('reports a customer who has never visited as null, not epoch', () => {
    const customer = toCustomer({
      id: 'customer-2',
      club_id: 'club-1',
      full_name: 'New Player',
      email: 'new@example.com',
      phone: null,
      tier: 'standard',
      total_spend_cents: 0,
      bookings_count: 0,
      last_visit_at: null,
    })

    expect(customer.lastVisitAt).toBeNull()
  })
})

describe('toAvailabilityBlock', () => {
  it('maps a maintenance block into a domain time range', () => {
    const block = toAvailabilityBlock({
      id: 'block-1',
      court_id: 'court-1',
      kind: 'maintenance',
      reason: 'Resurfacing',
      starts_at: '2026-03-01T01:00:00.000Z',
      ends_at: '2026-03-01T05:00:00.000Z',
    })

    expect(block).toMatchObject({ courtId: 'court-1', kind: 'maintenance', reason: 'Resurfacing' })
    expect(block.endsAt.getTime() - block.startsAt.getTime()).toBe(4 * 60 * 60 * 1000)
  })
})

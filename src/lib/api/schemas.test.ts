import { describe, expect, it } from 'vitest'
import { bookingLookupSchema, createBookingSchema } from './schemas'

const VALID_UUID = '00000000-0000-4000-8000-000000000001'

function validBooking() {
  return {
    clubId: VALID_UUID,
    contactName: 'Ana Cruz',
    contactEmail: 'ana@example.com',
    contactPhone: '+639170000000',
    willPresentId: true,
    notes: null,
    courts: [
      {
        courtId: VALID_UUID,
        startsAt: '2026-03-16T02:00:00.000Z',
        endsAt: '2026-03-16T03:00:00.000Z',
      },
    ],
    items: [{ productId: VALID_UUID, quantity: 2 }],
  }
}

describe('createBookingSchema', () => {
  it('accepts a well-formed booking', () => {
    const result = createBookingSchema.safeParse(validBooking())

    expect(result.success).toBe(true)
  })

  it('coerces ISO strings into Date objects', () => {
    const result = createBookingSchema.parse(validBooking())

    expect(result.courts[0].startsAt).toBeInstanceOf(Date)
    expect(result.courts[0].startsAt.toISOString()).toBe('2026-03-16T02:00:00.000Z')
  })

  it('rejects an invalid email', () => {
    const result = createBookingSchema.safeParse({ ...validBooking(), contactEmail: 'not-email' })

    expect(result.success).toBe(false)
  })

  it('rejects an empty contact name', () => {
    const result = createBookingSchema.safeParse({ ...validBooking(), contactName: '   ' })

    expect(result.success).toBe(false)
  })

  it('rejects a booking with no court segments', () => {
    const result = createBookingSchema.safeParse({ ...validBooking(), courts: [] })

    expect(result.success).toBe(false)
  })

  it('rejects a segment that ends before it starts', () => {
    const booking = validBooking()
    const result = createBookingSchema.safeParse({
      ...booking,
      courts: [
        {
          ...booking.courts[0],
          startsAt: '2026-03-16T03:00:00.000Z',
          endsAt: '2026-03-16T02:00:00.000Z',
        },
      ],
    })

    expect(result.success).toBe(false)
  })

  it('rejects a non-uuid court id', () => {
    const booking = validBooking()
    const result = createBookingSchema.safeParse({
      ...booking,
      courts: [{ ...booking.courts[0], courtId: 'court-1' }],
    })

    expect(result.success).toBe(false)
  })

  it('never accepts a client-supplied price', () => {
    const booking = validBooking()
    const parsed = createBookingSchema.parse({
      ...booking,
      courts: [{ ...booking.courts[0], priceCents: 1 }],
    })

    expect(parsed.courts[0]).not.toHaveProperty('priceCents')
  })

  it('rejects a zero or negative item quantity', () => {
    const booking = validBooking()

    expect(
      createBookingSchema.safeParse({ ...booking, items: [{ productId: VALID_UUID, quantity: 0 }] })
        .success,
    ).toBe(false)
  })

  it('defaults items to an empty list when omitted', () => {
    const withoutItems: Record<string, unknown> = { ...validBooking() }
    delete withoutItems.items

    const parsed = createBookingSchema.parse(withoutItems)

    expect(parsed.items).toEqual([])
  })

  it('trims surrounding whitespace from the contact name', () => {
    const parsed = createBookingSchema.parse({ ...validBooking(), contactName: '  Ana Cruz  ' })

    expect(parsed.contactName).toBe('Ana Cruz')
  })
})

describe('bookingLookupSchema', () => {
  it('accepts a reference and matching email', () => {
    const result = bookingLookupSchema.safeParse({
      reference: 'PB-4G6JVH',
      email: 'ana@example.com',
    })

    expect(result.success).toBe(true)
  })

  it('uppercases the reference so lookup is case-insensitive', () => {
    const parsed = bookingLookupSchema.parse({ reference: 'pb-4g6jvh', email: 'ana@example.com' })

    expect(parsed.reference).toBe('PB-4G6JVH')
  })

  it('rejects a malformed reference', () => {
    expect(bookingLookupSchema.safeParse({ reference: 'nope', email: 'a@b.com' }).success).toBe(
      false,
    )
  })

  it('rejects a missing email', () => {
    expect(bookingLookupSchema.safeParse({ reference: 'PB-4G6JVH' }).success).toBe(false)
  })
})

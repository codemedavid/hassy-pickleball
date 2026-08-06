import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
const findBookingByReference = vi.fn()
const findClubById = vi.fn()
const listActiveCourts = vi.fn()
const listActivePricingRules = vi.fn()
const findCustomerByEmail = vi.fn()
const quoteSelections = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }))
vi.mock('@/lib/repositories/bookings', () => ({ findBookingByReference }))
vi.mock('@/lib/repositories/clubs', () => ({ findClubById }))
vi.mock('@/lib/repositories/courts', () => ({ listActiveCourts }))
vi.mock('@/lib/repositories/pricing-rules', () => ({ listActivePricingRules }))
vi.mock('@/lib/repositories/customers', () => ({ findCustomerByEmail }))
vi.mock('@/lib/api/quote', () => ({ quoteSelections }))

const { rescheduleBooking } = await import('./reschedule')

const COURT_ID = '88888888-8888-4888-8888-888888888888'
const CLUB_ID = '99999999-9999-4999-8999-999999999999'

const BOOKING = {
  id: 'booking-1',
  clubId: CLUB_ID,
  reference: 'PB-4G6JVH',
  contactEmail: 'ana@example.com',
  status: 'confirmed',
}

/** What the server decides the new slot costs. */
const QUOTED_CENTS = 90000

const VALID = {
  reference: 'PB-4G6JVH',
  email: 'ana@example.com',
  courts: [
    {
      courtId: COURT_ID,
      startsAt: '2026-03-08T02:00:00.000Z',
      endsAt: '2026-03-08T03:00:00.000Z',
    },
  ],
}

const RESCHEDULED_ROW = { reference: 'PB-4G6JVH', status: 'confirmed', total_cents: QUOTED_CENTS }

function allowLookup() {
  rpc.mockImplementation((name: string) =>
    name === 'record_lookup_attempt'
      ? Promise.resolve({ data: true, error: null })
      : Promise.resolve({ data: [RESCHEDULED_ROW], error: null }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  allowLookup()
  findBookingByReference.mockResolvedValue(BOOKING)
  findClubById.mockResolvedValue({ id: CLUB_ID, timeZone: 'Asia/Manila' })
  listActiveCourts.mockResolvedValue([{ id: COURT_ID, basePriceCents: 60000 }])
  listActivePricingRules.mockResolvedValue([])
  findCustomerByEmail.mockResolvedValue({ tier: 'pro' })
  quoteSelections.mockReturnValue([
    {
      courtId: COURT_ID,
      startsAt: new Date(VALID.courts[0].startsAt),
      endsAt: new Date(VALID.courts[0].endsAt),
      priceCents: QUOTED_CENTS,
    },
  ])
})

function rescheduleCall() {
  return rpc.mock.calls.find(([name]) => name === 'reschedule_booking')
}

describe('rescheduleBooking', () => {
  it('rejects a malformed reference before looking anything up', async () => {
    const result = await rescheduleBooking({ ...VALID, reference: 'nonsense' })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejects a request with no court segments', async () => {
    const result = await rescheduleBooking({ ...VALID, courts: [] })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
  })

  it('rejects a segment that ends before it starts', async () => {
    const result = await rescheduleBooking({
      ...VALID,
      courts: [{ ...VALID.courts[0], endsAt: '2026-03-08T01:00:00.000Z' }],
    })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
  })

  it('is rate limited like the lookup, because it is equally enumerable', async () => {
    rpc.mockResolvedValue({ data: false, error: null })

    const result = await rescheduleBooking(VALID)

    expect(result).toMatchObject({ success: false, code: 'RATE_LIMITED' })
    expect(rescheduleCall()).toBeUndefined()
  })

  it('gives the same answer for an unknown reference as for a wrong email', async () => {
    findBookingByReference.mockResolvedValue(null)
    const unknownReference = await rescheduleBooking(VALID)

    findBookingByReference.mockResolvedValue(BOOKING)
    const wrongEmail = await rescheduleBooking({ ...VALID, email: 'someone@else.com' })

    expect(unknownReference).toMatchObject({ success: false, code: 'NOT_FOUND' })
    expect(wrongEmail).toMatchObject({ success: false, code: 'NOT_FOUND' })
    if (unknownReference.success || wrongEmail.success) return
    expect(wrongEmail.error).toBe(unknownReference.error)
  })

  it('prices the new slot on the server, ignoring any price in the request', async () => {
    await rescheduleBooking({
      ...VALID,
      courts: [{ ...VALID.courts[0], priceCents: 1 }],
    })

    expect(rescheduleCall()?.[1]).toMatchObject({
      p_courts: [expect.objectContaining({ price_cents: QUOTED_CENTS })],
    })
  })

  it('quotes at the club timezone and the customer tier, not a default', async () => {
    await rescheduleBooking(VALID)

    expect(quoteSelections).toHaveBeenCalledWith(
      expect.objectContaining({ timeZone: 'Asia/Manila', tier: 'pro' }),
    )
  })

  it('quotes a guest with no customer record at the standard tier', async () => {
    findCustomerByEmail.mockResolvedValue(null)

    await rescheduleBooking(VALID)

    expect(quoteSelections).toHaveBeenCalledWith(expect.objectContaining({ tier: 'standard' }))
  })

  it('reports a booking that can no longer be moved', async () => {
    rpc.mockImplementation((name: string) =>
      name === 'record_lookup_attempt'
        ? Promise.resolve({ data: true, error: null })
        : Promise.resolve({ data: null, error: { message: 'illegal', code: 'P0002' } }),
    )

    const result = await rescheduleBooking(VALID)

    expect(result).toMatchObject({ success: false, code: 'NOT_RESCHEDULABLE' })
  })

  it('reports a clash with someone else’s booking as a taken slot', async () => {
    rpc.mockImplementation((name: string) =>
      name === 'record_lookup_attempt'
        ? Promise.resolve({ data: true, error: null })
        : Promise.resolve({ data: null, error: { message: 'exclusion', code: '23P01' } }),
    )

    const result = await rescheduleBooking(VALID)

    expect(result).toMatchObject({ success: false, code: 'SLOT_TAKEN' })
  })

  it('never returns the raw database message', async () => {
    rpc.mockImplementation((name: string) =>
      name === 'record_lookup_attempt'
        ? Promise.resolve({ data: true, error: null })
        : Promise.resolve({
            data: null,
            error: { message: 'booking_courts_no_double_booking', code: 'XX000' },
          }),
    )

    const result = await rescheduleBooking(VALID)

    expect(result).toMatchObject({ success: false, code: 'DB_ERROR' })
    if (result.success) return
    expect(result.error).not.toContain('booking_courts_no_double_booking')
  })

  it('returns the updated booking with its new total', async () => {
    const result = await rescheduleBooking(VALID)

    expect(result).toEqual({
      success: true,
      data: { reference: 'PB-4G6JVH', status: 'confirmed', totalCents: QUOTED_CENTS },
    })
  })
})

describe('rescheduleBooking rate limiting', () => {
  // Reschedule authenticates on the same reference + email pair as the lookup,
  // so a limiter that fails open hands an attacker unlimited attempts.
  it('refuses when the limiter itself errors', async () => {
    rpc.mockImplementation((name: string) =>
      name === 'record_lookup_attempt'
        ? Promise.resolve({ data: null, error: { message: 'function does not exist' } })
        : Promise.resolve({ data: [RESCHEDULED_ROW], error: null }),
    )

    const result = await rescheduleBooking(VALID)

    expect(result).toMatchObject({ success: false, code: 'RATE_LIMITED' })
    expect(rpc).not.toHaveBeenCalledWith('reschedule_booking', expect.anything())
  })

  it('refuses when the limiter returns nothing', async () => {
    rpc.mockImplementation((name: string) =>
      name === 'record_lookup_attempt'
        ? Promise.resolve({ data: null, error: null })
        : Promise.resolve({ data: [RESCHEDULED_ROW], error: null }),
    )

    const result = await rescheduleBooking(VALID)

    expect(result).toMatchObject({ success: false, code: 'RATE_LIMITED' })
  })
})

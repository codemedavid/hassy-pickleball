import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
const findClubById = vi.fn()
const listActiveCourts = vi.fn()
const listActivePricingRules = vi.fn()
const findCustomerByEmail = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }))
vi.mock('@/lib/repositories/clubs', () => ({ findClubById }))
vi.mock('@/lib/repositories/courts', () => ({ listActiveCourts }))
vi.mock('@/lib/repositories/pricing-rules', () => ({ listActivePricingRules }))
vi.mock('@/lib/repositories/customers', () => ({ findCustomerByEmail }))

const { createBooking } = await import('./create-booking')

const CLUB_ID = '11111111-1111-4111-8111-111111111111'
const COURT_ID = '22222222-2222-4222-8222-222222222222'

const CLUB = { id: CLUB_ID, timeZone: 'Asia/Manila' }
const COURT = { id: COURT_ID, basePriceCents: 60000 }

/** 50% off for pro members, so a tier mistake is visible in the total. */
const PRO_DISCOUNT = {
  id: 'rule-1',
  label: 'Pro member',
  courtId: null,
  daysOfWeek: [],
  startsAtTime: null,
  endsAtTime: null,
  minDurationMinutes: null,
  appliesToTier: 'pro' as const,
  kind: 'percent_delta' as const,
  valueCents: null,
  valuePercent: -50,
  priority: 1,
}

const VALID = {
  clubId: CLUB_ID,
  contactName: 'Ana Cruz',
  contactEmail: 'ana@example.com',
  willPresentId: false,
  courts: [
    {
      courtId: COURT_ID,
      startsAt: '2026-03-01T02:00:00.000Z',
      endsAt: '2026-03-01T03:00:00.000Z',
    },
  ],
  items: [],
}

function pricedCourts(): Array<{ price_cents: number }> {
  return rpc.mock.calls[0]?.[1]?.p_courts ?? []
}

beforeEach(() => {
  vi.clearAllMocks()
  findClubById.mockResolvedValue(CLUB)
  listActiveCourts.mockResolvedValue([COURT])
  listActivePricingRules.mockResolvedValue([])
  findCustomerByEmail.mockResolvedValue(null)
  rpc.mockResolvedValue({
    data: { reference: 'PB-4G6JVH', status: 'awaiting_payment', total_cents: 60000 },
    error: null,
  })
})

describe('createBooking', () => {
  it('rejects a booking with no court segments before touching the database', async () => {
    const result = await createBooking({ ...VALID, courts: [] })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejects an invalid contact email', async () => {
    const result = await createBooking({ ...VALID, contactEmail: 'not-an-email' })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
  })

  it('reports a missing club as not found', async () => {
    findClubById.mockResolvedValue(null)

    const result = await createBooking(VALID)

    expect(result).toMatchObject({ success: false, code: 'NOT_FOUND' })
  })

  it('prices every segment on the server, ignoring any price the client sent', async () => {
    await createBooking({
      ...VALID,
      courts: [{ ...VALID.courts[0], priceCents: 1 }],
    })

    expect(pricedCourts()[0]?.price_cents).toBe(60000)
  })

  it('applies the tier discount of a returning member', async () => {
    findCustomerByEmail.mockResolvedValue({ tier: 'pro' })
    listActivePricingRules.mockResolvedValue([PRO_DISCOUNT])

    await createBooking(VALID)

    expect(pricedCourts()[0]?.price_cents).toBe(30000)
  })

  it('quotes a first-time guest at the standard tier', async () => {
    findCustomerByEmail.mockResolvedValue(null)
    listActivePricingRules.mockResolvedValue([PRO_DISCOUNT])

    await createBooking(VALID)

    expect(pricedCourts()[0]?.price_cents).toBe(60000)
  })

  it('passes the chosen payment method through to the booking transaction', async () => {
    await createBooking({ ...VALID, paymentMethod: 'gcash' })

    expect(rpc.mock.calls[0]?.[1]?.p_payment_method).toBe('gcash')
  })

  it('explains a lost race for the slot rather than reporting a generic failure', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '23P01', message: 'conflicting key' } })

    const result = await createBooking(VALID)

    expect(result).toMatchObject({ success: false, code: 'SLOT_TAKEN' })
  })

  it('does not leak the database error text on an unexpected failure', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'relation missing' } })

    const result = await createBooking(VALID)

    expect(result).toMatchObject({ success: false, code: 'DB_ERROR' })
    if (result.success) return
    expect(result.error).not.toContain('relation')
  })

  it('returns the reference and total on success', async () => {
    const result = await createBooking(VALID)

    expect(result).toMatchObject({
      success: true,
      data: { reference: 'PB-4G6JVH', totalCents: 60000 },
    })
  })

  it('turns a repository failure into an error result rather than crashing', async () => {
    listActiveCourts.mockRejectedValue(new Error('connection reset'))

    const result = await createBooking(VALID)

    expect(result).toMatchObject({ success: false, code: 'UNEXPECTED' })
  })
})

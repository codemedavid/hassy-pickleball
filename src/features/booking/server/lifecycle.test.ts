import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({ rpc }),
}))

const { cancelBooking, findBooking } = await import('./lifecycle')

const BOOKING_ROW = {
  reference: 'PB-4G6JVH',
  status: 'cancelled',
  total_cents: 100000,
}

const VALID = { reference: 'PB-4G6JVH', email: 'ana@example.com' }

/** Lets the limiter through so a test can exercise what comes after it. */
function underLimit(response: { data: unknown; error?: unknown }) {
  rpc.mockImplementation((name: string) =>
    name === 'record_lookup_attempt'
      ? Promise.resolve({ data: true, error: null })
      : Promise.resolve({ error: null, ...response }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('findBooking', () => {
  it('refuses the lookup once the rate limit for that identity is spent', async () => {
    rpc.mockImplementation((name: string) =>
      name === 'record_lookup_attempt'
        ? Promise.resolve({ data: false, error: null })
        : Promise.resolve({ data: [BOOKING_ROW], error: null }),
    )

    const result = await findBooking(VALID)

    expect(result).toMatchObject({ success: false, code: 'RATE_LIMITED' })
    expect(rpc).not.toHaveBeenCalledWith('find_booking_by_reference', expect.anything())
  })

  it('counts the attempt before deciding, so a blocked caller cannot decay back under', async () => {
    rpc.mockResolvedValue({ data: false, error: null })

    await findBooking(VALID)

    expect(rpc).toHaveBeenCalledWith(
      'record_lookup_attempt',
      expect.objectContaining({ p_identity: expect.stringContaining('ana@example.com') }),
    )
  })

  it('returns the booking when the reference and email match', async () => {
    rpc.mockImplementation((name: string) =>
      name === 'record_lookup_attempt'
        ? Promise.resolve({ data: true, error: null })
        : Promise.resolve({ data: [{ ...BOOKING_ROW, status: 'confirmed' }], error: null }),
    )

    const result = await findBooking(VALID)

    expect(result).toMatchObject({ success: true })
    if (!result.success) return
    expect(result.data.reference).toBe('PB-4G6JVH')
  })

  it('gives the same message for a wrong reference and a wrong email', async () => {
    rpc.mockImplementation((name: string) =>
      name === 'record_lookup_attempt'
        ? Promise.resolve({ data: true, error: null })
        : Promise.resolve({ data: [], error: null }),
    )

    const wrongReference = await findBooking({ ...VALID, reference: 'PB-ZZZZZZ' })
    const wrongEmail = await findBooking({ ...VALID, email: 'someone@example.com' })

    expect(wrongReference).toEqual(wrongEmail)
  })

  it('rejects a malformed reference without spending a lookup', async () => {
    const result = await findBooking({ ...VALID, reference: 'nonsense' })

    expect(result.success).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('findBooking rate limiting', () => {
  // A limiter that waves callers through when its own counter is broken hands
  // an attacker unlimited attempts at the reference keyspace.
  it('refuses the lookup when the limiter itself errors', async () => {
    rpc.mockImplementation((name: string) =>
      name === 'record_lookup_attempt'
        ? Promise.resolve({ data: null, error: { message: 'function does not exist' } })
        : Promise.resolve({ data: [BOOKING_ROW], error: null }),
    )

    const result = await findBooking(VALID)

    expect(result).toMatchObject({ success: false, code: 'RATE_LIMITED' })
    expect(rpc).not.toHaveBeenCalledWith('find_booking_by_reference', expect.anything())
  })

  it('refuses the lookup when the limiter returns nothing', async () => {
    rpc.mockImplementation((name: string) =>
      name === 'record_lookup_attempt'
        ? Promise.resolve({ data: null, error: null })
        : Promise.resolve({ data: [BOOKING_ROW], error: null }),
    )

    const result = await findBooking(VALID)

    expect(result).toMatchObject({ success: false, code: 'RATE_LIMITED' })
  })

  it('counts the identity case-insensitively, so casing does not reset the counter', async () => {
    underLimit({ data: [BOOKING_ROW] })

    await findBooking({ ...VALID, email: 'ANA@example.com' })

    expect(rpc).toHaveBeenCalledWith(
      'record_lookup_attempt',
      expect.objectContaining({ p_identity: expect.stringContaining('ana@example.com') }),
    )
  })
})

describe('cancelBooking', () => {
  // Cancellation authenticates on the same reference + email pair as the
  // lookup, so it is exactly as enumerable — and it also mutates state.
  it('refuses once the rate limit for that identity is spent', async () => {
    rpc.mockResolvedValue({ data: false, error: null })

    const result = await cancelBooking(VALID)

    expect(result).toMatchObject({ success: false, code: 'RATE_LIMITED' })
    expect(rpc).not.toHaveBeenCalledWith('cancel_booking', expect.anything())
  })

  it('refuses when the limiter itself errors', async () => {
    rpc.mockImplementation((name: string) =>
      name === 'record_lookup_attempt'
        ? Promise.resolve({ data: null, error: { message: 'boom' } })
        : Promise.resolve({ data: [BOOKING_ROW], error: null }),
    )

    const result = await cancelBooking(VALID)

    expect(result).toMatchObject({ success: false, code: 'RATE_LIMITED' })
    expect(rpc).not.toHaveBeenCalledWith('cancel_booking', expect.anything())
  })

  it('cancels a booking that matches the reference and email', async () => {
    underLimit({ data: [BOOKING_ROW] })

    const result = await cancelBooking(VALID)

    expect(result).toMatchObject({ success: true })
    expect(rpc).toHaveBeenCalledWith(
      'cancel_booking',
      expect.objectContaining({ p_reference: 'PB-4G6JVH', p_email: 'ana@example.com' }),
    )
  })

  it('reports not found when nothing matches, without confirming the reference exists', async () => {
    underLimit({ data: [] })

    const result = await cancelBooking(VALID)

    expect(result).toMatchObject({ success: false, code: 'NOT_FOUND' })
  })

  it('explains that an already-finished booking cannot be cancelled', async () => {
    underLimit({
      data: null,
      error: {
        code: 'P0002',
        message: 'booking PB-4G6JVH cannot be cancelled from status completed',
      },
    })

    const result = await cancelBooking(VALID)

    expect(result).toMatchObject({ success: false, code: 'NOT_CANCELLABLE' })
  })

  it('does not leak the database error text to the customer', async () => {
    underLimit({ data: null, error: { code: 'XX000', message: 'relation does not exist' } })

    const result = await cancelBooking(VALID)

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).not.toContain('relation')
  })

  it('rejects a malformed reference before calling the database', async () => {
    const result = await cancelBooking({ ...VALID, reference: 'oops' })

    expect(result.success).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })
})

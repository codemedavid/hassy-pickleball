import { beforeEach, describe, expect, it, vi } from 'vitest'

const getCurrentStaff = vi.fn()
const createSupabaseServerClient = vi.fn()
const recordPayment = vi.fn()
const markPaymentRefunded = vi.fn()
const updateBookingStatus = vi.fn()

vi.mock('@/lib/auth/staff', () => ({ getCurrentStaff }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient }))
vi.mock('@/lib/repositories/payments', () => ({ recordPayment, markPaymentRefunded }))
vi.mock('@/lib/repositories/bookings', () => ({ updateBookingStatus }))

const { markBookingPaid, refundBookingPayment } = await import('./payments')

const STAFF = {
  id: 'staff-1',
  userId: 'user-1',
  clubId: 'club-1',
  role: 'staff' as const,
  fullName: 'Mika Reyes',
}

const BOOKING_ID = '11111111-1111-4111-8111-111111111111'
const PAYMENT_ID = '22222222-2222-4222-8222-222222222222'

const PAYMENT = { id: PAYMENT_ID, bookingId: BOOKING_ID, status: 'paid', amountCents: 60000 }

const VALID = {
  bookingId: BOOKING_ID,
  method: 'cash',
  amountCents: 60000,
  externalReference: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  createSupabaseServerClient.mockResolvedValue({})
  getCurrentStaff.mockResolvedValue(STAFF)
  recordPayment.mockResolvedValue(PAYMENT)
  markPaymentRefunded.mockResolvedValue({ ...PAYMENT, status: 'refunded' })
  updateBookingStatus.mockResolvedValue({ id: BOOKING_ID, status: 'confirmed' })
})

describe('markBookingPaid', () => {
  it('refuses a caller with no staff session and never writes a payment', async () => {
    getCurrentStaff.mockResolvedValue(null)

    const result = await markBookingPaid(VALID)

    expect(result).toMatchObject({ success: false, code: 'UNAUTHORIZED' })
    expect(recordPayment).not.toHaveBeenCalled()
  })

  it('attributes the payment to the signed-in staff member', async () => {
    await markBookingPaid(VALID)

    expect(recordPayment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ recordedBy: 'staff-1', status: 'paid' }),
    )
  })

  it('ignores a recordedBy supplied by the client, so a payment cannot be pinned on someone else', async () => {
    await markBookingPaid({ ...VALID, recordedBy: 'staff-999' })

    expect(recordPayment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ recordedBy: 'staff-1' }),
    )
  })

  it('confirms the booking once the payment is recorded', async () => {
    const result = await markBookingPaid(VALID)

    expect(updateBookingStatus).toHaveBeenCalledWith(expect.anything(), BOOKING_ID, 'confirmed')
    expect(result).toMatchObject({ success: true })
  })

  it('rejects an amount of zero or less before touching the database', async () => {
    const result = await markBookingPaid({ ...VALID, amountCents: 0 })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
    expect(recordPayment).not.toHaveBeenCalled()
  })

  it('rejects a payment method the database does not define', async () => {
    const result = await markBookingPaid({ ...VALID, method: 'crypto' })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
    expect(recordPayment).not.toHaveBeenCalled()
  })

  it('leaves the booking alone when recording the payment fails', async () => {
    recordPayment.mockRejectedValue(new Error('insert failed'))

    const result = await markBookingPaid(VALID)

    expect(result).toMatchObject({ success: false })
    expect(updateBookingStatus).not.toHaveBeenCalled()
  })
})

describe('refundBookingPayment', () => {
  it('refuses a caller with no staff session', async () => {
    getCurrentStaff.mockResolvedValue(null)

    const result = await refundBookingPayment({ paymentId: PAYMENT_ID })

    expect(result).toMatchObject({ success: false, code: 'UNAUTHORIZED' })
    expect(markPaymentRefunded).not.toHaveBeenCalled()
  })

  it('marks the payment refunded', async () => {
    const result = await refundBookingPayment({ paymentId: PAYMENT_ID })

    expect(markPaymentRefunded).toHaveBeenCalledWith(expect.anything(), PAYMENT_ID)
    expect(result).toMatchObject({ success: true })
  })

  it('does not cancel the booking, because a refund and a cancellation are separate decisions', async () => {
    await refundBookingPayment({ paymentId: PAYMENT_ID })

    expect(updateBookingStatus).not.toHaveBeenCalled()
  })

  it('rejects a payment id that is not a uuid', async () => {
    const result = await refundBookingPayment({ paymentId: 'not-a-uuid' })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
    expect(markPaymentRefunded).not.toHaveBeenCalled()
  })
})

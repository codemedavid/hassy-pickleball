import { beforeEach, describe, expect, it, vi } from 'vitest'

const getCurrentStaff = vi.fn()
const createSupabaseServerClient = vi.fn()
const loadBookingDetail = vi.fn()
const updateBookingStatus = vi.fn()

vi.mock('@/lib/auth/staff', () => ({ getCurrentStaff }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient }))
vi.mock('@/lib/repositories/bookings', () => ({ loadBookingDetail, updateBookingStatus }))

const { setBookingStatus } = await import('./bookings')

/**
 * The desk's control over a booking's life: confirm it, cancel it, mark it
 * done. The guarantees worth having are that the caller cannot choose an
 * illegal jump, and cannot revive a booking whose slot may have been resold.
 */

const STAFF = {
  id: 'staff-1',
  userId: 'user-1',
  clubId: 'club-1',
  role: 'staff' as const,
  fullName: 'Mika Reyes',
}

const BOOKING_ID = '11111111-1111-4111-8111-111111111111'

function detailWith(status: string) {
  return { booking: { id: BOOKING_ID, status }, segments: [], items: [], payments: [] }
}

beforeEach(() => {
  vi.clearAllMocks()
  createSupabaseServerClient.mockResolvedValue({})
  getCurrentStaff.mockResolvedValue(STAFF)
  loadBookingDetail.mockResolvedValue(detailWith('awaiting_payment'))
  updateBookingStatus.mockImplementation((_client, id, status) => ({ id, status }))
})

describe('setBookingStatus', () => {
  it('refuses a caller with no staff session and never writes', async () => {
    getCurrentStaff.mockResolvedValue(null)

    const result = await setBookingStatus({ bookingId: BOOKING_ID, status: 'confirmed' })

    expect(result).toMatchObject({ success: false, code: 'UNAUTHORIZED' })
    expect(updateBookingStatus).not.toHaveBeenCalled()
  })

  it('rejects a payload that is not a booking id', async () => {
    const result = await setBookingStatus({ bookingId: 'not-a-uuid', status: 'confirmed' })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
    expect(updateBookingStatus).not.toHaveBeenCalled()
  })

  it('rejects a status that is not one the desk can set', async () => {
    const result = await setBookingStatus({ bookingId: BOOKING_ID, status: 'refunded' })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
    expect(updateBookingStatus).not.toHaveBeenCalled()
  })

  it('confirms a booking that is awaiting payment', async () => {
    const result = await setBookingStatus({ bookingId: BOOKING_ID, status: 'confirmed' })

    expect(result).toMatchObject({ success: true, data: { status: 'confirmed' } })
    expect(updateBookingStatus).toHaveBeenCalledWith(expect.anything(), BOOKING_ID, 'confirmed')
  })

  it('completes a confirmed booking once the session has been played', async () => {
    loadBookingDetail.mockResolvedValue(detailWith('confirmed'))

    const result = await setBookingStatus({ bookingId: BOOKING_ID, status: 'completed' })

    expect(result).toMatchObject({ success: true })
    expect(updateBookingStatus).toHaveBeenCalledWith(expect.anything(), BOOKING_ID, 'completed')
  })

  it('cancels a confirmed booking', async () => {
    loadBookingDetail.mockResolvedValue(detailWith('confirmed'))

    const result = await setBookingStatus({ bookingId: BOOKING_ID, status: 'cancelled' })

    expect(result).toMatchObject({ success: true })
  })

  it('refuses to complete a booking that was never confirmed', async () => {
    loadBookingDetail.mockResolvedValue(detailWith('pending'))

    const result = await setBookingStatus({ bookingId: BOOKING_ID, status: 'completed' })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
    expect(updateBookingStatus).not.toHaveBeenCalled()
  })

  // Reviving a cancelled booking re-arms booking_courts_no_double_booking
  // against a slot that may have been resold in the meantime. The desk rebooks
  // instead, which goes through the availability check like any other booking.
  it('refuses to revive a cancelled booking', async () => {
    loadBookingDetail.mockResolvedValue(detailWith('cancelled'))

    const result = await setBookingStatus({ bookingId: BOOKING_ID, status: 'confirmed' })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
    expect(updateBookingStatus).not.toHaveBeenCalled()
  })

  it('refuses to reopen a completed booking', async () => {
    loadBookingDetail.mockResolvedValue(detailWith('completed'))

    const result = await setBookingStatus({ bookingId: BOOKING_ID, status: 'cancelled' })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
    expect(updateBookingStatus).not.toHaveBeenCalled()
  })

  it('treats setting the status it already has as nothing to do', async () => {
    loadBookingDetail.mockResolvedValue(detailWith('confirmed'))

    const result = await setBookingStatus({ bookingId: BOOKING_ID, status: 'confirmed' })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
    expect(updateBookingStatus).not.toHaveBeenCalled()
  })

  it('reports a booking that is not there rather than writing blind', async () => {
    loadBookingDetail.mockResolvedValue(null)

    const result = await setBookingStatus({ bookingId: BOOKING_ID, status: 'confirmed' })

    expect(result).toMatchObject({ success: false })
    expect(updateBookingStatus).not.toHaveBeenCalled()
  })

  // The transition is decided against the stored row, never the caller's claim:
  // two staff acting at once must not both get to confirm from a stale screen.
  it('reads the current status from the database, not from the payload', async () => {
    await setBookingStatus({
      bookingId: BOOKING_ID,
      status: 'confirmed',
      currentStatus: 'pending',
    })

    expect(loadBookingDetail).toHaveBeenCalledWith(expect.anything(), BOOKING_ID)
  })
})

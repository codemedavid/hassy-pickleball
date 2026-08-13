import { beforeEach, describe, expect, it, vi } from 'vitest'

const createBooking = vi.fn()
const findActivePaymentMethod = vi.fn()
const attachPaymentProof = vi.fn()
const uploadPaymentProof = vi.fn()

vi.mock('@/features/booking/server/create-booking', () => ({ createBooking }))
vi.mock('@/lib/repositories/payment-methods', () => ({ findActivePaymentMethod }))
vi.mock('@/lib/repositories/payments', () => ({ attachPaymentProof }))
vi.mock('./proof-storage', () => ({ uploadPaymentProof }))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({}) }))

const { submitCheckout } = await import('./submit-checkout')

const CLUB_ID = '11111111-1111-4111-8111-111111111111'
const COURT_ID = '22222222-2222-4222-8222-222222222222'
const METHOD_ID = '33333333-3333-4333-8333-333333333333'

const GCASH = {
  id: METHOD_ID,
  clubId: CLUB_ID,
  method: 'gcash' as const,
  label: 'GCash',
  accountName: 'Baseline Pickleball Club',
  accountNumber: '0917 123 4567',
  instructions: 'Send the exact total.',
  qrImageUrl: null,
  requiresProof: true,
  sortOrder: 1,
  isActive: true,
}

const CASH = {
  ...GCASH,
  id: METHOD_ID,
  method: 'cash' as const,
  label: 'Pay at the desk',
  requiresProof: false,
}

const BOOKING = {
  id: 'booking-1',
  reference: 'PB-4G6JVH',
  status: 'awaiting_payment',
  totalCents: 90000,
}

function order() {
  return {
    clubId: CLUB_ID,
    contactName: 'Ana Cruz',
    contactEmail: 'ana@example.com',
    contactPhone: '0917 123 4567',
    paymentMethodId: METHOD_ID,
    notes: null,
    courts: [
      {
        courtId: COURT_ID,
        startsAt: '2026-03-16T02:00:00.000Z',
        endsAt: '2026-03-16T03:00:00.000Z',
      },
    ],
    items: [],
    players: ['Ana Cruz', 'Ben Uy'],
  }
}

/**
 * A real File, because FormData is the thing under test here: setting a
 * plain object on a form field stringifies it, which is exactly the case
 * `readProof` has to reject.
 */
function proofFile(overrides: { type?: string; size?: number } = {}) {
  const size = overrides.size ?? 120_000

  return new File([new Uint8Array(size)], 'receipt.png', {
    type: overrides.type ?? 'image/png',
  })
}

function formDataFor(input: unknown, proof?: File): FormData {
  const form = new FormData()
  form.set('order', JSON.stringify(input))

  if (proof) {
    form.set('proof', proof)
  }

  return form
}

beforeEach(() => {
  vi.clearAllMocks()
  findActivePaymentMethod.mockResolvedValue(GCASH)
  createBooking.mockResolvedValue({ success: true, data: BOOKING })
  uploadPaymentProof.mockResolvedValue({
    success: true,
    data: '/payment-proofs/PB-4G6JVH/proof.png',
  })
  attachPaymentProof.mockResolvedValue(undefined)
})

describe('submitCheckout', () => {
  it('returns the reservation number so the thank-you screen can show it', async () => {
    const result = await submitCheckout(formDataFor(order(), proofFile()))

    expect(result).toMatchObject({
      success: true,
      data: { reference: 'PB-4G6JVH', totalCents: 90000, paymentMethodLabel: 'GCash' },
    })
  })

  it('passes the contact name and phone through to the booking', async () => {
    await submitCheckout(formDataFor(order(), proofFile()))

    expect(createBooking).toHaveBeenCalledWith(
      expect.objectContaining({ contactName: 'Ana Cruz', contactPhone: '0917 123 4567' }),
    )
  })

  it('records the booking against the settlement channel the chosen method maps to', async () => {
    await submitCheckout(formDataFor(order(), proofFile()))

    expect(createBooking).toHaveBeenCalledWith(expect.objectContaining({ paymentMethod: 'gcash' }))
  })

  it('passes the named players through to booking creation', async () => {
    await submitCheckout(formDataFor(order(), proofFile()))

    expect(createBooking).toHaveBeenCalledWith(
      expect.objectContaining({ players: ['Ana Cruz', 'Ben Uy'] }),
    )
  })

  it('rejects a payment method that is not an active method of this club', async () => {
    findActivePaymentMethod.mockResolvedValue(null)

    const result = await submitCheckout(formDataFor(order(), proofFile()))

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
    expect(createBooking).not.toHaveBeenCalled()
  })

  it('refuses to book when a proof-required method arrives without a screenshot', async () => {
    const result = await submitCheckout(formDataFor(order()))

    expect(result).toMatchObject({ success: false })
    expect(result.success === false && result.error).toMatch(/screenshot|proof/i)
    expect(createBooking).not.toHaveBeenCalled()
  })

  it('refuses a proof that is not an image, before any booking is written', async () => {
    const result = await submitCheckout(
      formDataFor(order(), proofFile({ type: 'application/pdf' })),
    )

    expect(result).toMatchObject({ success: false })
    expect(createBooking).not.toHaveBeenCalled()
  })

  it('books without a proof when the method does not require one', async () => {
    findActivePaymentMethod.mockResolvedValue(CASH)

    const result = await submitCheckout(formDataFor(order()))

    expect(result).toMatchObject({ success: true, data: { proofAttached: false } })
    expect(uploadPaymentProof).not.toHaveBeenCalled()
  })

  it('stores the proof under the reference the booking came back with', async () => {
    await submitCheckout(formDataFor(order(), proofFile()))

    expect(uploadPaymentProof).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: 'PB-4G6JVH',
        extension: 'png',
        contentType: 'image/png',
      }),
    )
    // The payment row records whatever path the store came back with.
    expect(attachPaymentProof).toHaveBeenCalledWith(
      expect.anything(),
      'booking-1',
      '/payment-proofs/PB-4G6JVH/proof.png',
    )
  })

  it('surfaces a failed booking rather than pretending it succeeded', async () => {
    createBooking.mockResolvedValue({
      success: false,
      error: 'Someone just took that slot. Please pick another time.',
      code: 'SLOT_TAKEN',
    })

    const result = await submitCheckout(formDataFor(order(), proofFile()))

    expect(result).toMatchObject({ success: false, code: 'SLOT_TAKEN' })
    expect(uploadPaymentProof).not.toHaveBeenCalled()
  })

  it('keeps the reservation when the upload fails, and says the proof did not attach', async () => {
    uploadPaymentProof.mockResolvedValue({ success: false, error: 'storage down' })

    const result = await submitCheckout(formDataFor(order(), proofFile()))

    // The court is held. Losing that because a screenshot did not upload would
    // be a worse outcome than telling the guest to send it to the desk.
    expect(result).toMatchObject({
      success: true,
      data: { reference: 'PB-4G6JVH', proofAttached: false },
    })
    expect(attachPaymentProof).not.toHaveBeenCalled()
  })

  it('rejects a malformed order payload without touching the database', async () => {
    const form = new FormData()
    form.set('order', 'not json')

    const result = await submitCheckout(form)

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
    expect(findActivePaymentMethod).not.toHaveBeenCalled()
  })

  it('rejects a checkout with no phone number', async () => {
    const result = await submitCheckout(formDataFor({ ...order(), contactPhone: '' }, proofFile()))

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
    expect(createBooking).not.toHaveBeenCalled()
  })
})

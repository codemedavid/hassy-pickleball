import { beforeEach, describe, expect, it, vi } from 'vitest'

const getCurrentStaff = vi.fn()
const createSupabaseServerClient = vi.fn()
const createPaymentMethod = vi.fn()
const findPaymentMethod = vi.fn()
const listAllPaymentMethods = vi.fn()
const updatePaymentMethod = vi.fn()
const movePaymentMethod = vi.fn()
const setPaymentMethodActive = vi.fn()

vi.mock('@/lib/auth/staff', () => ({ getCurrentStaff }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient }))
vi.mock('@/lib/repositories/payment-methods', () => ({
  createPaymentMethod,
  findPaymentMethod,
  listAllPaymentMethods,
  updatePaymentMethod,
  movePaymentMethod,
  setPaymentMethodActive,
}))

const { movePublishedPaymentMethod, savePaymentMethod } = await import('./payment-methods')

const STAFF = {
  id: 'staff-1',
  userId: 'user-1',
  clubId: 'club-1',
  role: 'admin' as const,
  fullName: 'Mika Reyes',
}

const METHOD_ID = '55555555-5555-4555-8555-555555555555'
const OTHER_METHOD_ID = '66666666-6666-4666-8666-666666666666'

const gcash = {
  id: METHOD_ID,
  clubId: 'club-1',
  method: 'gcash' as const,
  label: 'GCash',
  accountName: 'Baseline Pickleball Club',
  accountNumber: '0917 123 4567',
  instructions: 'Send the exact total.',
  qrImageUrl: null,
  requiresProof: true,
  sortOrder: 2,
  isActive: true,
}

const cash = {
  ...gcash,
  id: OTHER_METHOD_ID,
  method: 'cash' as const,
  label: 'Pay at the desk',
  accountName: null,
  accountNumber: null,
  instructions: 'Arrive ten minutes early.',
  requiresProof: false,
  sortOrder: 1,
}

const NEW_METHOD = {
  method: 'bank_transfer',
  label: 'Bank transfer',
  accountName: 'Baseline Pickleball Club',
  accountNumber: '1234-5678-90',
  instructions: 'Upload the transfer receipt.',
  qrImageUrl: null,
  requiresProof: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  getCurrentStaff.mockResolvedValue(STAFF)
  createSupabaseServerClient.mockResolvedValue({})
  listAllPaymentMethods.mockResolvedValue([cash, gcash])
  findPaymentMethod.mockResolvedValue(gcash)
  createPaymentMethod.mockResolvedValue({ ...gcash, ...NEW_METHOD, sortOrder: 3 })
  updatePaymentMethod.mockResolvedValue(gcash)
  movePaymentMethod.mockResolvedValue(undefined)
  setPaymentMethodActive.mockResolvedValue(gcash)
})

describe('savePaymentMethod — create', () => {
  it('adds a method after the current last position for the signed-in club', async () => {
    await savePaymentMethod(NEW_METHOD)

    expect(createPaymentMethod).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ clubId: 'club-1', sortOrder: 3 }),
    )
  })

  it('does not trust a club id supplied by the browser', async () => {
    await savePaymentMethod({ ...NEW_METHOD, clubId: 'other-club' })

    expect(createPaymentMethod).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ clubId: 'club-1' }),
    )
  })

  it('requires a staff session', async () => {
    getCurrentStaff.mockResolvedValue(null)

    const result = await savePaymentMethod(NEW_METHOD)

    expect(result).toMatchObject({ success: false, code: 'UNAUTHORIZED' })
    expect(createPaymentMethod).not.toHaveBeenCalled()
  })
})

describe('savePaymentMethod — patch', () => {
  it('looks up the target under the signed-in club before updating it', async () => {
    await savePaymentMethod({ id: METHOD_ID, label: 'GCash wallet' })

    expect(findPaymentMethod).toHaveBeenCalledWith(expect.anything(), 'club-1', METHOD_ID)
    expect(updatePaymentMethod).toHaveBeenCalledWith(expect.anything(), METHOD_ID, {
      label: 'GCash wallet',
    })
  })

  it('refuses an edit that would remove every piece of payment guidance', async () => {
    const result = await savePaymentMethod({
      id: METHOD_ID,
      accountName: null,
      accountNumber: null,
      instructions: null,
      qrImageUrl: null,
    })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
    expect(updatePaymentMethod).not.toHaveBeenCalled()
  })

  it('allows text guidance to be removed when a QR image remains', async () => {
    findPaymentMethod.mockResolvedValue({ ...gcash, qrImageUrl: 'https://ik.test/qr.png' })

    const result = await savePaymentMethod({
      id: METHOD_ID,
      accountName: null,
      accountNumber: null,
      instructions: null,
    })

    expect(result.success).toBe(true)
    expect(updatePaymentMethod).toHaveBeenCalled()
  })

  it('requires acknowledgement before hiding the final active method', async () => {
    listAllPaymentMethods.mockResolvedValue([gcash, { ...cash, isActive: false }])

    const result = await savePaymentMethod({ id: METHOD_ID, isActive: false })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
    expect(updatePaymentMethod).not.toHaveBeenCalled()
  })

  it('hides the final method after explicit acknowledgement', async () => {
    listAllPaymentMethods.mockResolvedValue([gcash])

    const result = await savePaymentMethod({
      id: METHOD_ID,
      isActive: false,
      acknowledgeCheckoutPause: true,
    })

    expect(result.success).toBe(true)
    expect(setPaymentMethodActive).toHaveBeenCalledWith(expect.anything(), METHOD_ID, false, true)
  })

  it('restores a hidden method without requiring acknowledgement', async () => {
    findPaymentMethod.mockResolvedValue({ ...gcash, isActive: false })

    await savePaymentMethod({ id: METHOD_ID, isActive: true })

    expect(setPaymentMethodActive).toHaveBeenCalledWith(expect.anything(), METHOD_ID, true, false)
  })
})

describe('movePublishedPaymentMethod', () => {
  it('verifies club ownership before invoking the atomic move', async () => {
    const result = await movePublishedPaymentMethod({ id: METHOD_ID, direction: 'up' })

    expect(findPaymentMethod).toHaveBeenCalledWith(expect.anything(), 'club-1', METHOD_ID)
    expect(movePaymentMethod).toHaveBeenCalledWith(expect.anything(), METHOD_ID, 'up')
    expect(result).toMatchObject({ success: true, data: { id: METHOD_ID } })
  })

  it('refuses an unknown target instead of moving across clubs', async () => {
    findPaymentMethod.mockResolvedValue(null)

    const result = await movePublishedPaymentMethod({ id: METHOD_ID, direction: 'down' })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
    expect(movePaymentMethod).not.toHaveBeenCalled()
  })
})

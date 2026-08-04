import { beforeEach, describe, expect, it, vi } from 'vitest'

const getCurrentStaff = vi.fn()
const createSupabaseServerClient = vi.fn()
const createAvailabilityBlock = vi.fn()
const deleteAvailabilityBlock = vi.fn()

vi.mock('@/lib/auth/staff', () => ({ getCurrentStaff }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient }))
vi.mock('@/lib/repositories/blocks', () => ({ createAvailabilityBlock, deleteAvailabilityBlock }))

const { blockCourtTime, removeCourtBlock } = await import('./blocks')
const { RepositoryError } = await import('@/lib/repositories/support')

const STAFF = {
  id: 'staff-1',
  userId: 'user-1',
  clubId: 'club-1',
  role: 'staff' as const,
  fullName: 'Mika Reyes',
}

const COURT_ID = '33333333-3333-4333-8333-333333333333'
const BLOCK_ID = '44444444-4444-4444-8444-444444444444'

const VALID = {
  courtId: COURT_ID,
  kind: 'maintenance',
  reason: 'Resurfacing',
  startsAt: '2026-03-01T02:00:00.000Z',
  endsAt: '2026-03-01T06:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  createSupabaseServerClient.mockResolvedValue({})
  getCurrentStaff.mockResolvedValue(STAFF)
  createAvailabilityBlock.mockResolvedValue({ id: BLOCK_ID, courtId: COURT_ID })
  deleteAvailabilityBlock.mockResolvedValue(undefined)
})

describe('blockCourtTime', () => {
  it('refuses a caller with no staff session and never writes a block', async () => {
    getCurrentStaff.mockResolvedValue(null)

    const result = await blockCourtTime(VALID)

    expect(result).toMatchObject({ success: false, code: 'UNAUTHORIZED' })
    expect(createAvailabilityBlock).not.toHaveBeenCalled()
  })

  it('records who created the block from the session, not from the request body', async () => {
    await blockCourtTime({ ...VALID, createdBy: 'staff-999' })

    expect(createAvailabilityBlock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ createdBy: 'staff-1' }),
    )
  })

  it('rejects a window that ends before it starts', async () => {
    const result = await blockCourtTime({
      ...VALID,
      startsAt: '2026-03-01T06:00:00.000Z',
      endsAt: '2026-03-01T02:00:00.000Z',
    })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
    expect(createAvailabilityBlock).not.toHaveBeenCalled()
  })

  it('rejects a zero-length window, which would hold nothing', async () => {
    const result = await blockCourtTime({ ...VALID, endsAt: VALID.startsAt })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
  })

  it('rejects a block kind the database does not define', async () => {
    const result = await blockCourtTime({ ...VALID, kind: 'party' })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
  })

  it('passes the window through as real dates', async () => {
    await blockCourtTime(VALID)

    expect(createAvailabilityBlock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        startsAt: new Date(VALID.startsAt),
        endsAt: new Date(VALID.endsAt),
      }),
    )
  })

  it('reports a clash as a conflict rather than a database failure', async () => {
    createAvailabilityBlock.mockRejectedValue(
      new RepositoryError('conflicting key value violates exclusion constraint', '23P01'),
    )

    const result = await blockCourtTime(VALID)

    expect(result).toMatchObject({ success: false, code: 'CONFLICT' })
  })
})

describe('removeCourtBlock', () => {
  it('refuses a caller with no staff session', async () => {
    getCurrentStaff.mockResolvedValue(null)

    const result = await removeCourtBlock({ blockId: BLOCK_ID })

    expect(result).toMatchObject({ success: false, code: 'UNAUTHORIZED' })
    expect(deleteAvailabilityBlock).not.toHaveBeenCalled()
  })

  it('deletes the block', async () => {
    const result = await removeCourtBlock({ blockId: BLOCK_ID })

    expect(deleteAvailabilityBlock).toHaveBeenCalledWith(expect.anything(), BLOCK_ID)
    expect(result).toMatchObject({ success: true })
  })

  it('rejects a block id that is not a uuid', async () => {
    const result = await removeCourtBlock({ blockId: 'nope' })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
    expect(deleteAvailabilityBlock).not.toHaveBeenCalled()
  })
})

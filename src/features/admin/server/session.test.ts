import { beforeEach, describe, expect, it, vi } from 'vitest'

const getCurrentStaff = vi.fn()
const createSupabaseServerClient = vi.fn()

vi.mock('@/lib/auth/staff', () => ({ getCurrentStaff }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient }))

const { withStaff } = await import('./session')
const { RepositoryError } = await import('@/lib/repositories/support')

const STAFF = {
  id: 'staff-1',
  userId: 'user-1',
  clubId: 'club-1',
  role: 'staff' as const,
  fullName: 'Mika Reyes',
}

const CLIENT = { marker: 'request-scoped' }

beforeEach(() => {
  vi.clearAllMocks()
  createSupabaseServerClient.mockResolvedValue(CLIENT)
})

describe('withStaff', () => {
  it('refuses when nobody is signed in, and never runs the operation', async () => {
    getCurrentStaff.mockResolvedValue(null)
    const run = vi.fn()

    const result = await withStaff(run)

    expect(result).toMatchObject({ success: false, code: 'UNAUTHORIZED' })
    expect(run).not.toHaveBeenCalled()
  })

  it('hands the operation the signed-in staff member and a request-scoped client', async () => {
    getCurrentStaff.mockResolvedValue(STAFF)

    const result = await withStaff(async ({ staff, client }) => ({
      staffId: staff.id,
      clubId: staff.clubId,
      sawClient: (client as unknown) === CLIENT,
    }))

    expect(result).toEqual({
      success: true,
      data: { staffId: 'staff-1', clubId: 'club-1', sawClient: true },
    })
  })

  it('turns a slot clash into a conflict the staff member can act on', async () => {
    getCurrentStaff.mockResolvedValue(STAFF)

    const result = await withStaff(async () => {
      throw new RepositoryError('conflicting key value violates exclusion constraint', '23P01')
    })

    expect(result).toMatchObject({ success: false, code: 'CONFLICT' })
  })

  it('never returns the raw database message, which names relations and constraints', async () => {
    getCurrentStaff.mockResolvedValue(STAFF)

    const result = await withStaff(async () => {
      throw new RepositoryError('relation "payments" violates fk payments_booking_id_fkey', '23503')
    })

    expect(result).toMatchObject({ success: false, code: 'DB_ERROR' })
    if (result.success) return
    expect(result.error).not.toContain('payments_booking_id_fkey')
  })
})

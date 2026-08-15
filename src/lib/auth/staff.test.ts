import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeClient, fakeTable, callsFor, type FakeResult } from '../../../test/postgrest-fake'

const getUser = vi.fn()
const createSupabaseServerClient = vi.fn()

vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient }))

const { getCurrentStaff, getStaffAccess } = await import('./staff')

const STAFF_ROW = {
  id: 'staff-1',
  user_id: 'user-1',
  club_id: 'club-1',
  role: 'admin',
  full_name: 'Mika Reyes',
}

function clientReturning(result: FakeResult) {
  const staff = fakeTable(result)
  const client = fakeClient({ staff })

  return { client: { ...client, auth: { getUser } }, staff }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getCurrentStaff', () => {
  it('returns null when nobody is signed in', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const { client, staff } = clientReturning({ data: STAFF_ROW, error: null })
    createSupabaseServerClient.mockResolvedValue(client)

    expect(await getCurrentStaff()).toBeNull()
    // No point querying staff for a request that has no user.
    expect(callsFor(staff, 'select')).toHaveLength(0)
  })

  it('revalidates the user against the auth server rather than trusting the cookie', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const { client } = clientReturning({ data: STAFF_ROW, error: null })
    createSupabaseServerClient.mockResolvedValue(client)

    await getCurrentStaff()

    expect(getUser).toHaveBeenCalled()
  })

  it('returns the staff record for a signed-in staff member', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const { client } = clientReturning({ data: STAFF_ROW, error: null })
    createSupabaseServerClient.mockResolvedValue(client)

    const staff = await getCurrentStaff()

    expect(staff).toEqual({
      id: 'staff-1',
      userId: 'user-1',
      clubId: 'club-1',
      role: 'admin',
      fullName: 'Mika Reyes',
    })
  })

  it('only matches an active staff row, so a revoked member loses access', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const { client, staff } = clientReturning({ data: STAFF_ROW, error: null })
    createSupabaseServerClient.mockResolvedValue(client)

    await getCurrentStaff()

    expect(callsFor(staff, 'eq')).toContainEqual(
      expect.objectContaining({ args: ['is_active', true] }),
    )
  })

  it('scopes the lookup to the signed-in user, never to an arbitrary id', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const { client, staff } = clientReturning({ data: STAFF_ROW, error: null })
    createSupabaseServerClient.mockResolvedValue(client)

    await getCurrentStaff()

    expect(callsFor(staff, 'eq')).toContainEqual(
      expect.objectContaining({ args: ['user_id', 'user-1'] }),
    )
  })

  it('returns null when the signed-in user has no staff row', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const { client } = clientReturning({ data: null, error: null })
    createSupabaseServerClient.mockResolvedValue(client)

    expect(await getCurrentStaff()).toBeNull()
  })

  it('fails closed when the staff query errors, rather than granting access', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const { client } = clientReturning({ data: STAFF_ROW, error: { message: 'rls denied' } })
    createSupabaseServerClient.mockResolvedValue(client)

    expect(await getCurrentStaff()).toBeNull()
  })
})

/**
 * The two ways to have no staff record are not the same problem. Nobody signed
 * in should be asked to sign in; someone already signed in should not be, or
 * they are sent back to a form they have just completed and the console looks
 * broken rather than closed.
 */
describe('getStaffAccess', () => {
  it('reports anonymous when nobody is signed in', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const { client } = clientReturning({ data: STAFF_ROW, error: null })
    createSupabaseServerClient.mockResolvedValue(client)

    expect(await getStaffAccess()).toEqual({ status: 'anonymous' })
  })

  it('separates a signed-in non-staff user from an anonymous one', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const { client } = clientReturning({ data: null, error: null })
    createSupabaseServerClient.mockResolvedValue(client)

    expect(await getStaffAccess()).toEqual({ status: 'not-staff' })
  })

  it('carries the staff record when the signed-in user is staff', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const { client } = clientReturning({ data: STAFF_ROW, error: null })
    createSupabaseServerClient.mockResolvedValue(client)

    expect(await getStaffAccess()).toEqual({
      status: 'staff',
      staff: {
        id: 'staff-1',
        userId: 'user-1',
        clubId: 'club-1',
        role: 'admin',
        fullName: 'Mika Reyes',
      },
    })
  })

  it('fails closed to not-staff when the lookup errors', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const { client } = clientReturning({ data: STAFF_ROW, error: { message: 'rls denied' } })
    createSupabaseServerClient.mockResolvedValue(client)

    expect(await getStaffAccess()).toEqual({ status: 'not-staff' })
  })
})

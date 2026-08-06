import { beforeEach, describe, expect, it, vi } from 'vitest'

const getCurrentStaff = vi.fn()
const createSupabaseServerClient = vi.fn()
const createCourt = vi.fn()
const updateCourt = vi.fn()

vi.mock('@/lib/auth/staff', () => ({ getCurrentStaff }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient }))
vi.mock('@/lib/repositories/courts', () => ({ createCourt, updateCourt }))

const { saveCourt } = await import('./courts')

const STAFF = {
  id: 'staff-1',
  userId: 'user-1',
  clubId: 'club-1',
  role: 'admin' as const,
  fullName: 'Mika Reyes',
}

const COURT_ID = '88888888-8888-4888-8888-888888888888'
const OTHER_CLUB = '77777777-7777-4777-8777-777777777777'

const NEW_COURT = {
  name: 'Court 4 — Riverside',
  slug: 'court-4-riverside',
  surface: 'Cushioned acrylic',
  environment: 'outdoor',
  isTournamentGrade: false,
  blurb: 'Sunset side',
  notes: ['Non-marking shoes required'],
  tags: ['Outdoor'],
  includes: ['Net and posts'],
  heroImageUrl: null,
  basePriceCents: 60_000,
  sortOrder: 4,
  minPlayers: 2,
  maxPlayers: 4,
}

beforeEach(() => {
  vi.clearAllMocks()
  createSupabaseServerClient.mockResolvedValue({})
  getCurrentStaff.mockResolvedValue(STAFF)
  createCourt.mockResolvedValue({ id: COURT_ID })
  updateCourt.mockResolvedValue({ id: COURT_ID })
})

describe('saveCourt', () => {
  it('refuses a caller with no staff session', async () => {
    getCurrentStaff.mockResolvedValue(null)

    const result = await saveCourt(NEW_COURT)

    expect(result).toMatchObject({ success: false, code: 'UNAUTHORIZED' })
    expect(createCourt).not.toHaveBeenCalled()
  })

  it('creates the court under the club the staff member belongs to', async () => {
    await saveCourt(NEW_COURT)

    expect(createCourt).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ clubId: 'club-1', name: 'Court 4 — Riverside' }),
    )
  })

  it('ignores a clubId in the request, so staff cannot write into another club', async () => {
    await saveCourt({ ...NEW_COURT, clubId: OTHER_CLUB })

    expect(createCourt).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ clubId: 'club-1' }),
    )
  })

  it('patches an existing court when an id is supplied, instead of creating a duplicate', async () => {
    await saveCourt({ id: COURT_ID, basePriceCents: 70_000 })

    expect(createCourt).not.toHaveBeenCalled()
    expect(updateCourt).toHaveBeenCalledWith(expect.anything(), COURT_ID, {
      basePriceCents: 70_000,
    })
  })

  it('sends only the fields the editor changed', async () => {
    await saveCourt({ id: COURT_ID, isActive: false })

    expect(updateCourt).toHaveBeenCalledWith(expect.anything(), COURT_ID, { isActive: false })
  })

  it('rejects a capacity whose maximum is below its minimum', async () => {
    const result = await saveCourt({ ...NEW_COURT, minPlayers: 6, maxPlayers: 4 })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
    expect(createCourt).not.toHaveBeenCalled()
  })

  it('rejects a capacity of zero players, which would make the court unbookable', async () => {
    const result = await saveCourt({ ...NEW_COURT, minPlayers: 0 })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
    expect(createCourt).not.toHaveBeenCalled()
  })

  it('rejects a patch that would invert the capacity band', async () => {
    const result = await saveCourt({ id: COURT_ID, minPlayers: 8, maxPlayers: 2 })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
    expect(updateCourt).not.toHaveBeenCalled()
  })

  it('rejects a negative base price', async () => {
    const result = await saveCourt({ ...NEW_COURT, basePriceCents: -1 })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
  })

  it('rejects an environment the database does not define', async () => {
    const result = await saveCourt({ ...NEW_COURT, environment: 'rooftop' })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
  })

  it('rejects a slug with characters that would not survive a URL', async () => {
    const result = await saveCourt({ ...NEW_COURT, slug: 'Court 4!' })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
    expect(createCourt).not.toHaveBeenCalled()
  })
})

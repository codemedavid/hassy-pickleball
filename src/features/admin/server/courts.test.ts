import { beforeEach, describe, expect, it, vi } from 'vitest'

const getCurrentStaff = vi.fn()
const createSupabaseServerClient = vi.fn()
const createCourt = vi.fn()
const findCourtById = vi.fn()
const updateCourt = vi.fn()
const updateTag = vi.fn()

vi.mock('@/lib/auth/staff', () => ({ getCurrentStaff }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient }))
vi.mock('@/lib/repositories/courts', () => ({ createCourt, findCourtById, updateCourt }))
vi.mock('next/cache', () => ({ updateTag }))

const { saveCourt } = await import('./courts')
const { CATALOG_TAG } = await import('@/features/courts/catalog')

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
  includedPlayers: 4,
  maxPlayers: 6,
  extraPlayerFeeCents: 15_000,
}

beforeEach(() => {
  vi.clearAllMocks()
  createSupabaseServerClient.mockResolvedValue({})
  getCurrentStaff.mockResolvedValue(STAFF)
  createCourt.mockResolvedValue({ id: COURT_ID })
  findCourtById.mockResolvedValue({
    id: COURT_ID,
    clubId: STAFF.clubId,
    isActive: true,
    ...NEW_COURT,
  })
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

  it('rejects an id-only patch as invalid instead of reporting a database failure', async () => {
    const result = await saveCourt({ id: COURT_ID })

    expect(result).toMatchObject({
      success: false,
      code: 'INVALID',
      error: 'Choose at least one court detail to change',
    })
    expect(findCourtById).not.toHaveBeenCalled()
    expect(updateCourt).not.toHaveBeenCalled()
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

  it('rejects a one-sided capacity patch that conflicts with the stored maximum', async () => {
    const result = await saveCourt({ id: COURT_ID, minPlayers: 8 })

    expect(result).toMatchObject({
      success: false,
      code: 'INVALID',
      error: 'The most players cannot be fewer than the fewest',
    })
    expect(updateCourt).not.toHaveBeenCalled()
  })

  it('rejects an included-player patch above the stored court capacity', async () => {
    const result = await saveCourt({ id: COURT_ID, includedPlayers: 9 })

    expect(result).toMatchObject({
      success: false,
      code: 'INVALID',
      error: 'Players covered by the price must sit inside the court capacity',
    })
    expect(updateCourt).not.toHaveBeenCalled()
  })

  it('rejects an included count above what the court seats', async () => {
    // Mirrors courts_included_within_capacity: covering more players than the
    // court holds would make the extra-player fee unreachable.
    const result = await saveCourt({ ...NEW_COURT, includedPlayers: 9, maxPlayers: 6 })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
    expect(createCourt).not.toHaveBeenCalled()
  })

  it('rejects an included count below the fewest players the court takes', async () => {
    const result = await saveCourt({ ...NEW_COURT, minPlayers: 4, includedPlayers: 2 })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
    expect(createCourt).not.toHaveBeenCalled()
  })

  it('rejects a negative extra-player fee', async () => {
    const result = await saveCourt({ ...NEW_COURT, extraPlayerFeeCents: -1 })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
    expect(createCourt).not.toHaveBeenCalled()
  })

  it('accepts a court that charges nothing for extra players', async () => {
    const result = await saveCourt({ ...NEW_COURT, extraPlayerFeeCents: 0 })

    expect(result).toMatchObject({ success: true })
  })

  it('carries the pax pricing through to the repository', async () => {
    await saveCourt(NEW_COURT)

    expect(createCourt).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ includedPlayers: 4, extraPlayerFeeCents: 15_000 }),
    )
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

/**
 * The storefront reads courts through a tag-cached catalog with a TTL, so a
 * saved court that does not drop that entry stays invisible to customers until
 * the TTL happens to expire. See src/features/courts/catalog.ts.
 */
describe('saveCourt cache invalidation', () => {
  it('drops the storefront catalog after creating a court', async () => {
    await saveCourt(NEW_COURT)

    expect(updateTag).toHaveBeenCalledWith(CATALOG_TAG)
  })

  it('drops the storefront catalog after patching a court', async () => {
    await saveCourt({ id: COURT_ID, basePriceCents: 70_000 })

    expect(updateTag).toHaveBeenCalledWith(CATALOG_TAG)
  })

  it('drops the storefront catalog when a court is taken offline', async () => {
    await saveCourt({ id: COURT_ID, isActive: false })

    expect(updateTag).toHaveBeenCalledWith(CATALOG_TAG)
  })

  it('leaves the cache alone when the payload was rejected', async () => {
    await saveCourt({ ...NEW_COURT, slug: 'Court 4!' })

    expect(updateTag).not.toHaveBeenCalled()
  })

  it('leaves the cache alone when the write failed', async () => {
    // Arrange — nothing changed in the database, so nothing is stale.
    updateCourt.mockRejectedValue(new Error('connection reset'))

    // Act
    const result = await saveCourt({ id: COURT_ID, basePriceCents: 70_000 })

    // Assert
    expect(result).toMatchObject({ success: false })
    expect(updateTag).not.toHaveBeenCalled()
  })
})

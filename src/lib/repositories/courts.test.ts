import { describe, expect, it } from 'vitest'
import { callsFor, fakeClient, fakeTable } from '../../../test/postgrest-fake'
import {
  createCourt,
  findCourtById,
  findCourtBySlug,
  listActiveCourts,
  listAllCourts,
  updateCourt,
} from './courts'

const COURT_ROW = {
  id: 'court-1',
  club_id: 'club-1',
  name: 'Court 3',
  slug: 'court-3',
  surface: 'Cushioned acrylic',
  environment: 'outdoor' as const,
  is_tournament_grade: true,
  blurb: null,
  notes: null,
  tags: null,
  includes: null,
  hero_image_url: null,
  base_price_cents: 60000,
  sort_order: 3,
  is_active: true,
  min_players: 2,
  max_players: 4,
  included_players: 4,
  extra_player_fee_cents: 0,
}

const CREATE_INPUT = {
  clubId: 'club-1',
  name: 'Court 3',
  slug: 'court-3',
  surface: 'Cushioned acrylic',
  environment: 'outdoor' as const,
  isTournamentGrade: true,
  blurb: null,
  notes: [],
  tags: [],
  includes: [],
  heroImageUrl: null,
  basePriceCents: 60_000,
  sortOrder: 3,
  minPlayers: 2,
  maxPlayers: 4,
  includedPlayers: 4,
  extraPlayerFeeCents: 0,
}

describe('listActiveCourts', () => {
  it('filters to the club and to active rows, ordered by sort_order', async () => {
    const courts = fakeTable({ data: [], error: null })

    await listActiveCourts(fakeClient({ courts }), 'club-1')

    expect(courts.calls).toEqual([
      { method: 'select', args: ['*'] },
      { method: 'eq', args: ['club_id', 'club-1'] },
      { method: 'eq', args: ['is_active', true] },
      { method: 'order', args: ['sort_order', { ascending: true }] },
    ])
  })

  it('returns an empty array when the query yields null data', async () => {
    const client = fakeClient({ courts: fakeTable({ data: null, error: null }) })

    expect(await listActiveCourts(client, 'club-1')).toEqual([])
  })

  it('substitutes empty arrays for null tag columns so callers need no guard', async () => {
    const client = fakeClient({ courts: fakeTable({ data: [COURT_ROW], error: null }) })

    const [court] = await listActiveCourts(client, 'club-1')

    expect(court?.tags).toEqual([])
    expect(court?.includes).toEqual([])
  })

  it('throws with context when the query errors', async () => {
    const client = fakeClient({ courts: fakeTable({ data: null, error: { message: 'nope' } }) })

    await expect(listActiveCourts(client, 'club-1')).rejects.toThrow(/Failed to load courts: nope/)
  })
})

describe('findCourtBySlug', () => {
  it('scopes the slug to the club, because slugs are only unique per club', async () => {
    const courts = fakeTable({ data: COURT_ROW, error: null })

    await findCourtBySlug(fakeClient({ courts }), 'club-1', 'court-3')

    expect(courts.calls).toContainEqual({ method: 'eq', args: ['club_id', 'club-1'] })
    expect(courts.calls).toContainEqual({ method: 'eq', args: ['slug', 'court-3'] })
  })

  it('does not return a court that has been deactivated', async () => {
    const courts = fakeTable({ data: null, error: null })

    await findCourtBySlug(fakeClient({ courts }), 'club-1', 'court-3')

    expect(courts.calls).toContainEqual({ method: 'eq', args: ['is_active', true] })
  })

  it('returns null when the slug is unknown', async () => {
    const client = fakeClient({ courts: fakeTable({ data: null, error: null }) })

    expect(await findCourtBySlug(client, 'club-1', 'ghost')).toBeNull()
  })

  it('throws with context when the query errors', async () => {
    const client = fakeClient({ courts: fakeTable({ data: null, error: { message: 'x' } }) })

    await expect(findCourtBySlug(client, 'club-1', 'court-3')).rejects.toThrow(
      /Failed to load court/,
    )
  })
})

describe('findCourtById', () => {
  it('scopes the id to the staff member’s club and includes offline courts', async () => {
    const courts = fakeTable({ data: COURT_ROW, error: null })

    await findCourtById(fakeClient({ courts }), 'club-1', 'court-1')

    expect(courts.calls).toContainEqual({ method: 'eq', args: ['club_id', 'club-1'] })
    expect(courts.calls).toContainEqual({ method: 'eq', args: ['id', 'court-1'] })
    expect(courts.calls).not.toContainEqual({ method: 'eq', args: ['is_active', true] })
  })
})

describe('listAllCourts', () => {
  it('includes deactivated courts, because the admin editor must show them', async () => {
    const courts = fakeTable({ data: [COURT_ROW], error: null })

    await listAllCourts(fakeClient({ courts }), 'club-1')

    expect(courts.calls).not.toContainEqual({ method: 'eq', args: ['is_active', true] })
    expect(courts.calls).toContainEqual({ method: 'eq', args: ['club_id', 'club-1'] })
  })

  it('throws with context when the query errors', async () => {
    const client = fakeClient({ courts: fakeTable({ data: null, error: { message: 'x' } }) })

    await expect(listAllCourts(client, 'club-1')).rejects.toThrow(/Failed to load courts/)
  })
})

describe('createCourt', () => {
  it('writes the court against the club with snake_case columns', async () => {
    const courts = fakeTable({ data: COURT_ROW, error: null })

    await createCourt(fakeClient({ courts }), CREATE_INPUT)

    expect(callsFor(courts, 'insert')[0]?.args[0]).toMatchObject({
      club_id: 'club-1',
      name: 'Court 3',
      slug: 'court-3',
      base_price_cents: 60_000,
      min_players: 2,
      max_players: 4,
    })
  })

  it('throws with context when the insert errors', async () => {
    const client = fakeClient({ courts: fakeTable({ data: null, error: { message: 'dupe' } }) })

    await expect(createCourt(client, CREATE_INPUT)).rejects.toThrow(/Failed to create court/)
  })
})

describe('updateCourt', () => {
  it('sends only the fields that changed', async () => {
    const courts = fakeTable({ data: COURT_ROW, error: null })

    await updateCourt(fakeClient({ courts }), 'court-1', { maxPlayers: 6 })

    expect(callsFor(courts, 'update')[0]?.args[0]).toEqual({ max_players: 6 })
    expect(courts.calls).toContainEqual({ method: 'eq', args: ['id', 'court-1'] })
  })

  it('deactivates rather than deletes, so historical bookings still resolve', async () => {
    const courts = fakeTable({ data: { ...COURT_ROW, is_active: false }, error: null })

    await updateCourt(fakeClient({ courts }), 'court-1', { isActive: false })

    expect(callsFor(courts, 'update')[0]?.args[0]).toEqual({ is_active: false })
    expect(callsFor(courts, 'delete')).toHaveLength(0)
  })

  it('refuses an empty patch rather than issuing a no-op update', async () => {
    const client = fakeClient({ courts: fakeTable({ data: COURT_ROW, error: null }) })

    await expect(updateCourt(client, 'court-1', {})).rejects.toThrow(/Nothing to update/)
  })

  it('throws with context when the update errors', async () => {
    const client = fakeClient({ courts: fakeTable({ data: null, error: { message: 'x' } }) })

    await expect(updateCourt(client, 'court-1', { name: 'Court 4' })).rejects.toThrow(
      /Failed to update court/,
    )
  })
})

describe('listActiveCourts query shape', () => {
  it('never issues an unfiltered select', async () => {
    const courts = fakeTable({ data: [], error: null })

    await listActiveCourts(fakeClient({ courts }), 'club-1')

    expect(callsFor(courts, 'eq').length).toBeGreaterThan(0)
  })
})

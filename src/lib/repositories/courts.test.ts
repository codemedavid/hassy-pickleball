import { describe, expect, it } from 'vitest'
import { callsFor, fakeClient, fakeTable } from '../../../test/postgrest-fake'
import { findCourtBySlug, listActiveCourts } from './courts'

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

describe('listActiveCourts query shape', () => {
  it('never issues an unfiltered select', async () => {
    const courts = fakeTable({ data: [], error: null })

    await listActiveCourts(fakeClient({ courts }), 'club-1')

    expect(callsFor(courts, 'eq').length).toBeGreaterThan(0)
  })
})

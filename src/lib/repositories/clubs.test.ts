import { describe, expect, it } from 'vitest'
import { fakeClient, fakeTable } from '../../../test/postgrest-fake'
import { findClubById, findClubBySlug } from './clubs'

const CLUB_ROW = {
  id: 'club-1',
  name: 'Baseline',
  slug: 'baseline',
  timezone: 'Asia/Manila',
  currency: 'PHP',
  opens_at: '06:00:00',
  closes_at: '22:00:00',
  slot_minutes: 30,
  min_duration_minutes: 60,
  max_duration_minutes: 240,
}

describe('findClubBySlug', () => {
  it('returns the mapped club, with the timezone the pricing engine needs', async () => {
    const client = fakeClient({ clubs: fakeTable({ data: CLUB_ROW, error: null }) })

    const club = await findClubBySlug(client, 'baseline')

    expect(club?.timeZone).toBe('Asia/Manila')
  })

  it('returns null when no club matches', async () => {
    const client = fakeClient({ clubs: fakeTable({ data: null, error: null }) })

    expect(await findClubBySlug(client, 'nope')).toBeNull()
  })

  it('throws with context when the query errors', async () => {
    const client = fakeClient({ clubs: fakeTable({ data: null, error: { message: 'boom' } }) })

    await expect(findClubBySlug(client, 'baseline')).rejects.toThrow(/Failed to load club: boom/)
  })
})

describe('findClubById', () => {
  it('looks the club up by primary key', async () => {
    const clubs = fakeTable({ data: CLUB_ROW, error: null })

    await findClubById(fakeClient({ clubs }), 'club-1')

    expect(clubs.calls).toContainEqual({ method: 'eq', args: ['id', 'club-1'] })
  })

  it('throws with context when the query errors', async () => {
    const client = fakeClient({ clubs: fakeTable({ data: null, error: { message: 'x' } }) })

    await expect(findClubById(client, 'club-1')).rejects.toThrow(/Failed to load club/)
  })
})

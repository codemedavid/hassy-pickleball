import { describe, expect, it, vi } from 'vitest'
import {
  findBusyRangesByCourt,
  findClubBySlug,
  listActiveCourts,
  listActivePricingRules,
  listActiveProducts,
} from './queries'

/**
 * Minimal stand-in for the PostgREST query builder: every filter method returns
 * `this`, and the object is thenable so `await` resolves to the canned result.
 * This lets us assert the query that was built without a database.
 */
type QueryCall = { method: string; args: unknown[] }

type FakeTable = {
  calls: QueryCall[]
  then: (resolve: (value: unknown) => unknown) => Promise<unknown>
  maybeSingle: () => Promise<unknown>
} & Record<string, unknown>

function fakeTable(result: { data: unknown; error: { message: string } | null }): FakeTable {
  const calls: QueryCall[] = []

  const builder = {
    calls,
    then(resolve: (value: unknown) => unknown) {
      return Promise.resolve(result).then(resolve)
    },
    maybeSingle: () => Promise.resolve(result),
  } as FakeTable

  for (const method of ['select', 'eq', 'in', 'lt', 'gt', 'order']) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return builder
    }
  }

  return builder
}

function fakeClient(tables: Record<string, ReturnType<typeof fakeTable>>) {
  return {
    from: vi.fn((table: string) => tables[table]),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

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
  it('returns the mapped club', async () => {
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

  it('throws with context when the query errors', async () => {
    const client = fakeClient({ courts: fakeTable({ data: null, error: { message: 'nope' } }) })

    await expect(listActiveCourts(client, 'club-1')).rejects.toThrow(/Failed to load courts: nope/)
  })
})

describe('listActiveProducts', () => {
  it('throws with context when the query errors', async () => {
    const client = fakeClient({ products: fakeTable({ data: null, error: { message: 'x' } }) })

    await expect(listActiveProducts(client, 'club-1')).rejects.toThrow(/Failed to load products/)
  })
})

describe('listActivePricingRules', () => {
  it('orders rules by priority so the pricing engine stacks them correctly', async () => {
    const rules = fakeTable({ data: [], error: null })

    await listActivePricingRules(fakeClient({ pricing_rules: rules }), 'club-1')

    expect(rules.calls).toContainEqual({ method: 'order', args: ['priority', { ascending: true }] })
  })

  it('throws with context when the query errors', async () => {
    const client = fakeClient({ pricing_rules: fakeTable({ data: null, error: { message: 'x' } }) })

    await expect(listActivePricingRules(client, 'club-1')).rejects.toThrow(
      /Failed to load pricing rules/,
    )
  })
})

describe('findBusyRangesByCourt', () => {
  const window = {
    from: new Date('2026-03-16T00:00:00Z'),
    to: new Date('2026-03-17T00:00:00Z'),
  }

  it('short-circuits without querying when no courts are requested', async () => {
    const client = fakeClient({})

    expect(await findBusyRangesByCourt(client, { courtIds: [], ...window })).toEqual({})
    expect(client.from).not.toHaveBeenCalled()
  })

  it('unions bookings and maintenance blocks under the same court', async () => {
    const client = fakeClient({
      booking_courts: fakeTable({
        data: [
          {
            court_id: 'court-1',
            starts_at: '2026-03-16T02:00:00Z',
            ends_at: '2026-03-16T03:00:00Z',
          },
        ],
        error: null,
      }),
      availability_blocks: fakeTable({
        data: [
          {
            court_id: 'court-1',
            starts_at: '2026-03-16T05:00:00Z',
            ends_at: '2026-03-16T06:00:00Z',
          },
        ],
        error: null,
      }),
    })

    const busy = await findBusyRangesByCourt(client, { courtIds: ['court-1'], ...window })

    expect(busy['court-1']).toHaveLength(2)
    expect(busy['court-1'][0].startsAt).toBeInstanceOf(Date)
  })

  it('groups ranges by court id', async () => {
    const client = fakeClient({
      booking_courts: fakeTable({
        data: [
          {
            court_id: 'court-1',
            starts_at: '2026-03-16T02:00:00Z',
            ends_at: '2026-03-16T03:00:00Z',
          },
          {
            court_id: 'court-2',
            starts_at: '2026-03-16T02:00:00Z',
            ends_at: '2026-03-16T03:00:00Z',
          },
        ],
        error: null,
      }),
      availability_blocks: fakeTable({ data: [], error: null }),
    })

    const busy = await findBusyRangesByCourt(client, {
      courtIds: ['court-1', 'court-2'],
      ...window,
    })

    expect(Object.keys(busy).sort()).toEqual(['court-1', 'court-2'])
  })

  it('excludes cancelled bookings by filtering on live statuses', async () => {
    const bookings = fakeTable({ data: [], error: null })
    const client = fakeClient({
      booking_courts: bookings,
      availability_blocks: fakeTable({ data: [], error: null }),
    })

    await findBusyRangesByCourt(client, { courtIds: ['court-1'], ...window })

    const statusFilter = bookings.calls.find(
      (call) => call.method === 'in' && call.args[0] === 'status',
    )

    expect(statusFilter?.args[1]).toEqual(['pending', 'awaiting_payment', 'confirmed', 'completed'])
  })

  it('uses a half-open window so a booking ending at `from` is not busy', async () => {
    const bookings = fakeTable({ data: [], error: null })
    const client = fakeClient({
      booking_courts: bookings,
      availability_blocks: fakeTable({ data: [], error: null }),
    })

    await findBusyRangesByCourt(client, { courtIds: ['court-1'], ...window })

    expect(bookings.calls).toContainEqual({ method: 'lt', args: ['starts_at', window.to.toISOString()] })
    expect(bookings.calls).toContainEqual({ method: 'gt', args: ['ends_at', window.from.toISOString()] })
  })

  it('throws when the bookings query errors', async () => {
    const client = fakeClient({
      booking_courts: fakeTable({ data: null, error: { message: 'down' } }),
      availability_blocks: fakeTable({ data: [], error: null }),
    })

    await expect(
      findBusyRangesByCourt(client, { courtIds: ['court-1'], ...window }),
    ).rejects.toThrow(/Failed to load bookings: down/)
  })

  it('throws when the blocks query errors', async () => {
    const client = fakeClient({
      booking_courts: fakeTable({ data: [], error: null }),
      availability_blocks: fakeTable({ data: null, error: { message: 'down' } }),
    })

    await expect(
      findBusyRangesByCourt(client, { courtIds: ['court-1'], ...window }),
    ).rejects.toThrow(/Failed to load availability blocks: down/)
  })

  it('returns an empty map when nothing is busy', async () => {
    const client = fakeClient({
      booking_courts: fakeTable({ data: [], error: null }),
      availability_blocks: fakeTable({ data: [], error: null }),
    })

    expect(await findBusyRangesByCourt(client, { courtIds: ['court-1'], ...window })).toEqual({})
  })
})

import { describe, expect, it } from 'vitest'
import { fakeClient, fakeTable } from '../../../test/postgrest-fake'
import { findBusyRangesByCourt } from './availability'

describe('findBusyRangesByCourt', () => {
  const window = {
    courtIds: ['court-1'],
    from: new Date('2026-03-01T00:00:00.000Z'),
    to: new Date('2026-03-02T00:00:00.000Z'),
  }

  function client(bookings: ReturnType<typeof fakeTable>, blocks: ReturnType<typeof fakeTable>) {
    return fakeClient({ booking_courts: bookings, availability_blocks: blocks })
  }

  it('returns nothing without querying when no courts are given', async () => {
    const bookings = fakeTable({ data: [], error: null })
    const blocks = fakeTable({ data: [], error: null })
    const supabase = client(bookings, blocks)

    const result = await findBusyRangesByCourt(supabase, { ...window, courtIds: [] })

    expect(result).toEqual({})
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('excludes cancelled bookings, so a cancelled slot becomes bookable again', async () => {
    const bookings = fakeTable({ data: [], error: null })

    await findBusyRangesByCourt(client(bookings, fakeTable({ data: [], error: null })), window)

    const statusFilter = bookings.calls.find(
      (call) => call.method === 'in' && call.args[0] === 'status',
    )

    expect(statusFilter?.args[1]).not.toContain('cancelled')
    expect(statusFilter?.args[1]).toContain('confirmed')
  })

  it('uses a half-open window, so a booking ending exactly at `from` is free', async () => {
    const bookings = fakeTable({ data: [], error: null })

    await findBusyRangesByCourt(client(bookings, fakeTable({ data: [], error: null })), window)

    expect(bookings.calls).toContainEqual({
      method: 'lt',
      args: ['starts_at', window.to.toISOString()],
    })
    expect(bookings.calls).toContainEqual({
      method: 'gt',
      args: ['ends_at', window.from.toISOString()],
    })
  })

  it('unions bookings and maintenance blocks under one court id', async () => {
    const bookings = fakeTable({
      data: [
        {
          court_id: 'court-1',
          starts_at: '2026-03-01T02:00:00.000Z',
          ends_at: '2026-03-01T03:00:00.000Z',
        },
      ],
      error: null,
    })
    const blocks = fakeTable({
      data: [
        {
          court_id: 'court-1',
          starts_at: '2026-03-01T06:00:00.000Z',
          ends_at: '2026-03-01T08:00:00.000Z',
        },
      ],
      error: null,
    })

    const busy = await findBusyRangesByCourt(client(bookings, blocks), window)

    expect(busy['court-1']).toHaveLength(2)
    expect(busy['court-1']?.[0]?.startsAt).toBeInstanceOf(Date)
  })

  it('throws with context when the bookings query errors', async () => {
    const bookings = fakeTable({ data: null, error: { message: 'boom' } })

    await expect(
      findBusyRangesByCourt(client(bookings, fakeTable({ data: [], error: null })), window),
    ).rejects.toThrow(/Failed to load bookings: boom/)
  })

  it('throws with context when the blocks query errors', async () => {
    const blocks = fakeTable({ data: null, error: { message: 'down' } })

    await expect(
      findBusyRangesByCourt(client(fakeTable({ data: [], error: null }), blocks), window),
    ).rejects.toThrow(/Failed to load availability blocks: down/)
  })
})

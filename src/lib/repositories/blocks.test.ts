import { describe, expect, it } from 'vitest'
import { callsFor, fakeClient, fakeTable } from '../../../test/postgrest-fake'
import { createAvailabilityBlock, deleteAvailabilityBlock, listBlocksInWindow } from './blocks'

const BLOCK_ROW = {
  id: 'block-1',
  court_id: 'court-1',
  kind: 'maintenance' as const,
  reason: 'Resurfacing',
  starts_at: '2026-03-01T01:00:00.000Z',
  ends_at: '2026-03-01T05:00:00.000Z',
}

describe('listBlocksInWindow', () => {
  const window = {
    courtIds: ['court-1', 'court-2'],
    from: new Date('2026-03-01T00:00:00.000Z'),
    to: new Date('2026-03-02T00:00:00.000Z'),
  }

  it('short-circuits without querying when no courts are given', async () => {
    const blocks = fakeTable({ data: [], error: null })
    const client = fakeClient({ availability_blocks: blocks })

    const result = await listBlocksInWindow(client, { ...window, courtIds: [] })

    expect(result).toEqual([])
    expect(client.from).not.toHaveBeenCalled()
  })

  it('uses a half-open window so a block ending at `from` is not returned', async () => {
    const blocks = fakeTable({ data: [], error: null })

    await listBlocksInWindow(fakeClient({ availability_blocks: blocks }), window)

    expect(blocks.calls).toContainEqual({
      method: 'lt',
      args: ['starts_at', window.to.toISOString()],
    })
    expect(blocks.calls).toContainEqual({
      method: 'gt',
      args: ['ends_at', window.from.toISOString()],
    })
  })

  it('maps rows into domain blocks', async () => {
    const client = fakeClient({
      availability_blocks: fakeTable({ data: [BLOCK_ROW], error: null }),
    })

    const blocks = await listBlocksInWindow(client, window)

    expect(blocks[0]).toMatchObject({ courtId: 'court-1', kind: 'maintenance' })
    expect(blocks[0]?.startsAt).toBeInstanceOf(Date)
  })

  it('throws with context when the query errors', async () => {
    const client = fakeClient({
      availability_blocks: fakeTable({ data: null, error: { message: 'boom' } }),
    })

    await expect(listBlocksInWindow(client, window)).rejects.toThrow(
      /Failed to load availability blocks: boom/,
    )
  })
})

describe('createAvailabilityBlock', () => {
  it('writes the block as ISO instants so the exclusion constraint compares correctly', async () => {
    const blocks = fakeTable({ data: BLOCK_ROW, error: null })

    await createAvailabilityBlock(fakeClient({ availability_blocks: blocks }), {
      courtId: 'court-1',
      kind: 'maintenance',
      reason: 'Resurfacing',
      startsAt: new Date('2026-03-01T01:00:00.000Z'),
      endsAt: new Date('2026-03-01T05:00:00.000Z'),
      createdBy: 'user-1',
    })

    expect(callsFor(blocks, 'insert')[0]?.args[0]).toMatchObject({
      court_id: 'court-1',
      kind: 'maintenance',
      reason: 'Resurfacing',
      starts_at: '2026-03-01T01:00:00.000Z',
      ends_at: '2026-03-01T05:00:00.000Z',
      created_by: 'user-1',
    })
  })

  it('surfaces the Postgres conflict code so callers can explain the clash', async () => {
    const client = fakeClient({
      availability_blocks: fakeTable({
        data: null,
        error: { message: 'conflicting key value', code: '23P01' },
      }),
    })

    await expect(
      createAvailabilityBlock(client, {
        courtId: 'court-1',
        kind: 'maintenance',
        reason: null,
        startsAt: new Date('2026-03-01T01:00:00.000Z'),
        endsAt: new Date('2026-03-01T05:00:00.000Z'),
        createdBy: 'user-1',
      }),
    ).rejects.toMatchObject({ code: '23P01' })
  })
})

describe('deleteAvailabilityBlock', () => {
  it('deletes exactly the requested block', async () => {
    const blocks = fakeTable({ data: null, error: null })

    await deleteAvailabilityBlock(fakeClient({ availability_blocks: blocks }), 'block-1')

    expect(callsFor(blocks, 'delete')).toHaveLength(1)
    expect(blocks.calls).toContainEqual({ method: 'eq', args: ['id', 'block-1'] })
  })

  it('throws with context when the delete is rejected', async () => {
    const client = fakeClient({
      availability_blocks: fakeTable({ data: null, error: { message: 'denied' } }),
    })

    await expect(deleteAvailabilityBlock(client, 'block-1')).rejects.toThrow(
      /Failed to delete availability block: denied/,
    )
  })
})

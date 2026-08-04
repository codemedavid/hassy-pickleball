import 'server-only'

import { createBlockSchema, removeBlockSchema } from '@/lib/api/admin-schemas'
import { invalid, withStaff } from './session'
import { createAvailabilityBlock, deleteAvailabilityBlock } from '@/lib/repositories/blocks'
import type { AvailabilityBlock } from '@/lib/repositories/booking-mappers'
import type { Result } from '@/lib/api/result'

/**
 * Holding court time for maintenance, leagues, private hire, or a closure.
 *
 * Whether the window is actually free is settled by the exclusion constraint,
 * not by a read-then-write check here — two staff members blocking the same
 * court at the same moment would both pass such a check. withStaff turns the
 * resulting 23P01 into a CONFLICT.
 */

export async function blockCourtTime(input: unknown): Promise<Result<AvailabilityBlock>> {
  const parsed = createBlockSchema.safeParse(input)

  if (!parsed.success) {
    return invalid('Check the court and the times for that block')
  }

  const { courtId, kind, reason, startsAt, endsAt } = parsed.data

  return withStaff(({ staff, client }) =>
    createAvailabilityBlock(client, {
      courtId,
      kind,
      reason: reason ?? null,
      startsAt,
      endsAt,
      createdBy: staff.id,
    }),
  )
}

export async function removeCourtBlock(input: unknown): Promise<Result<{ blockId: string }>> {
  const parsed = removeBlockSchema.safeParse(input)

  if (!parsed.success) {
    return invalid('That block could not be identified')
  }

  const { blockId } = parsed.data

  return withStaff(async ({ client }) => {
    await deleteAvailabilityBlock(client, blockId)

    return { blockId }
  })
}

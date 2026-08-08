import 'server-only'

import { updateTag } from 'next/cache'
import { courtPatchSchema, createCourtSchema } from '@/lib/api/admin-schemas'
import { invalid, withStaff } from './session'
import { createCourt, updateCourt } from '@/lib/repositories/courts'
import { CATALOG_TAG } from '@/features/courts/catalog'
import type { Court } from '@/lib/repositories/mappers'
import type { Result } from '@/lib/api/result'

/**
 * The court editor.
 *
 * One entry point, create or patch decided by the presence of an id, matching
 * ./catalog — the editor screen is the same form either way.
 *
 * `clubId` is never read from the request. It comes from the staff session, so
 * a staff member of one club cannot create courts under another.
 */

function hasId(input: unknown): boolean {
  return typeof input === 'object' && input !== null && 'id' in input
}

/** Zod drops keys that were not supplied, so a patch carries only real edits. */
function withoutId<T extends { id: string }>(parsed: T): Omit<T, 'id'> {
  const entries = Object.entries(parsed).filter(([key]) => key !== 'id')

  return Object.fromEntries(entries) as Omit<T, 'id'>
}

/**
 * Drops the storefront's cached catalog.
 *
 * That catalog is tag-cached with a TTL (see src/features/courts/catalog.ts), so
 * without this a new court — or one just taken offline — stays wrong for guests
 * until the TTL happens to lapse. Only on success: if nothing was written,
 * nothing is stale, and throwing away a warm cache costs every guest a slow
 * page for no reason.
 *
 * `updateTag` rather than `revalidateTag`: this runs inside a Server Action, and
 * only updateTag expires the entry immediately with read-your-own-writes
 * semantics. revalidateTag would let the staff member's own next read still come
 * back stale, which is precisely the bug being fixed.
 */
function revalidated(result: Result<Court>): Result<Court> {
  if (result.success) {
    updateTag(CATALOG_TAG)
  }

  return result
}

export async function saveCourt(input: unknown): Promise<Result<Court>> {
  if (hasId(input)) {
    const parsed = courtPatchSchema.safeParse(input)

    if (!parsed.success) {
      return invalid(parsed.error.issues[0]?.message ?? 'Check the court details')
    }

    const patch = withoutId(parsed.data)

    return revalidated(await withStaff(({ client }) => updateCourt(client, parsed.data.id, patch)))
  }

  const parsed = createCourtSchema.safeParse(input)

  if (!parsed.success) {
    return invalid(parsed.error.issues[0]?.message ?? 'Check the court details')
  }

  const created = await withStaff(({ staff, client }) =>
    createCourt(client, {
      clubId: staff.clubId,
      name: parsed.data.name,
      slug: parsed.data.slug,
      surface: parsed.data.surface,
      environment: parsed.data.environment,
      isTournamentGrade: parsed.data.isTournamentGrade,
      blurb: parsed.data.blurb ?? null,
      notes: parsed.data.notes,
      tags: parsed.data.tags,
      includes: parsed.data.includes,
      heroImageUrl: parsed.data.heroImageUrl ?? null,
      basePriceCents: parsed.data.basePriceCents,
      sortOrder: parsed.data.sortOrder,
      minPlayers: parsed.data.minPlayers,
      maxPlayers: parsed.data.maxPlayers,
      includedPlayers: parsed.data.includedPlayers,
      extraPlayerFeeCents: parsed.data.extraPlayerFeeCents,
    }),
  )

  return revalidated(created)
}

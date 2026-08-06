import 'server-only'

import { unstable_cache } from 'next/cache'
import { findClubBySlug } from '@/lib/repositories/clubs'
import { listActiveCourts } from '@/lib/repositories/courts'
import { createSupabasePublicClient } from '@/lib/supabase/public'
import type { Club, Court } from '@/lib/repositories/mappers'

/**
 * The club and its court list — the near-static half of the storefront.
 *
 * Cached because it changes when staff edit the catalog, not per request, and
 * every page view was otherwise paying two round trips for rows that are
 * identical for every visitor. Safe to share across visitors precisely because
 * `clubs_public_read` and `courts_public_read` make these rows public: nothing
 * here varies by who is asking.
 *
 * Availability is deliberately NOT cached alongside it. A stale court name is
 * cosmetic; a stale open/taken flag sells a slot twice.
 */

export type Catalog = {
  readonly club: Club
  readonly courts: readonly Court[]
}

/** Long enough to absorb a traffic spike, short enough that an edit shows up. */
const CATALOG_TTL_SECONDS = 300

export const CATALOG_TAG = 'catalog'

async function readCatalog(slug: string): Promise<Catalog | null> {
  // Cookie-free by necessity: this runs inside the cache scope below, where
  // Next.js rejects any read of request state.
  const client = createSupabasePublicClient()
  const club = await findClubBySlug(client, slug)

  if (!club) {
    return null
  }

  return { club, courts: await listActiveCourts(client, club.id) }
}

/**
 * Staff catalog edits should not wait out the TTL — revalidateTag(CATALOG_TAG)
 * after a court or club write drops this immediately.
 */
export function loadCatalog(slug: string): Promise<Catalog | null> {
  return unstable_cache(readCatalog, ['catalog', slug], {
    revalidate: CATALOG_TTL_SECONDS,
    tags: [CATALOG_TAG],
  })(slug)
}

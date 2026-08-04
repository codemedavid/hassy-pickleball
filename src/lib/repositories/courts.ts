import 'server-only'

import { toCourt, type Court } from './mappers'
import { raise, type Client } from './support'

/** Court reads. Deactivated courts are never sold, so they are filtered here. */

export async function listActiveCourts(client: Client, clubId: string): Promise<Court[]> {
  const { data, error } = await client
    .from('courts')
    .select('*')
    .eq('club_id', clubId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  raise('Failed to load courts', error)

  return (data ?? []).map(toCourt)
}

/** Backs the court detail page. Slugs are unique per club, not globally. */
export async function findCourtBySlug(
  client: Client,
  clubId: string,
  slug: string,
): Promise<Court | null> {
  const { data, error } = await client
    .from('courts')
    .select('*')
    .eq('club_id', clubId)
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  raise('Failed to load court', error)

  return data ? toCourt(data) : null
}

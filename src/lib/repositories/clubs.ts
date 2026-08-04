import 'server-only'

import { toClub, type Club } from './mappers'
import { raise, type Client } from './support'

/** Club reads. The club carries the timezone and opening hours every other read model needs. */

export async function findClubBySlug(client: Client, slug: string): Promise<Club | null> {
  const { data, error } = await client.from('clubs').select('*').eq('slug', slug).maybeSingle()

  raise('Failed to load club', error)

  return data ? toClub(data) : null
}

export async function findClubById(client: Client, clubId: string): Promise<Club | null> {
  const { data, error } = await client.from('clubs').select('*').eq('id', clubId).maybeSingle()

  raise('Failed to load club', error)

  return data ? toClub(data) : null
}

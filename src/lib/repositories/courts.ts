import 'server-only'

import { toCourt, type Court } from './mappers'
import { raise, RepositoryError, type Client } from './support'
import type { CourtEnvironment, Tables } from './rows'

type CourtUpdate = Tables['courts']['Update']

/**
 * Courts: the storefront's reads plus the admin editor's writes.
 *
 * Deactivated courts are never sold, so the customer-facing reads filter them
 * out; the editor needs them so a court taken offline for resurfacing can be
 * brought back.
 */

export type CreateCourtInput = {
  readonly clubId: string
  readonly name: string
  readonly slug: string
  readonly surface: string
  readonly environment: CourtEnvironment
  readonly isTournamentGrade: boolean
  readonly blurb: string | null
  readonly notes: readonly string[]
  readonly tags: readonly string[]
  readonly includes: readonly string[]
  readonly heroImageUrl: string | null
  readonly basePriceCents: number
  readonly sortOrder: number
  readonly minPlayers: number
  readonly maxPlayers: number
}

/** Every field optional: the editor patches what changed and nothing else. */
export type CourtPatch = {
  readonly name?: string
  readonly slug?: string
  readonly surface?: string
  readonly environment?: CourtEnvironment
  readonly isTournamentGrade?: boolean
  readonly blurb?: string | null
  readonly notes?: readonly string[]
  readonly tags?: readonly string[]
  readonly includes?: readonly string[]
  readonly heroImageUrl?: string | null
  readonly basePriceCents?: number
  readonly sortOrder?: number
  readonly minPlayers?: number
  readonly maxPlayers?: number
  readonly isActive?: boolean
}

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

/** The admin editor needs deactivated rows too, so it can bring one back. */
export async function listAllCourts(client: Client, clubId: string): Promise<Court[]> {
  const { data, error } = await client
    .from('courts')
    .select('*')
    .eq('club_id', clubId)
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

export async function createCourt(client: Client, input: CreateCourtInput): Promise<Court> {
  const { data, error } = await client
    .from('courts')
    .insert({
      club_id: input.clubId,
      name: input.name,
      slug: input.slug,
      surface: input.surface,
      environment: input.environment,
      is_tournament_grade: input.isTournamentGrade,
      blurb: input.blurb,
      notes: [...input.notes],
      tags: [...input.tags],
      includes: [...input.includes],
      hero_image_url: input.heroImageUrl,
      base_price_cents: input.basePriceCents,
      sort_order: input.sortOrder,
      min_players: input.minPlayers,
      max_players: input.maxPlayers,
    })
    .select('*')
    .single()

  raise('Failed to create court', error)

  return toCourt(data as NonNullable<typeof data>)
}

function toCourtRowPatch(patch: CourtPatch): CourtUpdate {
  const columns: CourtUpdate = {}

  if (patch.name !== undefined) columns.name = patch.name
  if (patch.slug !== undefined) columns.slug = patch.slug
  if (patch.surface !== undefined) columns.surface = patch.surface
  if (patch.environment !== undefined) columns.environment = patch.environment
  if (patch.isTournamentGrade !== undefined) columns.is_tournament_grade = patch.isTournamentGrade
  if (patch.blurb !== undefined) columns.blurb = patch.blurb
  if (patch.notes !== undefined) columns.notes = [...patch.notes]
  if (patch.tags !== undefined) columns.tags = [...patch.tags]
  if (patch.includes !== undefined) columns.includes = [...patch.includes]
  if (patch.heroImageUrl !== undefined) columns.hero_image_url = patch.heroImageUrl
  if (patch.basePriceCents !== undefined) columns.base_price_cents = patch.basePriceCents
  if (patch.sortOrder !== undefined) columns.sort_order = patch.sortOrder
  if (patch.minPlayers !== undefined) columns.min_players = patch.minPlayers
  if (patch.maxPlayers !== undefined) columns.max_players = patch.maxPlayers
  if (patch.isActive !== undefined) columns.is_active = patch.isActive

  return columns
}

/**
 * Courts are deactivated (`isActive: false`), never deleted — booking_courts
 * references them with `on delete restrict`, so a court that has ever been
 * booked cannot be removed, and historical bookings must keep resolving.
 */
export async function updateCourt(
  client: Client,
  courtId: string,
  patch: CourtPatch,
): Promise<Court> {
  const columns = toCourtRowPatch(patch)

  if (Object.keys(columns).length === 0) {
    throw new RepositoryError('Nothing to update on this court')
  }

  const { data, error } = await client
    .from('courts')
    .update(columns)
    .eq('id', courtId)
    .select('*')
    .single()

  raise('Failed to update court', error)

  return toCourt(data as NonNullable<typeof data>)
}

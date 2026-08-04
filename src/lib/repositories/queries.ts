import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { toClub, toCourt, toPricingRule, toProduct } from './mappers'
import type { Club, Court, Product } from './mappers'
import type { PricingRule, TimeRange } from '@/lib/domain/types'
import type { Database } from '@/lib/supabase/database.types'

type Client = SupabaseClient<Database>

/** Statuses that occupy a court. Cancelled bookings free their slot. */
const LIVE_STATUSES = ['pending', 'awaiting_payment', 'confirmed', 'completed'] as const

function raise(context: string, error: { message: string } | null): void {
  if (error) {
    throw new Error(`${context}: ${error.message}`)
  }
}

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

export async function listActiveProducts(client: Client, clubId: string): Promise<Product[]> {
  const { data, error } = await client
    .from('products')
    .select('*')
    .eq('club_id', clubId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  raise('Failed to load products', error)

  return (data ?? []).map(toProduct)
}

export async function listActivePricingRules(
  client: Client,
  clubId: string,
): Promise<PricingRule[]> {
  const { data, error } = await client
    .from('pricing_rules')
    .select('*')
    .eq('club_id', clubId)
    .eq('is_active', true)
    .order('priority', { ascending: true })

  raise('Failed to load pricing rules', error)

  return (data ?? []).map(toPricingRule)
}

/**
 * Every interval that makes a court unbookable in a window: live bookings and
 * maintenance blocks, grouped by court. Both are fetched for the same window so
 * the calendar and the database agree on what is taken.
 */
export async function findBusyRangesByCourt(
  client: Client,
  input: { readonly courtIds: readonly string[]; readonly from: Date; readonly to: Date },
): Promise<Record<string, TimeRange[]>> {
  if (input.courtIds.length === 0) {
    return {}
  }

  const fromIso = input.from.toISOString()
  const toIso = input.to.toISOString()

  const [bookings, blocks] = await Promise.all([
    client
      .from('booking_courts')
      .select('court_id, starts_at, ends_at')
      .in('court_id', [...input.courtIds])
      .in('status', [...LIVE_STATUSES])
      .lt('starts_at', toIso)
      .gt('ends_at', fromIso),
    client
      .from('availability_blocks')
      .select('court_id, starts_at, ends_at')
      .in('court_id', [...input.courtIds])
      .lt('starts_at', toIso)
      .gt('ends_at', fromIso),
  ])

  raise('Failed to load bookings', bookings.error)
  raise('Failed to load availability blocks', blocks.error)

  const rows = [...(bookings.data ?? []), ...(blocks.data ?? [])]

  return rows.reduce<Record<string, TimeRange[]>>((grouped, row) => {
    const range = { startsAt: new Date(row.starts_at), endsAt: new Date(row.ends_at) }
    const existing = grouped[row.court_id] ?? []

    return { ...grouped, [row.court_id]: [...existing, range] }
  }, {})
}

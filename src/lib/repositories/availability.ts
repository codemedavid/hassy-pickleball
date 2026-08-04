import 'server-only'

import { LIVE_BOOKING_STATUSES, raise, type Client } from './support'
import type { TimeRange } from '@/lib/domain/types'

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
      .in('status', [...LIVE_BOOKING_STATUSES])
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

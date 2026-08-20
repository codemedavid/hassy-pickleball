import type { BookingRow } from './bookings'

/**
 * Narrowing the ledger to the booking in hand.
 *
 * Thirty days of bookings is a long list on a desktop and an unscannable
 * column of cards on a phone, so the desk needs to say what it is looking for.
 * The two ways it ever asks are "this customer" and "the ones I still have to
 * chase", which is what the search and the tabs are.
 *
 * Filtering happens here rather than on the server: the rows are already
 * loaded, and a round trip per keystroke would make the search feel slower than
 * scrolling.
 */

export type BookingFilterTab = 'all' | 'awaiting' | 'confirmed' | 'cancelled'

export type BookingFilter = {
  /** Free text matched against the fields the desk would search by. */
  readonly query: string
  readonly tab: BookingFilterTab
}

export type BookingTab = {
  readonly id: BookingFilterTab
  readonly label: string
  /** How many bookings sit behind the tab, so the workload is visible. */
  readonly count: number
}

export const NO_MATCH_MESSAGE = 'No bookings match this search.'

const TAB_LABELS: Record<BookingFilterTab, string> = {
  all: 'All',
  awaiting: 'Awaiting payment',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
}

const TAB_ORDER: readonly BookingFilterTab[] = ['all', 'awaiting', 'confirmed', 'cancelled']

/**
 * A cancelled booking owes the club nothing, so it stays out of the money the
 * desk is chasing even though its payment never landed.
 */
const MATCHES_TAB: Record<BookingFilterTab, (row: BookingRow) => boolean> = {
  all: () => true,
  awaiting: (row) => row.paymentStatus === 'awaiting' && row.status !== 'cancelled',
  confirmed: (row) => row.status === 'confirmed',
  cancelled: (row) => row.status === 'cancelled',
}

/** The fields a staff member would have in hand when looking someone up. */
function searchableText(row: BookingRow): string {
  return [row.reference, row.name, row.contact, row.court].join(' ').toLowerCase()
}

export function filterBookingRows(
  rows: readonly BookingRow[],
  filter: BookingFilter,
): readonly BookingRow[] {
  const query = filter.query.trim().toLowerCase()
  const matchesTab = MATCHES_TAB[filter.tab]

  return rows.filter(
    (row) => matchesTab(row) && (query === '' || searchableText(row).includes(query)),
  )
}

export function bookingTabs(rows: readonly BookingRow[]): readonly BookingTab[] {
  return TAB_ORDER.map((id) => ({
    id,
    label: TAB_LABELS[id],
    count: rows.filter(MATCHES_TAB[id]).length,
  }))
}

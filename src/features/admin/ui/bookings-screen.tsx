'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AdminPageHeader,
  AdminScreen,
  Cell,
  DataTable,
  EmptyState,
  Row,
  TABLE_SHELL,
} from './primitives'
import { BookingDetailPanel } from './booking-detail-panel'
import { PaymentBadge } from './payment-badge'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  bookingTabs,
  filterBookingRows,
  NO_MATCH_MESSAGE,
  type BookingFilterTab,
} from '../view/booking-filters'
import type { BookingDetailView, BookingRow } from '../view/bookings'
import type { Result } from '@/lib/api/result'

/**
 * Every booking the club has in the window, and the selected one managed
 * beside it.
 *
 * This replaced the separate Orders ledger. There was never a second kind of
 * record behind it — orders were these same bookings seen through their
 * payments — and keeping two screens meant staff reconciling a transfer on one
 * and confirming the booking on the other. Both facts now sit on one row.
 *
 * Selection travels in the URL rather than in state, so a staff member can
 * send a colleague a link to the exact booking they are looking at. The search
 * and the tab do not: they are how one person is reading the list right now,
 * and putting them in the URL would make every keystroke a navigation.
 *
 * On a phone the list and the panel cannot share the screen, so the panel is
 * held back until a booking is actually opened and then takes the top of the
 * screen with a way back to the ledger.
 */

const COLUMNS = [
  'Reference',
  'Customer',
  'Court',
  'When',
  'Extras',
  'Status',
  'Method',
  'Payment',
  'Total',
  '',
] as const

export interface BookingsScreenProps {
  readonly rows: readonly BookingRow[]
  readonly detail: BookingDetailView | null
  /**
   * Whether the panel is showing a booking someone asked for, as opposed to
   * the newest one the page falls back to. A phone only opens the panel for a
   * real choice.
   */
  readonly isSelectionExplicit?: boolean
  readonly currency: string
  readonly onSetStatus: (payload: unknown) => Promise<Result<unknown>>
  readonly onMarkPaid: (payload: unknown) => Promise<Result<unknown>>
  readonly onRefund: (payload: unknown) => Promise<Result<unknown>>
}

export function BookingsScreen({
  rows,
  detail,
  isSelectionExplicit = false,
  currency,
  onSetStatus,
  onMarkPaid,
  onRefund,
}: BookingsScreenProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<BookingFilterTab>('all')

  const tabs = useMemo(() => bookingTabs(rows), [rows])
  const visible = useMemo(() => filterBookingRows(rows, { query, tab }), [rows, query, tab])
  const unpaid = tabs.find((entry) => entry.id === 'awaiting')?.count ?? 0

  return (
    <AdminScreen>
      <AdminPageHeader
        title="Bookings"
        subtitle={`${rows.length} in this window · ${unpaid} awaiting payment`}
      />

      <BookingFilters
        query={query}
        tab={tab}
        tabs={tabs}
        onQueryChange={setQuery}
        onTabChange={setTab}
      />

      <div className="grid items-start gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
        <div className={`${TABLE_SHELL} min-w-0 sm:overflow-x-auto`}>
          {rows.length === 0 ? (
            <EmptyState>No bookings in this window yet.</EmptyState>
          ) : visible.length === 0 ? (
            <EmptyState>{NO_MATCH_MESSAGE}</EmptyState>
          ) : (
            <DataTable label="Bookings" columns={COLUMNS} wideClassName="sm:min-w-[1100px]">
              {visible.map((row) => (
                <BookingListRow key={row.id} row={row} isOpen={row.id === detail?.id} />
              ))}
            </DataTable>
          )}
        </div>

        {detail ? (
          <div
            className={
              isSelectionExplicit
                ? 'min-w-0 max-lg:order-first'
                : 'min-w-0 max-lg:hidden lg:sticky lg:top-20'
            }
          >
            {isSelectionExplicit ? (
              <Link
                href="/admin/bookings"
                className="mb-2 inline-flex h-11 items-center gap-1.5 text-[14px] font-semibold text-muted lg:hidden"
              >
                <span aria-hidden>‹</span> All bookings
              </Link>
            ) : null}

            <BookingDetailPanel
              detail={detail}
              currency={currency}
              onSetStatus={onSetStatus}
              onMarkPaid={onMarkPaid}
              onRefund={onRefund}
              onDone={() => router.refresh()}
            />
          </div>
        ) : null}
      </div>
    </AdminScreen>
  )
}

const SEARCH_FIELD =
  'h-11 w-full rounded-xl border border-line-strong bg-surface pr-3 pl-10 text-[15px] text-ink ' +
  'placeholder:text-subtle focus-visible:outline-2 focus-visible:outline-offset-1 ' +
  'focus-visible:outline-navy-mid sm:h-10 sm:text-[14px]'

const TAB_BUTTON =
  'inline-flex h-10 flex-none snap-start items-center gap-1.5 rounded-full border px-3.5 ' +
  'text-[13.5px] font-semibold whitespace-nowrap transition ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-mid'

interface BookingFiltersProps {
  readonly query: string
  readonly tab: BookingFilterTab
  readonly tabs: ReturnType<typeof bookingTabs>
  readonly onQueryChange: (value: string) => void
  readonly onTabChange: (value: BookingFilterTab) => void
}

/**
 * The tabs scroll rather than wrap: four pills wrapping onto two lines pushes
 * the first booking off a phone screen before anything has been read.
 */
function BookingFilters({ query, tab, tabs, onQueryChange, onTabChange }: BookingFiltersProps) {
  return (
    <div className="mb-4 flex flex-col gap-2.5 sm:mb-5 sm:flex-row sm:items-center sm:gap-3">
      <div className="relative sm:max-w-xs sm:flex-1">
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[15px] text-subtle"
        >
          ⌕
        </span>
        <input
          type="search"
          aria-label="Search bookings"
          placeholder="Reference, name, phone, court"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          className={SEARCH_FIELD}
        />
      </div>

      <div
        role="group"
        aria-label="Filter bookings by status"
        className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((entry) => {
          const isCurrent = entry.id === tab

          return (
            <button
              key={entry.id}
              type="button"
              aria-pressed={isCurrent}
              onClick={() => onTabChange(entry.id)}
              className={`${TAB_BUTTON} ${
                isCurrent
                  ? 'border-navy bg-navy text-white'
                  : 'border-line-strong bg-surface text-slate hover:border-line-heavy'
              }`}
            >
              {/* The space is load-bearing: without it the button announces as
                  "Awaiting payment1". */}
              {entry.label}{' '}
              <span
                className={`rounded-full px-1.5 py-px text-[11.5px] font-bold tabular-nums ${
                  isCurrent ? 'bg-white/20 text-white' : 'bg-surface-sunken text-muted'
                }`}
              >
                {entry.count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface BookingListRowProps {
  readonly row: BookingRow
  readonly isOpen: boolean
}

function BookingListRow({ row, isOpen }: BookingListRowProps) {
  return (
    <Row className={isOpen ? 'bg-surface-alt max-sm:border-navy max-sm:bg-surface' : ''}>
      <Cell label="Reference" mobile="title" className="font-bold tabular-nums">
        <Link href={`/admin/bookings?booking=${row.id}`} className="hover:text-olive">
          {row.reference}
        </Link>
      </Cell>
      <Cell label="Customer" mobile="lead">
        <span className="block font-semibold max-sm:text-[14px]">{row.name}</span>
        <span className="mt-px block text-[12.5px] text-subtle">{row.contact}</span>
      </Cell>
      <Cell label="Court" className="text-slate">
        {row.court}
      </Cell>
      <Cell label="When" className="text-slate">
        {row.when}
      </Cell>
      <Cell label="Extras" className="text-slate">
        {row.extras}
      </Cell>
      <Cell label="Status" mobile="badge">
        <StatusBadge status={row.status} />
      </Cell>
      <Cell label="Method" className="text-slate">
        {row.method}
      </Cell>
      <Cell label="Payment" mobile="badge">
        <PaymentBadge status={row.paymentStatus} />
      </Cell>
      <Cell label="Total" mobile="trailing" className="text-right font-bold">
        {row.total}
      </Cell>
      {/* The reference is a 60px target in the corner of a card; the whole
          footer of the card is the one staff will actually hit. */}
      <Cell label="" mobile="actions">
        <Link
          href={`/admin/bookings?booking=${row.id}`}
          aria-label={`Manage ${row.reference}`}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-line-strong bg-surface px-4 text-[13.5px] font-semibold text-ink hover:border-line-heavy max-sm:w-full sm:h-8 sm:px-3 sm:text-[13px]"
        >
          Manage
        </Link>
      </Cell>
    </Row>
  )
}

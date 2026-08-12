'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AdminPageHeader, AdminScreen, CARD, CELL, EmptyState, TABLE_HEAD } from './primitives'
import { BookingDetailPanel } from './booking-detail-panel'
import { PaymentBadge } from './payment-badge'
import { StatusBadge } from '@/components/ui/status-badge'
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
 * send a colleague a link to the exact booking they are looking at.
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
] as const

export interface BookingsScreenProps {
  readonly rows: readonly BookingRow[]
  readonly detail: BookingDetailView | null
  readonly currency: string
  readonly onSetStatus: (payload: unknown) => Promise<Result<unknown>>
  readonly onMarkPaid: (payload: unknown) => Promise<Result<unknown>>
  readonly onRefund: (payload: unknown) => Promise<Result<unknown>>
}

export function BookingsScreen({
  rows,
  detail,
  currency,
  onSetStatus,
  onMarkPaid,
  onRefund,
}: BookingsScreenProps) {
  const router = useRouter()
  const unpaid = rows.filter((row) => row.paymentStatus === 'awaiting')

  return (
    <AdminScreen>
      <AdminPageHeader
        title="Bookings"
        subtitle={`${rows.length} in this window · ${unpaid.length} awaiting payment`}
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
        <div className={`${CARD} min-w-0 overflow-x-auto`}>
          {rows.length === 0 ? (
            <EmptyState>No bookings in this window yet.</EmptyState>
          ) : (
            <table
              aria-label="Bookings"
              className="w-full min-w-[1040px] border-collapse text-[14px]"
            >
              <thead className={TABLE_HEAD}>
                <tr>
                  {COLUMNS.map((column) => (
                    <th key={column} scope="col" className={CELL}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-t border-[#f2f5f8] ${row.id === detail?.id ? 'bg-surface-alt' : ''}`}
                  >
                    <td className={`${CELL} font-bold tabular-nums`}>
                      <Link href={`/admin/bookings?booking=${row.id}`} className="hover:text-olive">
                        {row.reference}
                      </Link>
                    </td>
                    <td className={CELL}>
                      <span className="block font-semibold">{row.name}</span>
                      <span className="mt-px block text-[12.5px] text-subtle">{row.contact}</span>
                    </td>
                    <td className={`${CELL} text-slate`}>{row.court}</td>
                    <td className={`${CELL} text-slate`}>{row.when}</td>
                    <td className={`${CELL} text-slate`}>{row.extras}</td>
                    <td className={CELL}>
                      <StatusBadge status={row.status} />
                    </td>
                    <td className={`${CELL} text-slate`}>{row.method}</td>
                    <td className={CELL}>
                      <PaymentBadge status={row.paymentStatus} />
                    </td>
                    <td className={`${CELL} text-right font-bold`}>{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {detail ? (
          <BookingDetailPanel
            detail={detail}
            currency={currency}
            onSetStatus={onSetStatus}
            onMarkPaid={onMarkPaid}
            onRefund={onRefund}
            onDone={() => router.refresh()}
          />
        ) : null}
      </div>
    </AdminScreen>
  )
}

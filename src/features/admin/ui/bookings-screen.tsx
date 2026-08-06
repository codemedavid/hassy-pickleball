import { AdminPageHeader, AdminScreen, CARD, CELL, EmptyState, TABLE_HEAD } from './primitives'
import { StatusBadge } from '@/components/ui/status-badge'
import type { BookingRow } from '../view/bookings'

/** The bookings ledger: every session on the calendar, newest window first. */

const COLUMNS = ['Reference', 'Customer', 'Court', 'When', 'Extras', 'Status', 'Total'] as const

export interface BookingsScreenProps {
  readonly rows: readonly BookingRow[]
}

export function BookingsScreen({ rows }: BookingsScreenProps) {
  const unpaid = rows.filter((row) => row.status === 'awaiting_payment' || row.status === 'pending')

  return (
    <AdminScreen>
      <AdminPageHeader
        title="Bookings"
        subtitle={`${rows.length} in this window · ${unpaid.length} awaiting payment`}
      />

      <div className={`${CARD} overflow-x-auto`}>
        {rows.length === 0 ? (
          <EmptyState>No bookings in this window yet.</EmptyState>
        ) : (
          <table aria-label="Bookings" className="w-full min-w-[900px] border-collapse text-[14px]">
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
                <tr key={row.id} className="border-t border-[#f2f5f8]">
                  <td className={`${CELL} font-bold tabular-nums`}>{row.reference}</td>
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
                  <td className={`${CELL} text-right font-bold`}>{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminScreen>
  )
}

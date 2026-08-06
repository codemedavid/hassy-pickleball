import { AdminPageHeader, AdminScreen, CARD, CELL, EmptyState, TABLE_HEAD } from './primitives'
import { formatMoney } from '@/lib/format/money'
import { formatDayInZone } from '@/lib/format/time'
import type { Customer } from '@/lib/repositories/booking-mappers'
import type { Club } from '@/lib/repositories/mappers'
import type { CustomerTier } from '@/lib/domain/types'

/** Players and members, highest lifetime spend first. */

const COLUMNS = ['Customer', 'Tier', 'Bookings', 'Lifetime', 'Last visit'] as const

const TIER_LABELS: Record<CustomerTier, string> = {
  standard: 'Standard',
  regular: 'Regular',
  pro: 'Pro',
}

const TIER_STYLES: Record<CustomerTier, string> = {
  standard: 'bg-surface-sunken text-muted',
  regular: 'bg-lime/35 text-olive',
  pro: 'bg-navy text-white',
}

const NEVER_VISITED = 'Never'

function initialsOf(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

export interface CustomersScreenProps {
  readonly customers: readonly Customer[]
  readonly club: Club
}

export function CustomersScreen({ customers, club }: CustomersScreenProps) {
  const members = customers.filter((customer) => customer.tier !== 'standard')

  return (
    <AdminScreen>
      <AdminPageHeader
        title="Customers"
        subtitle={`${customers.length} players · ${members.length} on a member tier`}
      />

      <div className={`${CARD} overflow-x-auto`}>
        {customers.length === 0 ? (
          <EmptyState>No customers yet.</EmptyState>
        ) : (
          <table
            aria-label="Customers"
            className="w-full min-w-[760px] border-collapse text-[14px]"
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
              {customers.map((customer) => (
                <tr key={customer.id} className="border-t border-[#f2f5f8]">
                  <td className={CELL}>
                    <span className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="grid size-[34px] flex-none place-items-center rounded-full bg-[#eef3f8] text-[12.5px] font-bold text-navy-mid"
                      >
                        {initialsOf(customer.fullName)}
                      </span>
                      <span>
                        <span className="block font-semibold">{customer.fullName}</span>
                        <span className="block text-[12.5px] text-subtle">{customer.email}</span>
                      </span>
                    </span>
                  </td>
                  <td className={CELL}>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase ${TIER_STYLES[customer.tier]}`}
                    >
                      {TIER_LABELS[customer.tier]}
                    </span>
                  </td>
                  <td className={`${CELL} text-slate tabular-nums`}>{customer.bookingsCount}</td>
                  <td className={`${CELL} text-slate tabular-nums`}>
                    {formatMoney(customer.totalSpendCents, club.currency)}
                  </td>
                  <td className={`${CELL} text-slate`}>
                    {/* An empty cell would read as a rendering bug, not as a fact. */}
                    {customer.lastVisitAt
                      ? formatDayInZone(customer.lastVisitAt, club.timeZone)
                      : NEVER_VISITED}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminScreen>
  )
}

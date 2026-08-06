import Link from 'next/link'
import { AdminPageHeader, AdminScreen, CARD, CELL, EmptyState, TABLE_HEAD } from './primitives'
import type { OrderDetail, OrderRow, OrderStatus } from '../view/orders'

/**
 * Court bookings, café orders, and passes in one ledger, with the selected
 * order broken down beside it. Selection travels in the URL so a staff member
 * can send a colleague a link to the exact order they are looking at.
 */

const COLUMNS = ['Order', 'Customer', 'Items', 'Method', 'Status', 'Total'] as const

const STATUS_LABELS: Record<OrderStatus, string> = {
  paid: 'Paid',
  awaiting: 'Awaiting',
  refunded: 'Refunded',
  failed: 'Failed',
}

const STATUS_STYLES: Record<OrderStatus, string> = {
  paid: 'bg-success-bg text-success',
  awaiting: 'bg-lime/35 text-olive',
  refunded: 'bg-surface-sunken text-muted',
  failed: 'bg-danger-bg text-danger',
}

function StatusPill({ status }: { readonly status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

export interface OrdersScreenProps {
  readonly rows: readonly OrderRow[]
  readonly detail: OrderDetail | null
}

export function OrdersScreen({ rows, detail }: OrdersScreenProps) {
  return (
    <AdminScreen>
      <AdminPageHeader
        title="Orders & payments"
        subtitle="Court bookings, café orders, and passes in one ledger"
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,1fr)]">
        <div className={`${CARD} min-w-0 overflow-x-auto`}>
          {rows.length === 0 ? (
            <EmptyState>No orders in this window yet.</EmptyState>
          ) : (
            <table
              aria-label="Orders and payments"
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
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-t border-[#f2f5f8] ${row.id === detail?.id ? 'bg-surface-alt' : ''}`}
                  >
                    <td className={`${CELL} font-bold tabular-nums`}>
                      <Link href={`/admin/orders?order=${row.id}`} className="hover:text-olive">
                        {row.reference}
                      </Link>
                    </td>
                    <td className={`${CELL} font-semibold`}>{row.who}</td>
                    <td className={`${CELL} text-slate`}>{row.items}</td>
                    <td className={`${CELL} text-slate`}>{row.method}</td>
                    <td className={CELL}>
                      <StatusPill status={row.status} />
                    </td>
                    <td className={`${CELL} text-right font-bold`}>{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {detail ? (
          <section aria-label={`Order ${detail.reference}`} className={`${CARD} px-6 py-5`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="m-0 font-[family-name:var(--font-display)] text-[19px] font-bold">
                {detail.reference}
              </h2>
              <StatusPill status={detail.status} />
            </div>

            <dl className="m-0 flex flex-col gap-2.5 border-b border-surface-sunken pb-4">
              {detail.meta.map((line) => (
                <div key={line.label} className="flex justify-between gap-4 text-[14px]">
                  <dt className="text-muted">{line.label}</dt>
                  <dd className="m-0 font-semibold">{line.value}</dd>
                </div>
              ))}
            </dl>

            <dl className="m-0 flex flex-col gap-2.5 border-b border-surface-sunken py-4">
              {detail.lines.map((line) => (
                <div key={line.label} className="flex justify-between gap-4 text-[14px]">
                  <dt className="text-slate">{line.label}</dt>
                  <dd className="m-0 tabular-nums">{line.value}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-3.5 mb-0 flex items-baseline justify-between">
              <span className="font-bold">Total</span>
              <span className="font-[family-name:var(--font-display)] text-[24px] font-bold">
                {detail.total}
              </span>
            </p>

            <p className="mt-4 mb-0 rounded-[11px] border border-surface-sunken bg-surface-alt px-4 py-3.5 text-[13.5px] leading-relaxed text-slate">
              {detail.note}
            </p>
          </section>
        ) : null}
      </div>
    </AdminScreen>
  )
}

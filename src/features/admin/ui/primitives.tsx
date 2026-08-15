import type { ReactNode } from 'react'
import type { StatCard } from '../view/schedule-stats'

/**
 * The pieces every admin screen repeats: page heading, stat row, card shell,
 * and the empty state. Kept here so the seven screens cannot drift apart.
 */

export const CARD = 'rounded-[14px] border border-line bg-surface'
export const TABLE_HEAD =
  'bg-surface-alt text-[11.5px] font-bold tracking-[0.08em] text-subtle uppercase'
export const CELL = 'px-4 py-3.5 text-left align-middle'

/**
 * The console's tables, which become a stack of cards below `sm`.
 *
 * One DOM serves both: a phone-only card list beside a desktop table would
 * double every value in the accessibility tree and drift the first time a
 * column changed. Below `sm` the table's `display` is overridden, which is what
 * drops a table's implicit roles in most browsers — so table, row, columnheader
 * and cell are spelled out. The header row goes `sr-only` rather than `hidden`,
 * and each cell prints its own column name from `data-label`, because a bare
 * value in a card is unattributable.
 */

const STACKED_ROW =
  'max-sm:block max-sm:border-t-8 max-sm:border-surface-alt max-sm:px-1 max-sm:py-1.5'

const STACKED_CELL =
  'max-sm:flex max-sm:items-baseline max-sm:justify-between max-sm:gap-4 max-sm:py-1.5 ' +
  'max-sm:before:flex-none max-sm:before:content-[attr(data-label)] ' +
  'max-sm:before:text-[11.5px] max-sm:before:font-bold max-sm:before:tracking-[0.08em] ' +
  'max-sm:before:text-subtle max-sm:before:uppercase'

export interface DataTableProps {
  readonly label: string
  readonly columns: readonly string[]
  /**
   * Minimum width for the table layout, which may only apply from `sm` up —
   * an unconditional one is what makes a phone scroll sideways.
   */
  readonly wideClassName?: string
  readonly children: ReactNode
}

export function DataTable({ label, columns, wideClassName = '', children }: DataTableProps) {
  return (
    <table
      role="table"
      aria-label={label}
      className={`w-full border-collapse text-[14px] max-sm:block ${wideClassName}`}
    >
      <thead className={`${TABLE_HEAD} max-sm:sr-only`}>
        <tr role="row">
          {columns.map((column, index) => (
            <th key={column || index} role="columnheader" scope="col" className={CELL}>
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="max-sm:block">{children}</tbody>
    </table>
  )
}

export interface RowProps {
  readonly className?: string
  readonly children: ReactNode
}

export function Row({ className = '', children }: RowProps) {
  return (
    <tr role="row" className={`border-t border-[#f2f5f8] ${STACKED_ROW} ${className}`}>
      {children}
    </tr>
  )
}

export interface CellProps {
  /** The column this cell sits under; printed beside the value on a phone. */
  readonly label: string
  readonly className?: string
  readonly children: ReactNode
}

export function Cell({ label, className = '', children }: CellProps) {
  return (
    <td role="cell" data-label={label} className={`${CELL} ${STACKED_CELL} ${className}`}>
      {children}
    </td>
  )
}

/**
 * A row that spans the table to hold an inline editor. It carries a form rather
 * than column values, so it takes no `data-label`.
 */
export function FullWidthRow({
  columnCount,
  className = '',
  children,
}: {
  readonly columnCount: number
  readonly className?: string
  readonly children: ReactNode
}) {
  return (
    <tr role="row" className={`border-t border-[#f2f5f8] max-sm:block ${className}`}>
      <td role="cell" colSpan={columnCount} className="bg-surface-alt p-0 max-sm:block">
        {children}
      </td>
    </tr>
  )
}

export interface AdminPageHeaderProps {
  readonly title: string
  readonly subtitle: string
  readonly children?: ReactNode
}

export function AdminPageHeader({ title, subtitle, children }: AdminPageHeaderProps) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="mb-1 font-[family-name:var(--font-display)] text-[28px] font-bold tracking-[-0.03em]">
          {title}
        </h1>
        <p className="m-0 text-[14px] text-muted">{subtitle}</p>
      </div>
      {children ? <div className="flex flex-wrap gap-2.5">{children}</div> : null}
    </div>
  )
}

export interface StatCardsProps {
  readonly stats: readonly StatCard[]
}

export function StatCards({ stats }: StatCardsProps) {
  return (
    <div className="mb-[18px] grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className={`${CARD} px-[18px] py-4`}>
          <p className="m-0 text-[12px] font-bold tracking-[0.09em] text-subtle uppercase">
            {stat.label}
          </p>
          <p className="my-1.5 font-[family-name:var(--font-display)] text-[27px] font-bold">
            {stat.value}
          </p>
          <p className="m-0 text-[12.5px] font-semibold text-olive">{stat.detail}</p>
        </div>
      ))}
    </div>
  )
}

export interface EmptyStateProps {
  readonly children: ReactNode
}

export function EmptyState({ children }: EmptyStateProps) {
  return <p className="m-0 px-4 py-10 text-center text-[14px] text-muted">{children}</p>
}

/** Screen shell: the max width and padding shared by every admin page. */
export function AdminScreen({ children }: { readonly children: ReactNode }) {
  return <div className="mx-auto max-w-[1440px] px-5 pt-6 pb-16 sm:px-7">{children}</div>
}

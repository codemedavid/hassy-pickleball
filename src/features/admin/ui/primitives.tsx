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

import { AdminPageHeader, AdminScreen, CARD, EmptyState } from './primitives'
import type { PricingRuleRow } from '../view/pricing'

/**
 * Pricing rules, in the order the engine evaluates them. The numbering is the
 * behaviour, not decoration — the first rule that matches sets the rate.
 */

export interface PricingScreenProps {
  readonly rows: readonly PricingRuleRow[]
}

export function PricingScreen({ rows }: PricingScreenProps) {
  return (
    <AdminScreen>
      <AdminPageHeader
        title="Pricing rules"
        subtitle="Rules apply top to bottom. The first match sets the rate."
      />

      {rows.length === 0 ? (
        <div className={CARD}>
          <EmptyState>No pricing rules yet — every court bills at its base rate.</EmptyState>
        </div>
      ) : (
        <ol aria-label="Pricing rules" className="m-0 flex list-none flex-col gap-3 p-0">
          {rows.map((row) => (
            <li
              key={row.id}
              className={`${CARD} flex flex-wrap items-center gap-5 px-[22px] py-[18px]`}
            >
              <span className="grid size-[26px] flex-none place-items-center rounded-[7px] bg-canvas text-[12.5px] font-bold text-muted">
                {row.order}
              </span>

              <span className="min-w-[180px] flex-1">
                <span className="block text-[15.5px] font-bold">{row.name}</span>
                <span className="mt-1 block text-[13px] text-muted">{row.condition}</span>
              </span>

              <span className="flex max-w-[280px] flex-wrap gap-1.5">
                {row.courts.map((court) => (
                  <span
                    key={court}
                    className="rounded-[7px] border border-line bg-surface-alt px-2.5 py-1 text-[12px] text-slate"
                  >
                    {court}
                  </span>
                ))}
              </span>

              <span className="w-[110px] flex-none text-right font-[family-name:var(--font-display)] text-[21px] font-bold">
                {row.rate}
              </span>
            </li>
          ))}
        </ol>
      )}
    </AdminScreen>
  )
}

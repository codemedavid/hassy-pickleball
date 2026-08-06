import { AdminPageHeader, AdminScreen, CARD, StatCards } from './primitives'
import type { Report } from '../view/reports'

/**
 * The reporting view. Both charts print their numbers as text beside the bars:
 * a bar's height is invisible to a screen reader, and to anyone reading a
 * printout of this page.
 */

const CHART_HEIGHT_PX = 210

export interface ReportsScreenProps {
  readonly report: Report
  readonly rangeLabel: string
}

export function ReportsScreen({ report, rangeLabel }: ReportsScreenProps) {
  return (
    <AdminScreen>
      <AdminPageHeader title="Reports" subtitle={rangeLabel} />

      <StatCards stats={report.stats} />

      <div className="grid items-start gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section aria-label="Utilization by hour" className={`${CARD} px-6 py-5`}>
          <h2 className="mt-0 mb-4 font-[family-name:var(--font-display)] text-[18px] font-bold">
            Utilization by hour
          </h2>
          <ul
            aria-label="Utilization by hour"
            className="m-0 flex list-none items-end gap-2 p-0"
            style={{ height: CHART_HEIGHT_PX }}
          >
            {report.utilization.map((hour) => (
              <li
                key={hour.label}
                className="flex h-full flex-1 flex-col items-center justify-end gap-2"
              >
                <span
                  aria-hidden
                  className={`w-full rounded-t-md ${
                    hour.percent > 85 ? 'bg-navy' : hour.percent > 60 ? 'bg-navy-mid' : 'bg-lime'
                  }`}
                  style={{ height: `${hour.percent}%` }}
                />
                <span className="text-[10.5px] text-subtle tabular-nums">{hour.label}</span>
                <span className="sr-only">{hour.percent}% utilized</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Revenue by court" className={`${CARD} px-6 py-5`}>
          <h2 className="mt-0 mb-4 font-[family-name:var(--font-display)] text-[18px] font-bold">
            Revenue by court
          </h2>
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {report.revenueByCourt.map((court) => (
              <li key={court.courtId}>
                <span className="mb-2 flex justify-between gap-3 text-[14px]">
                  <span className="font-semibold">{court.name}</span>
                  <span className="text-muted tabular-nums">{court.value}</span>
                </span>
                <span aria-hidden className="block h-2 rounded-full bg-[#f2f5f8]">
                  <span
                    className="block h-full rounded-full bg-navy"
                    style={{ width: `${court.percent}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-6 border-t border-surface-sunken pt-4">
            <p className="m-0 text-[12px] font-bold tracking-[0.1em] text-subtle uppercase">
              Attach rate
            </p>
            <p className="mt-2 mb-0 font-[family-name:var(--font-display)] text-[30px] font-bold">
              {report.attachRatePercent}%
            </p>
            <p className="mt-1 mb-0 text-[13px] text-muted">
              of bookings added a café or add-on item
            </p>
          </div>
        </section>
      </div>
    </AdminScreen>
  )
}

import { AdminPageHeader, AdminScreen, CARD, EmptyState, StatCards } from './primitives'
import type { ScheduleGrid, ScheduleTone } from '../view/schedule'
import type { StatCard } from '../view/schedule-stats'

/**
 * The day view of the court schedule.
 *
 * Entries are positioned as percentages of the column, which the view model
 * has already worked out. The colour of an entry is never its only meaning:
 * every entry prints its own time range, and the legend names each tone.
 */

const ROW_HEIGHT_PX = 58

const TONE_STYLES: Record<ScheduleTone, string> = {
  confirmed: 'bg-navy text-white',
  awaiting: 'bg-lime text-navy',
  blocked: 'border border-line-strong bg-surface-sunken text-muted',
  event: 'bg-navy-mid text-white',
}

const LEGEND: readonly { readonly tone: ScheduleTone; readonly label: string }[] = [
  { tone: 'confirmed', label: 'Confirmed' },
  { tone: 'awaiting', label: 'Awaiting payment' },
  { tone: 'blocked', label: 'Maintenance or blocked' },
  { tone: 'event', label: 'League or event' },
]

export interface ScheduleScreenProps {
  readonly grid: ScheduleGrid
  readonly stats: readonly StatCard[]
  readonly dayLabel: string
}

export function ScheduleScreen({ grid, stats, dayLabel }: ScheduleScreenProps) {
  const columnTemplate = `74px repeat(${grid.columns.length}, minmax(150px, 1fr))`
  const bodyHeight = grid.hourLabels.length * ROW_HEIGHT_PX

  return (
    <AdminScreen>
      <AdminPageHeader
        title="Court schedule"
        subtitle={`${dayLabel} · bookings and blocked time across every court`}
      />

      <StatCards stats={stats} />

      <div className={`${CARD} overflow-x-auto`}>
        {grid.columns.length === 0 ? (
          <EmptyState>No active courts to schedule yet.</EmptyState>
        ) : (
          <div role="table" aria-label="Court schedule" className="min-w-[680px]">
            <div role="rowgroup">
              <div
                role="row"
                className="grid border-b border-surface-sunken bg-surface-alt"
                style={{ gridTemplateColumns: columnTemplate }}
              >
                <span
                  role="columnheader"
                  className="px-2.5 py-3.5 text-[12px] font-bold text-subtle"
                >
                  Time
                </span>
                {grid.columns.map((column) => (
                  <span
                    key={column.courtId}
                    role="columnheader"
                    className="border-l border-surface-sunken px-3.5 py-3 text-left"
                  >
                    <span className="block text-[14.5px] font-bold">{column.courtName}</span>
                    <span className="mt-0.5 block text-[12px] font-normal text-subtle">
                      {column.meta}
                    </span>
                  </span>
                ))}
              </div>
            </div>

            <div role="rowgroup">
              <div role="row" className="grid" style={{ gridTemplateColumns: columnTemplate }}>
                <span role="rowheader" className="block">
                  {grid.hourLabels.map((label) => (
                    <span
                      key={label}
                      className="flex items-start border-b border-[#f2f5f8] px-2.5 pt-1.5 text-[12px] text-subtle tabular-nums"
                      style={{ height: ROW_HEIGHT_PX }}
                    >
                      {label}
                    </span>
                  ))}
                </span>

                {grid.columns.map((column) => (
                  <span
                    key={column.courtId}
                    role="cell"
                    className="relative block border-l border-surface-sunken"
                    style={{ height: bodyHeight }}
                  >
                    {/* Hour rules, drawn behind the entries. */}
                    <span aria-hidden className="absolute inset-0">
                      {grid.hourLabels.map((label) => (
                        <span
                          key={label}
                          className="block border-b border-[#f2f5f8]"
                          style={{ height: ROW_HEIGHT_PX }}
                        />
                      ))}
                    </span>

                    {column.entries.map((entry) => (
                      <span
                        key={entry.id}
                        className={`absolute right-1 left-1 overflow-hidden rounded-lg px-2.5 py-1.5 ${TONE_STYLES[entry.tone]}`}
                        style={{
                          top: `${entry.topPercent}%`,
                          height: `${entry.heightPercent}%`,
                        }}
                      >
                        <span className="block text-[12.5px] leading-tight font-bold">
                          {entry.title}
                        </span>
                        <span className="mt-0.5 block text-[11.5px] opacity-80">
                          {entry.detail}
                        </span>
                      </span>
                    ))}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <ul
        aria-label="Schedule legend"
        className="mt-3.5 flex list-none flex-wrap gap-4 p-0 text-[12.5px] text-muted"
      >
        {LEGEND.map((item) => (
          <li key={item.tone} className="flex items-center gap-2">
            <span aria-hidden className={`size-3 rounded-[3px] ${TONE_STYLES[item.tone]}`} />
            {item.label}
          </li>
        ))}
      </ul>
    </AdminScreen>
  )
}

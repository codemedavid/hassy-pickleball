'use client'

import type { SlotRow, SlotState } from '../view/court-detail'

/**
 * The two ways the design lets a customer read a day: a timeline of every
 * half hour with wording and price, and a dense grid of just the start times.
 *
 * Both are presentational — the rows arrive already derived, so this file
 * only decides how a state looks, never what it means.
 */

export type SlotStyle = 'timeline' | 'grid'

const TIMELINE_TONE: Record<SlotState, string> = {
  selected: 'bg-lime text-ink shadow-[inset_3px_0_0_var(--color-lime-deep)]',
  included: 'bg-lime-soft text-ink',
  available: 'bg-surface text-ink hover:bg-canvas',
  booked: 'bg-surface-sunken text-subtle',
}

const CHIP_TONE: Record<SlotState, string> = {
  selected: 'border-lime-deep bg-lime text-ink',
  included: 'border-lime-deep bg-lime-soft text-ink',
  available: 'border-line-heavy bg-surface text-ink hover:border-ink',
  booked: 'border-line bg-surface-sunken text-subtle',
}

type SlotPickerProps = {
  readonly rows: readonly SlotRow[]
  readonly slotStyle: SlotStyle
  readonly onSelect: (row: SlotRow) => void
}

export function SlotPicker({ rows, slotStyle, onSelect }: SlotPickerProps) {
  if (rows.length === 0) {
    return (
      <p className="rounded-[12px] border border-line bg-canvas px-4 py-6 text-center text-[14px] text-muted">
        No start times on this day. Try another date or a shorter session.
      </p>
    )
  }

  if (slotStyle === 'grid') {
    return (
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
        {rows.map((row) => (
          <button
            key={row.startsAt.toISOString()}
            type="button"
            disabled={!row.isSelectable}
            aria-pressed={row.state === 'selected'}
            onClick={() => onSelect(row)}
            className={`rounded-[10px] border px-2 py-2.5 text-center disabled:cursor-not-allowed ${CHIP_TONE[row.state]}`}
          >
            <span className="block text-[14px] font-bold tabular-nums">{row.time}</span>
            <span className="mt-0.5 block text-[11.5px] opacity-72">
              {row.state === 'booked' ? 'Booked' : row.price}
            </span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[12px] border border-line">
      {rows.map((row) => (
        <button
          key={row.startsAt.toISOString()}
          type="button"
          disabled={!row.isSelectable}
          aria-pressed={row.state === 'selected'}
          onClick={() => onSelect(row)}
          className={`flex w-full items-center gap-3.5 border-b border-surface-sunken px-4 py-2.5 text-left text-[14px] last:border-b-0 disabled:cursor-not-allowed ${TIMELINE_TONE[row.state]}`}
        >
          <span className="w-16 flex-none font-medium tabular-nums">{row.time}</span>
          <span className="flex-1">{row.label}</span>
          <span className="flex-none font-bold tabular-nums">{row.price}</span>
        </button>
      ))}
    </div>
  )
}

/** The colour key under the picker. Explains the grid without a tooltip. */
export function SlotLegend() {
  const keys = [
    { label: 'Selected', className: 'bg-lime border-lime-deep' },
    { label: 'Available', className: 'bg-surface border-line-heavy' },
    { label: 'Booked', className: 'bg-canvas border-line' },
  ]

  return (
    <ul className="mt-4 flex flex-wrap gap-5 text-[12.5px] text-muted">
      {keys.map((key) => (
        <li key={key.label} className="flex items-center gap-1.5">
          <span aria-hidden className={`h-2.5 w-2.5 rounded-[3px] border ${key.className}`} />
          {key.label}
        </li>
      ))}
    </ul>
  )
}

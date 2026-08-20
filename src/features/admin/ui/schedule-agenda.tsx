'use client'

import { CARD } from './primitives'
import { SCHEDULE_TONE_STYLES } from './schedule-tones'
import type { ScheduleAgendaEntry, ScheduleAgendaSection } from '../view/schedule-agenda'

/**
 * The day, court by court, for a screen that has no room for a grid.
 *
 * The grid needs 680px before it can be read at all, so on a phone the same
 * bookings are a list: one card per court, each entry led by the time it
 * covers. Nothing is carried by colour — the tone is a bar down the side and a
 * word beside the title — because a list scrolls away from any legend.
 */

export interface ScheduleAgendaProps {
  readonly sections: readonly ScheduleAgendaSection[]
  readonly isPending: boolean
  readonly onRelease: (blockId: string) => void
}

export function ScheduleAgenda({ sections, isPending, onRelease }: ScheduleAgendaProps) {
  return (
    <section aria-label="Court schedule" className="flex flex-col gap-3">
      {sections.map((section) => (
        <article key={section.courtId} className={`${CARD} overflow-hidden`}>
          <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line bg-surface-alt px-4 py-3">
            <h2 className="m-0 font-[family-name:var(--font-display)] text-[17px] font-bold">
              {section.courtName}
            </h2>
            <span className="rounded-full bg-lime-soft px-2.5 py-1 text-[11.5px] font-bold text-olive">
              {section.openLabel}
            </span>
            <p className="m-0 basis-full text-[12.5px] text-subtle">
              <span>{section.meta}</span>
              <span aria-hidden> · </span>
              <span className="font-semibold text-muted">{section.summary}</span>
            </p>
          </header>

          {section.entries.length > 0 ? (
            <ul
              aria-label={`${section.courtName} schedule`}
              className="m-0 flex list-none flex-col p-0"
            >
              {section.entries.map((entry) => (
                <AgendaEntry
                  key={entry.id}
                  entry={entry}
                  isPending={isPending}
                  onRelease={onRelease}
                />
              ))}
            </ul>
          ) : null}
        </article>
      ))}
    </section>
  )
}

interface AgendaEntryProps {
  readonly entry: ScheduleAgendaEntry
  readonly isPending: boolean
  readonly onRelease: (blockId: string) => void
}

function AgendaEntry({ entry, isPending, onRelease }: AgendaEntryProps) {
  return (
    <li className="flex items-start gap-3 border-t border-[#f2f5f8] px-4 py-3 first:border-t-0">
      <span
        aria-hidden
        className={`mt-1 h-9 w-1 flex-none rounded-full ${SCHEDULE_TONE_STYLES[entry.tone]}`}
      />

      <div className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-semibold text-slate tabular-nums">
          {entry.detail}
        </span>
        <span className="mt-px block truncate text-[15px] font-bold">{entry.title}</span>
        <span
          className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-bold tracking-wide uppercase ${SCHEDULE_TONE_STYLES[entry.tone]}`}
        >
          {entry.toneLabel}
        </span>
      </div>

      {/* A booking is cancelled through its own screen, so only holds end here. */}
      {entry.blockId ? (
        <button
          type="button"
          aria-label={`Release ${entry.title}`}
          disabled={isPending}
          onClick={() => onRelease(entry.blockId as string)}
          className="inline-flex h-10 flex-none items-center rounded-xl border border-line-strong bg-surface px-3.5 text-[13px] font-semibold text-ink hover:border-line-heavy disabled:opacity-55"
        >
          Release
        </button>
      ) : null}
    </li>
  )
}

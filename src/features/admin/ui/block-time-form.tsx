'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  blankBlockForm,
  blockFormError,
  toBlockPayload,
  type BlockFormState,
} from '../view/block-form'
import type { AvailabilityBlock } from '@/lib/repositories/booking-mappers'
import type { Club, Court } from '@/lib/repositories/mappers'
import type { Enums } from '@/lib/repositories/rows'
import type { Result } from '@/lib/api/result'

/**
 * Holding court time from the schedule itself.
 *
 * The form sits under the grid staff are already reading, because the decision
 * to block is made by looking at the day, not by navigating somewhere else. It
 * starts on the day currently on screen, while keeping the date visible and
 * editable so staff can schedule a future closure without stepping through the
 * day navigation first.
 *
 * Only the cheap checks happen here. Whether the window is free is settled by
 * the database's exclusion constraint, and its message is what gets shown.
 */

export interface BlockTimeFormProps {
  /** Club-local calendar day being viewed, "YYYY-MM-DD". */
  readonly day: string
  readonly club: Club
  readonly courts: readonly Court[]
  readonly onBlock: (payload: unknown) => Promise<Result<AvailabilityBlock>>
}

const KIND_LABELS: Record<Enums['block_kind'], string> = {
  maintenance: 'Maintenance',
  league: 'League',
  private: 'Private hire',
  closed: 'Closed',
}

const FIELD =
  'h-11 rounded-xl border border-line-strong bg-surface px-3 text-[15px] text-ink sm:h-10 sm:text-[14px] ' +
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-navy-mid'
const LABEL = 'text-[13px] font-semibold text-ink'

export function BlockTimeForm({ day, club, courts, onBlock }: BlockTimeFormProps) {
  const router = useRouter()
  const blank = () => blankBlockForm({ courtId: courts[0]?.id ?? '', opensAt: club.opensAt, day })

  const [form, setForm] = useState<BlockFormState>(blank)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const ids = useFieldIds()

  function update<K extends keyof BlockFormState>(key: K, value: BlockFormState[K]): void {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()

    const message = blockFormError(form)

    if (message) {
      setError(message)
      return
    }

    setError(null)

    startTransition(async () => {
      const blockedDay = form.day
      const result = await onBlock(toBlockPayload(form, { timeZone: club.timeZone }))

      if (!result.success) {
        setError(result.error)
        return
      }

      setForm(blank())

      if (blockedDay === day) {
        router.refresh()
      } else {
        router.push(`/admin?day=${blockedDay}`)
      }
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Block court time"
      className="mt-4 grid gap-3 rounded-[14px] border border-line bg-surface p-4 sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1.1fr_0.8fr_0.8fr_1.6fr_auto]"
    >
      <Field id={ids.court} label="Court">
        <select
          id={ids.court}
          value={form.courtId}
          onChange={(event) => update('courtId', event.target.value)}
          className={FIELD}
        >
          {courts.map((court) => (
            <option key={court.id} value={court.id}>
              {court.name}
            </option>
          ))}
        </select>
      </Field>

      <Field id={ids.kind} label="Reason type">
        <select
          id={ids.kind}
          value={form.kind}
          onChange={(event) => update('kind', event.target.value as Enums['block_kind'])}
          className={FIELD}
        >
          {Object.entries(KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      <Field id={ids.day} label="Date">
        <input
          id={ids.day}
          type="date"
          value={form.day}
          onChange={(event) => update('day', event.target.value)}
          className={FIELD}
        />
      </Field>

      <Field id={ids.from} label="From">
        <input
          id={ids.from}
          type="time"
          value={form.startTime}
          onChange={(event) => update('startTime', event.target.value)}
          className={FIELD}
        />
      </Field>

      <Field id={ids.to} label="To">
        <input
          id={ids.to}
          type="time"
          value={form.endTime}
          onChange={(event) => update('endTime', event.target.value)}
          className={FIELD}
        />
      </Field>

      <Field id={ids.reason} label="Reason" hint="Shown on the grid in place of the reason type.">
        <input
          id={ids.reason}
          value={form.reason}
          onChange={(event) => update('reason', event.target.value)}
          maxLength={200}
          className={FIELD}
        />
      </Field>

      <div className="flex items-end">
        <Button type="submit" isPending={isPending} isFullWidth>
          Block time
        </Button>
      </div>

      {error ? (
        <p
          role="alert"
          className="m-0 text-[13px] font-semibold text-danger sm:col-span-2 xl:col-span-7"
        >
          {error}
        </p>
      ) : null}
    </form>
  )
}

function useFieldIds() {
  const prefix = useId()

  return {
    court: `${prefix}-court`,
    kind: `${prefix}-kind`,
    day: `${prefix}-day`,
    from: `${prefix}-from`,
    to: `${prefix}-to`,
    reason: `${prefix}-reason`,
  }
}

interface FieldProps {
  readonly id: string
  readonly label: string
  readonly hint?: string
  readonly children: React.ReactNode
}

function Field({ id, label, hint, children }: FieldProps) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      {children}
      {hint ? <span className="text-[12px] text-subtle">{hint}</span> : null}
    </div>
  )
}

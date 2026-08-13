import { parseClockTime, zonedTimeToUtc } from '@/lib/domain/time'
import type { Enums } from '@/lib/repositories/rows'

/**
 * The "hold this court" form, as data.
 *
 * The date and times are held as the strings native inputs carry and converted
 * once, on submit, through the club's timezone — a block typed as 9:00 must
 * hold the club's 9:00 whatever zone the browser is in. The conversion lives
 * here rather than in the component so it is testable without a DOM, matching
 * ./court-form.
 *
 * Whether the window is actually free is not decided here. That is the
 * database's exclusion constraint; these checks only catch the mistakes that
 * are not worth a round trip.
 */

const DEFAULT_BLOCK_MINUTES = 60
const MINUTES_PER_HOUR = 60
/** "HH:MM" — the form a time input reads and writes. */
const CLOCK_LENGTH = 5
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export type BlockFormState = {
  readonly courtId: string
  readonly kind: Enums['block_kind']
  readonly reason: string
  /** Club-local calendar day, "YYYY-MM-DD". */
  readonly day: string
  /** Club-local wall clock, "HH:MM". */
  readonly startTime: string
  readonly endTime: string
}

export type BlockPayload = {
  readonly courtId: string
  readonly kind: Enums['block_kind']
  readonly reason: string | null
  readonly startsAt: Date
  readonly endsAt: Date
}

export type BlockFormContext = {
  readonly timeZone: string
}

function toClock(minutesOfDay: number): string {
  const hours = Math.floor(minutesOfDay / MINUTES_PER_HOUR)
  const minutes = minutesOfDay % MINUTES_PER_HOUR

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/**
 * A one-hour hold on the club's first bookable time — the shape most blocks
 * take, so the common case is two clicks rather than four fields.
 */
export function blankBlockForm(input: {
  readonly courtId: string
  readonly day: string
  /** The club's opening time, "HH:MM" or the "HH:MM:SS" Postgres returns. */
  readonly opensAt: string
}): BlockFormState {
  const opensAt = parseClockTime(input.opensAt)

  return {
    courtId: input.courtId,
    kind: 'maintenance',
    reason: '',
    day: input.day,
    startTime: toClock(opensAt),
    endTime: toClock(opensAt + DEFAULT_BLOCK_MINUTES),
  }
}

/** The message to show the staff member, or null when the form can be sent. */
export function blockFormError(form: BlockFormState): string | null {
  if (form.courtId === '') {
    return 'Choose the court to block'
  }

  if (!DAY_PATTERN.test(form.day)) {
    return 'Choose the date that will be unavailable'
  }

  if (form.startTime.length < CLOCK_LENGTH || form.endTime.length < CLOCK_LENGTH) {
    return 'Set a start and an end time'
  }

  if (parseClockTime(form.endTime) <= parseClockTime(form.startTime)) {
    return 'A block must end after it starts'
  }

  return null
}

export function toBlockPayload(form: BlockFormState, context: BlockFormContext): BlockPayload {
  const reason = form.reason.trim()

  return {
    courtId: form.courtId,
    kind: form.kind,
    reason: reason === '' ? null : reason,
    startsAt: zonedTimeToUtc(form.day, parseClockTime(form.startTime), context.timeZone),
    endsAt: zonedTimeToUtc(form.day, parseClockTime(form.endTime), context.timeZone),
  }
}

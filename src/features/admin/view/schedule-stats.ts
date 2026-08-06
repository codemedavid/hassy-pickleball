import { isLive, openingWindow, toLocalInterval, toPercent } from './shared'
import { formatMoney } from '@/lib/format/money'
import type { BookingDetail } from '@/lib/repositories/bookings'
import type { Club, Court } from '@/lib/repositories/mappers'

/** The four cards above the schedule grid. */

export type StatCard = {
  readonly label: string
  readonly value: string
  readonly detail: string
}

export type ScheduleStatsInput = {
  readonly club: Club
  readonly courts: readonly Court[]
  readonly bookings: readonly BookingDetail[]
  readonly day: string
}

/** Both statuses mean the club is still owed money for a live booking. */
const UNPAID_STATUSES = ['pending', 'awaiting_payment'] as const

function bookedMinutes(bookings: readonly BookingDetail[], timeZone: string): number {
  return bookings
    .filter(isLive)
    .flatMap((detail) => detail.segments)
    .reduce((total, segment) => {
      const { from, to } = toLocalInterval(segment.startsAt, segment.endsAt, timeZone)
      return total + (to - from)
    }, 0)
}

export function buildScheduleStats(input: ScheduleStatsInput): readonly StatCard[] {
  const live = input.bookings.filter(isLive)
  const window = openingWindow(input.club)

  const capacityMinutes = input.courts.length * window.totalMinutes
  const unpaid = live.filter((detail) => {
    return (UNPAID_STATUSES as readonly string[]).includes(detail.booking.status)
  })

  const revenueCents = live.reduce((total, detail) => total + detail.booking.totalCents, 0)
  const addOnCents = live.reduce((total, detail) => total + detail.booking.itemsSubtotalCents, 0)

  return [
    {
      label: 'Today',
      value: `${live.length} ${live.length === 1 ? 'booking' : 'bookings'}`,
      detail: `${input.courts.length} ${input.courts.length === 1 ? 'court' : 'courts'} open`,
    },
    {
      label: 'Utilization',
      value: `${toPercent(bookedMinutes(input.bookings, input.club.timeZone), capacityMinutes)}%`,
      detail: 'Of the day’s court hours',
    },
    {
      label: 'Awaiting payment',
      value: `${unpaid.length}`,
      detail: unpaid.length === 0 ? 'Everything is settled' : 'Chase before the session starts',
    },
    {
      label: 'Revenue today',
      value: formatMoney(revenueCents, input.club.currency),
      detail: `${formatMoney(addOnCents, input.club.currency)} from add-ons`,
    },
  ]
}

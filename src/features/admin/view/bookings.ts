import { durationMinutes } from '@/lib/domain/time'
import { formatMinutes, formatMoney } from '@/lib/format/money'
import { formatDayInZone, formatTimeInZone } from '@/lib/format/time'
import type { BookingItemLine } from '@/lib/repositories/booking-mappers'
import type { BookingDetail } from '@/lib/repositories/bookings'
import type { Club } from '@/lib/repositories/mappers'
import type { BookingStatus } from '@/lib/domain/types'

/** One row of the admin Bookings table. */

export type BookingRow = {
  readonly id: string
  readonly reference: string
  readonly name: string
  readonly contact: string
  readonly court: string
  readonly when: string
  readonly extras: string
  readonly status: BookingStatus
  readonly total: string
}

const NOTHING = '—'

/** A quantity of one is implied; printing "×1" on every line is noise. */
function describeItem(item: BookingItemLine): string {
  return item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name
}

function courtNames(detail: BookingDetail): string {
  const names = detail.segments.flatMap((segment) => (segment.courtName ? [segment.courtName] : []))

  return names.length > 0 ? [...new Set(names)].join(', ') : NOTHING
}

function extras(detail: BookingDetail): string {
  return detail.items.length > 0 ? detail.items.map(describeItem).join(', ') : NOTHING
}

export function toBookingRows(
  bookings: readonly BookingDetail[],
  club: Club,
): readonly BookingRow[] {
  return bookings.map(({ booking, segments, items, payments }) => {
    const detail = { booking, segments, items, payments }
    const minutes = durationMinutes({ startsAt: booking.startsAt, endsAt: booking.endsAt })

    return {
      id: booking.id,
      reference: booking.reference,
      name: booking.contactName,
      // A phone number is what the desk actually uses to chase someone.
      contact: booking.contactPhone ?? booking.contactEmail,
      court: courtNames(detail),
      when: [
        formatDayInZone(booking.startsAt, club.timeZone),
        formatTimeInZone(booking.startsAt, club.timeZone),
        formatMinutes(minutes),
      ].join(' · '),
      extras: extras(detail),
      // The badge component owns the wording; the raw status crosses unchanged.
      status: booking.status,
      total: formatMoney(booking.totalCents, club.currency),
    }
  })
}

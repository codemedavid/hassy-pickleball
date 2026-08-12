import 'server-only'

import { setBookingStatusSchema } from '@/lib/api/admin-schemas'
import { invalid, withStaff } from './session'
import { loadBookingDetail, updateBookingStatus } from '@/lib/repositories/bookings'
import { canTransition } from '@/lib/domain/booking-status'
import type { Booking } from '@/lib/repositories/booking-mappers'
import type { BookingStatus } from '@/lib/domain/types'
import type { Result } from '@/lib/api/result'

/**
 * Moving a booking through its life from the admin console.
 *
 * The transition is judged against the stored row rather than anything the
 * caller sends, so two staff members acting from screens that loaded a minute
 * apart cannot both confirm the same booking out of the same stale status. The
 * table itself lives in @/lib/domain/booking-status, shared with the console so
 * the buttons offered are exactly the moves accepted here.
 */

const MISSING_MESSAGE = 'That booking is no longer there'

function refusal(from: BookingStatus, to: BookingStatus): string {
  return from === to
    ? 'That booking is already in that state'
    : `A ${from.replace('_', ' ')} booking cannot become ${to.replace('_', ' ')}`
}

export async function setBookingStatus(input: unknown): Promise<Result<Booking>> {
  const parsed = setBookingStatusSchema.safeParse(input)

  if (!parsed.success) {
    return invalid('Choose a booking and a state to move it to')
  }

  const { bookingId, status } = parsed.data

  return withStaff(async ({ client }) => {
    const detail = await loadBookingDetail(client, bookingId)

    if (!detail) {
      return invalid(MISSING_MESSAGE)
    }

    const current = detail.booking.status

    if (!canTransition(current, status)) {
      return invalid(refusal(current, status))
    }

    return await updateBookingStatus(client, bookingId, status)
  }).then(flatten)
}

/**
 * `withStaff` wraps whatever the callback returns in its own Ok, so a refusal
 * returned from inside arrives nested one level deep. Mirrors ./media.ts.
 */
function flatten(outer: Result<Result<never> | Booking>): Result<Booking> {
  if (!outer.success) {
    return outer
  }

  const inner = outer.data

  return isRefusal(inner) ? inner : { success: true, data: inner }
}

function isRefusal(value: Result<never> | Booking): value is Result<never> {
  return 'success' in value && value.success === false
}

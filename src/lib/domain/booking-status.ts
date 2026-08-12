import type { BookingStatus } from './types'

/**
 * Where a booking can go from where it is.
 *
 * One table, shared by the console and the server module that enforces it, so
 * the buttons the desk is offered are exactly the moves that will be accepted.
 *
 * `cancelled` and `completed` are terminal. Reviving either would re-arm
 * `booking_courts_no_double_booking` against a slot that may have been resold
 * in the meantime; the desk rebooks instead, which goes through the
 * availability check like any other booking.
 */
const TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending: ['awaiting_payment', 'confirmed', 'cancelled'],
  awaiting_payment: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

export function nextStatuses(from: BookingStatus): readonly BookingStatus[] {
  return TRANSITIONS[from]
}

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

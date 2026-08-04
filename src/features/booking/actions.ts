'use server'

/**
 * The booking feature's server-action surface.
 *
 * Deliberately thin: each action delegates to a module under ./server, which
 * is a plain module and therefore unit-testable. A 'use server' file is a
 * network boundary, not a place for logic.
 */

import { getAvailability } from './server/availability'
import { createBooking } from './server/create-booking'
import { cancelBooking, findBooking, type BookingSummary } from './server/lifecycle'
import type { Result } from '@/lib/api/result'
import type { CourtAvailability } from '@/lib/services/availability'

export async function getAvailabilityAction(input: unknown): Promise<Result<CourtAvailability[]>> {
  return getAvailability(input)
}

export async function createBookingAction(input: unknown): Promise<Result<BookingSummary>> {
  return createBooking(input)
}

export async function findBookingAction(input: unknown): Promise<Result<BookingSummary>> {
  return findBooking(input)
}

export async function cancelBookingAction(input: unknown): Promise<Result<BookingSummary>> {
  return cancelBooking(input)
}

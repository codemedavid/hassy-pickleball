import 'server-only'

import {
  firstRow,
  ILLEGAL_TRANSITION,
  NO_MATCH,
  toSummary,
  underLookupLimit,
  type BookingRpcRow,
  type BookingSummary,
} from './booking-summary'
import { err, ok, type Result } from '@/lib/api/result'
import { bookingLookupSchema } from '@/lib/api/schemas'
import { RATE_LIMITED_CODE } from '@/lib/security/rate-limit'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { callPendingRpc } from '@/lib/supabase/rpc'

/**
 * Guest-side booking management: look one up, or cancel it.
 *
 * Both authenticate on reference + email and run through service_role RPCs,
 * because a policy that let anon read by reference alone would expose every
 * booking to anyone who could guess one. Both are therefore equally enumerable
 * and both are metered — cancellation more so, since it also mutates state.
 */

export type { BookingSummary }

const TOO_MANY = 'Too many attempts. Please wait a few minutes and try again.'

export async function findBooking(input: unknown): Promise<Result<BookingSummary>> {
  const parsed = bookingLookupSchema.safeParse(input)

  if (!parsed.success) {
    return err('Check your reference and email address', 'INVALID')
  }

  if (!(await underLookupLimit(parsed.data.email))) {
    return err(TOO_MANY, RATE_LIMITED_CODE)
  }

  const client = createSupabaseAdminClient()

  const { data, error } = await client.rpc('find_booking_by_reference', {
    p_reference: parsed.data.reference,
    p_email: parsed.data.email,
  })

  if (error) {
    return err('We could not look that up right now', 'DB_ERROR')
  }

  const booking = firstRow(data)

  return booking ? ok(toSummary(booking)) : err(NO_MATCH, 'NOT_FOUND')
}

export async function cancelBooking(input: unknown): Promise<Result<BookingSummary>> {
  const parsed = bookingLookupSchema.safeParse(input)

  if (!parsed.success) {
    return err('Check your reference and email address', 'INVALID')
  }

  if (!(await underLookupLimit(parsed.data.email))) {
    return err(TOO_MANY, RATE_LIMITED_CODE)
  }

  const client = createSupabaseAdminClient()

  const { data, error } = await callPendingRpc<'cancel_booking', BookingRpcRow[]>(
    client,
    'cancel_booking',
    { p_reference: parsed.data.reference, p_email: parsed.data.email },
  )

  if (error) {
    if (error.code === ILLEGAL_TRANSITION) {
      return err('That booking can no longer be cancelled', 'NOT_CANCELLABLE')
    }

    // The database message can name relations and constraints; it is logged by
    // Supabase but never shown to the customer.
    return err('We could not cancel that booking right now', 'DB_ERROR')
  }

  const booking = firstRow(data)

  return booking ? ok(toSummary(booking)) : err(NO_MATCH, 'NOT_FOUND')
}

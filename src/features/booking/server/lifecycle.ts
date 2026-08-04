import 'server-only'

import { err, ok, type Result } from '@/lib/api/result'
import { bookingLookupSchema } from '@/lib/api/schemas'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { callPendingRpc } from '@/lib/supabase/rpc'

/**
 * Guest-side booking management: look one up, or cancel it.
 *
 * Both authenticate on reference + email and run through service_role RPCs,
 * because a policy that let anon read by reference alone would expose every
 * booking to anyone who could guess one.
 */

export type BookingSummary = {
  readonly reference: string
  readonly status: string
  readonly totalCents: number
}

/** Raised by cancel_booking / reschedule_booking for an illegal transition. */
const ILLEGAL_TRANSITION = 'P0002'

/** Deliberately identical for a wrong reference and a wrong email. */
const NO_MATCH = 'No booking matches that reference and email'

type BookingRpcRow = { reference: string; status: string; total_cents: number }

function toSummary(row: BookingRpcRow): BookingSummary {
  return { reference: row.reference, status: row.status, totalCents: row.total_cents }
}

function firstRow(data: unknown): BookingRpcRow | null {
  const rows = Array.isArray(data) ? data : [data]

  return (rows[0] as BookingRpcRow | undefined) ?? null
}

export async function findBooking(input: unknown): Promise<Result<BookingSummary>> {
  const parsed = bookingLookupSchema.safeParse(input)

  if (!parsed.success) {
    return err('Check your reference and email address', 'INVALID')
  }

  const client = createSupabaseAdminClient()

  // Counted before the lookup runs, so exhausting the limit keeps it exhausted
  // rather than letting a blocked caller decay back under it.
  const { data: underLimit } = await callPendingRpc<'record_lookup_attempt', boolean>(
    client,
    'record_lookup_attempt',
    { p_identity: parsed.data.email },
  )

  if (underLimit === false) {
    return err('Too many lookups. Please wait a few minutes and try again.', 'RATE_LIMITED')
  }

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

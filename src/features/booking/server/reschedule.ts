import 'server-only'

import { err, ok, type Result } from '@/lib/api/result'
import { rescheduleBookingSchema } from '@/lib/api/schemas'
import { quoteSelections } from '@/lib/api/quote'
import { findBookingByReference } from '@/lib/repositories/bookings'
import { findClubById } from '@/lib/repositories/clubs'
import { listActiveCourts } from '@/lib/repositories/courts'
import { findCustomerByEmail } from '@/lib/repositories/customers'
import { listActivePricingRules } from '@/lib/repositories/pricing-rules'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { callPendingRpc } from '@/lib/supabase/rpc'
import type { BookingSummary } from './lifecycle'

/**
 * Moving an existing booking to a new time.
 *
 * The new slot is re-quoted here rather than carried over from the old one:
 * moving an off-peak session into a Saturday evening changes what it costs, and
 * a client-supplied price would be a way to buy peak time at off-peak rates.
 *
 * `reschedule_booking` deletes and reinserts every segment inside one
 * transaction, so a clash raises 23P01 and the whole move rolls back — the
 * booking is never left holding half its old slots and half its new ones.
 */

/** Raised by the RPC for a cancelled or completed booking. */
const ILLEGAL_TRANSITION = 'P0002'
/** Exclusion violation, or the RPC's own raise for an empty request. */
const SLOT_TAKEN_CODES = new Set(['23P01', 'P0001'])

/** Identical for a wrong reference and a wrong email, so neither is probeable. */
const NO_MATCH = 'No booking matches that reference and email'

type BookingRpcRow = { reference: string; status: string; total_cents: number }

function firstRow(data: unknown): BookingRpcRow | null {
  const rows = Array.isArray(data) ? data : [data]

  return (rows[0] as BookingRpcRow | undefined) ?? null
}

export async function rescheduleBooking(input: unknown): Promise<Result<BookingSummary>> {
  const parsed = rescheduleBookingSchema.safeParse(input)

  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? 'Check the booking details', 'INVALID')
  }

  const { reference, email, courts } = parsed.data
  const client = createSupabaseAdminClient()

  // Rate limited on the same counter as the lookup: this endpoint authenticates
  // on the same two fields and is therefore just as enumerable.
  const { data: underLimit } = await callPendingRpc<'record_lookup_attempt', boolean>(
    client,
    'record_lookup_attempt',
    { p_identity: email },
  )

  if (underLimit === false) {
    return err('Too many attempts. Please wait a few minutes and try again.', 'RATE_LIMITED')
  }

  try {
    const booking = await findBookingByReference(client, reference)

    // The RPC re-checks both; this read exists to find the club so the new
    // segments can be priced, and fails the same way for either mismatch.
    if (!booking || booking.contactEmail.toLowerCase() !== email.toLowerCase()) {
      return err(NO_MATCH, 'NOT_FOUND')
    }

    const club = await findClubById(client, booking.clubId)

    if (!club) {
      return err(NO_MATCH, 'NOT_FOUND')
    }

    const [activeCourts, rules, customer] = await Promise.all([
      listActiveCourts(client, booking.clubId),
      listActivePricingRules(client, booking.clubId),
      findCustomerByEmail(client, booking.clubId, email),
    ])

    const priced = quoteSelections({
      selections: courts,
      courts: activeCourts.map((court) => ({ id: court.id, basePriceCents: court.basePriceCents })),
      rules,
      timeZone: club.timeZone,
      tier: customer?.tier ?? 'standard',
    })

    const { data, error } = await callPendingRpc<'reschedule_booking', BookingRpcRow[]>(
      client,
      'reschedule_booking',
      {
        p_reference: reference,
        p_email: email,
        p_courts: priced.map((selection) => ({
          court_id: selection.courtId,
          starts_at: selection.startsAt.toISOString(),
          ends_at: selection.endsAt.toISOString(),
          price_cents: selection.priceCents,
        })),
      },
    )

    if (error) {
      if (error.code === ILLEGAL_TRANSITION) {
        return err('That booking can no longer be moved', 'NOT_RESCHEDULABLE')
      }

      if (SLOT_TAKEN_CODES.has(error.code ?? '')) {
        return err('Someone just took that slot. Please pick another time.', 'SLOT_TAKEN')
      }

      // Constraint and relation names stay server-side.
      return err('We could not move that booking right now', 'DB_ERROR')
    }

    const updated = firstRow(data)

    if (!updated) {
      return err(NO_MATCH, 'NOT_FOUND')
    }

    return ok({
      reference: updated.reference,
      status: updated.status,
      totalCents: updated.total_cents,
    })
  } catch {
    // An unknown court id throws out of quoteSelections; nothing here is
    // information the customer can act on beyond retrying.
    return err('We could not move that booking right now', 'DB_ERROR')
  }
}

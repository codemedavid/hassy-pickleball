import 'server-only'

import { err, ok, type Result } from '@/lib/api/result'
import { createBookingSchema } from '@/lib/api/schemas'
import { quoteSelections } from '@/lib/api/quote'
import { findClubById } from '@/lib/repositories/clubs'
import { listActiveCourts } from '@/lib/repositories/courts'
import { findCustomerByEmail } from '@/lib/repositories/customers'
import { listActivePricingRules } from '@/lib/repositories/pricing-rules'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { SLOT_TAKEN_CODES, type BookingSummary } from './booking-summary'

/** Postgres check_violation — how create_booking reports an unseatable party. */
const PARTY_SIZE_VIOLATION = '23514'

/**
 * Booking creation.
 *
 * Uses the service-role client on purpose: `create_booking` is granted to
 * service_role only, precisely so that pricing cannot be driven from the
 * browser. Every price is computed here with the tested engine; any
 * `priceCents` a client sends is dropped by the schema.
 */

/**
 * What creation returns, over and above a lookup.
 *
 * The row id is included because the caller usually has follow-up writes to
 * make against this booking — checkout files the payment proof against it — and
 * re-finding the row by reference would be a second round trip for something
 * the insert already handed back. Lookup deliberately does NOT expose it: a
 * guest authenticating with a reference has no use for the primary key.
 */
export type CreatedBooking = BookingSummary & { readonly id: string }

export async function createBooking(input: unknown): Promise<Result<CreatedBooking>> {
  const parsed = createBookingSchema.safeParse(input)

  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? 'Please check the booking details', 'INVALID')
  }

  const booking = parsed.data
  const client = createSupabaseAdminClient()

  try {
    const club = await findClubById(client, booking.clubId)

    if (!club) {
      return err('That club could not be found', 'NOT_FOUND')
    }

    const [courts, rules, customer] = await Promise.all([
      listActiveCourts(client, booking.clubId),
      listActivePricingRules(client, booking.clubId),
      findCustomerByEmail(client, booking.clubId, booking.contactEmail),
    ])

    const priced = quoteSelections({
      selections: booking.courts,
      courts: courts.map((court) => ({ id: court.id, basePriceCents: court.basePriceCents })),
      rules,
      timeZone: club.timeZone,
      // A returning member is quoted at their tier; a new guest at standard.
      tier: customer?.tier ?? 'standard',
    })

    // supabase gen types maps SQL `text` to `string` regardless of whether the
    // parameter accepts NULL, so the generated Args type rejects the nulls this
    // function is designed to take. The cast is narrowed to the nullable
    // parameters rather than the whole call.
    const { data, error } = await client.rpc('create_booking', {
      p_club_id: booking.clubId,
      p_contact_name: booking.contactName,
      p_contact_email: booking.contactEmail,
      p_contact_phone: (booking.contactPhone ?? null) as string,
      p_will_present_id: booking.willPresentId,
      p_notes: (booking.notes ?? null) as string,
      p_payment_method: booking.paymentMethod,
      p_courts: priced.map((selection) => ({
        court_id: selection.courtId,
        starts_at: selection.startsAt.toISOString(),
        ends_at: selection.endsAt.toISOString(),
        price_cents: selection.priceCents,
      })),
      p_items: booking.items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
      })),
      p_players: [...booking.players],
    })

    if (error) {
      if (SLOT_TAKEN_CODES.has(error.code ?? '')) {
        return err('Someone just took that slot. Please pick another time.', 'SLOT_TAKEN')
      }

      // create_booking raises check_violation when the party falls outside what
      // the chosen courts seat. That is the guest's mistake to fix, not an
      // outage, so it is reported as such — with the bound the database named,
      // which is the only place that knows every court in the booking.
      if (error.code === PARTY_SIZE_VIOLATION) {
        return err(
          'That is more players than these courts seat. Please check who is playing.',
          'INVALID',
        )
      }

      return err('We could not complete that booking. Please try again.', 'DB_ERROR')
    }

    return ok({
      id: data.id,
      reference: data.reference,
      status: data.status,
      totalCents: data.total_cents,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error'

    return err(message, 'UNEXPECTED')
  }
}

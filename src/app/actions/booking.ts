'use server'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { err, ok, type Result } from '@/lib/api/result'
import { bookingLookupSchema, createBookingSchema } from '@/lib/api/schemas'
import { quoteSelections } from '@/lib/api/quote'
import {
  findClubById,
  listActivePricingRules,
  listActiveCourts,
} from '@/lib/repositories/queries'

/**
 * Booking mutations.
 *
 * These use the service-role client on purpose: `create_booking` and
 * `find_booking_by_reference` are granted to service_role only, precisely so
 * that pricing and reference/email matching cannot be driven from the browser.
 * Every input is validated here before it reaches the database.
 */

const SLOT_TAKEN_CODES = new Set(['23P01', 'P0001'])

type BookingSummary = {
  readonly reference: string
  readonly status: string
  readonly totalCents: number
}

export async function createBookingAction(input: unknown): Promise<Result<BookingSummary>> {
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

    const [courts, rules] = await Promise.all([
      listActiveCourts(client, booking.clubId),
      listActivePricingRules(client, booking.clubId),
    ])

    // Prices are computed here, never accepted from the client.
    const priced = quoteSelections({
      selections: booking.courts,
      courts: courts.map((court) => ({ id: court.id, basePriceCents: court.basePriceCents })),
      rules,
      timeZone: club.timeZone,
      tier: 'standard',
    })

    // supabase gen types maps SQL `text` to `string` regardless of whether the
    // parameter accepts NULL, so the generated Args type rejects the nulls this
    // function is designed to take. The cast is narrowed to the two nullable
    // parameters rather than the whole call.
    const rpcArgs = {
      p_club_id: booking.clubId,
      p_contact_name: booking.contactName,
      p_contact_email: booking.contactEmail,
      p_contact_phone: (booking.contactPhone ?? null) as string,
      p_will_present_id: booking.willPresentId,
      p_notes: (booking.notes ?? null) as string,
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
    }

    const { data, error } = await client.rpc('create_booking', rpcArgs)

    if (error) {
      if (SLOT_TAKEN_CODES.has(error.code ?? '')) {
        return err('Someone just took that slot. Please pick another time.', 'SLOT_TAKEN')
      }

      return err('We could not complete that booking. Please try again.', 'DB_ERROR')
    }

    return ok({
      reference: data.reference,
      status: data.status,
      totalCents: data.total_cents,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error'

    return err(message, 'UNEXPECTED')
  }
}

export async function findBookingAction(input: unknown): Promise<Result<BookingSummary>> {
  const parsed = bookingLookupSchema.safeParse(input)

  if (!parsed.success) {
    return err('Check your reference and email address', 'INVALID')
  }

  const client = createSupabaseAdminClient()

  const { data, error } = await client.rpc('find_booking_by_reference', {
    p_reference: parsed.data.reference,
    p_email: parsed.data.email,
  })

  if (error) {
    return err('We could not look that up right now', 'DB_ERROR')
  }

  const booking = Array.isArray(data) ? data[0] : data

  // Deliberately the same message whether the reference or the email is wrong,
  // so this cannot be used to confirm that a reference exists.
  if (!booking) {
    return err('No booking matches that reference and email', 'NOT_FOUND')
  }

  return ok({
    reference: booking.reference,
    status: booking.status,
    totalCents: booking.total_cents,
  })
}

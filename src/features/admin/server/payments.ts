import 'server-only'

import { markBookingPaidSchema, refundPaymentSchema } from '@/lib/api/admin-schemas'
import { invalid, withStaff } from './session'
import { markPaymentRefunded, recordPayment } from '@/lib/repositories/payments'
import { updateBookingStatus } from '@/lib/repositories/bookings'
import type { Payment } from '@/lib/repositories/booking-mappers'
import type { Result } from '@/lib/api/result'

/**
 * Settling and reversing payments from the admin Bookings screen.
 *
 * `recordedBy` always comes from the session, so the audit trail records who
 * actually took the money rather than whoever the form claimed.
 */

export type PaidResult = {
  readonly payment: Payment
  readonly bookingStatus: string
}

export async function markBookingPaid(input: unknown): Promise<Result<PaidResult>> {
  const parsed = markBookingPaidSchema.safeParse(input)

  if (!parsed.success) {
    return invalid('Check the payment amount and method')
  }

  const { bookingId, method, amountCents, externalReference } = parsed.data

  return withStaff(async ({ staff, client }) => {
    const payment = await recordPayment(client, {
      bookingId,
      method,
      status: 'paid',
      amountCents,
      externalReference: externalReference ?? null,
      recordedBy: staff.id,
    })

    // Only after the money is recorded. If the insert throws, the booking is
    // left as it was rather than confirmed against a payment that never landed.
    const booking = await updateBookingStatus(client, bookingId, 'confirmed')

    return { payment, bookingStatus: booking.status }
  })
}

export async function refundBookingPayment(input: unknown): Promise<Result<Payment>> {
  const parsed = refundPaymentSchema.safeParse(input)

  if (!parsed.success) {
    return invalid('That payment could not be identified')
  }

  // The booking status is left alone on purpose: refunding a deposit for a
  // reschedule is not the same decision as cancelling the booking, and staff
  // cancel explicitly when that is what they mean.
  return withStaff(({ client }) => markPaymentRefunded(client, parsed.data.paymentId))
}

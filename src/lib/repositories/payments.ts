import 'server-only'

import { toPayment, type Payment } from './booking-mappers'
import { raise, type Client } from './support'
import type { Enums } from './rows'

/** Payment records. Written by staff from the admin Orders screen. */

export type RecordPaymentInput = {
  readonly bookingId: string
  readonly method: Enums['payment_method']
  readonly status: Enums['payment_status']
  readonly amountCents: number
  /** Gateway/reference id. Null for cash and pay-at-venue. */
  readonly externalReference: string | null
  readonly recordedBy: string | null
}

export async function recordPayment(client: Client, input: RecordPaymentInput): Promise<Payment> {
  const row = {
    booking_id: input.bookingId,
    method: input.method,
    status: input.status,
    amount_cents: input.amountCents,
    external_reference: input.externalReference,
    recorded_by: input.recordedBy,
    // Only a payment that actually settled carries a settlement time.
    paid_at: input.status === 'paid' ? new Date().toISOString() : null,
  }

  const { data, error } = await client.from('payments').insert(row).select('*').single()

  raise('Failed to record payment', error)

  return toPayment(data as NonNullable<typeof data>)
}

/**
 * Files the guest's screenshot against the payment `create_booking` opened.
 *
 * Restricted to the still-pending payment: once the desk has marked a payment
 * paid or refunded, that record is reconciled, and a late upload must not be
 * able to swap the evidence underneath it.
 *
 * `proof_url` holds a storage object key, not a link — the bucket is private
 * and the console signs a URL when staff open it.
 */
export async function attachPaymentProof(
  client: Client,
  bookingId: string,
  proofPath: string,
): Promise<void> {
  const { error } = await client
    .from('payments')
    .update({ proof_url: proofPath })
    .eq('booking_id', bookingId)
    .eq('status', 'pending')

  raise('Failed to attach payment proof', error)
}

export async function markPaymentRefunded(client: Client, paymentId: string): Promise<Payment> {
  const { data, error } = await client
    .from('payments')
    .update({ status: 'refunded', refunded_at: new Date().toISOString() })
    .eq('id', paymentId)
    .select('*')
    .single()

  raise('Failed to refund payment', error)

  return toPayment(data as NonNullable<typeof data>)
}

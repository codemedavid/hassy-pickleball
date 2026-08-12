import { toDate, toNullableDate } from './support'
import type { Enums } from './rows'
import type { BookingStatus, CustomerTier } from '@/lib/domain/types'

/**
 * Row → domain mapping for bookings and the records hanging off them.
 * Split from mappers.ts (the catalog side) so neither file grows unwieldy.
 */

export type Booking = {
  readonly id: string
  readonly clubId: string
  readonly reference: string
  readonly customerId: string | null
  readonly contactName: string
  readonly contactEmail: string
  readonly contactPhone: string | null
  readonly status: BookingStatus
  readonly startsAt: Date
  readonly endsAt: Date
  readonly courtsSubtotalCents: number
  readonly itemsSubtotalCents: number
  readonly totalCents: number
  readonly willPresentId: boolean
  readonly notes: string | null
  readonly confirmedAt: Date | null
  readonly cancelledAt: Date | null
  readonly createdAt: Date
}

export type BookingSegment = {
  readonly id: string
  readonly courtId: string
  /** Present only when the query joined `courts`. */
  readonly courtName: string | null
  readonly status: BookingStatus
  readonly startsAt: Date
  readonly endsAt: Date
  readonly priceCents: number
}

export type BookingItemLine = {
  readonly id: string
  readonly productId: string | null
  readonly name: string
  readonly unitPriceCents: number
  readonly quantity: number
  readonly lineTotalCents: number
}

export type Payment = {
  readonly id: string
  readonly bookingId: string
  readonly method: Enums['payment_method']
  readonly status: Enums['payment_status']
  readonly amountCents: number
  readonly externalReference: string | null
  readonly paidAt: Date | null
  readonly refundedAt: Date | null
  /**
   * Storage object key for the guest's uploaded proof, not a link. The bucket
   * is private; the console signs a time-boxed URL when staff open it.
   */
  readonly proofUrl: string | null
}

export type Customer = {
  readonly id: string
  readonly clubId: string
  readonly fullName: string
  readonly email: string
  readonly phone: string | null
  readonly tier: CustomerTier
  readonly totalSpendCents: number
  readonly bookingsCount: number
  readonly lastVisitAt: Date | null
}

export type AvailabilityBlock = {
  readonly id: string
  readonly courtId: string
  readonly kind: Enums['block_kind']
  readonly reason: string | null
  readonly startsAt: Date
  readonly endsAt: Date
}

export function toBooking(row: {
  id: string
  club_id: string
  reference: string
  customer_id: string | null
  contact_name: string
  contact_email: string
  contact_phone: string | null
  status: BookingStatus
  starts_at: string
  ends_at: string
  courts_subtotal_cents: number
  items_subtotal_cents: number
  total_cents: number
  will_present_id: boolean
  notes: string | null
  confirmed_at: string | null
  cancelled_at: string | null
  created_at: string
}): Booking {
  return {
    id: row.id,
    clubId: row.club_id,
    reference: row.reference,
    customerId: row.customer_id,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    status: row.status,
    startsAt: toDate(row.starts_at),
    endsAt: toDate(row.ends_at),
    courtsSubtotalCents: row.courts_subtotal_cents,
    itemsSubtotalCents: row.items_subtotal_cents,
    totalCents: row.total_cents,
    willPresentId: row.will_present_id,
    notes: row.notes,
    confirmedAt: toNullableDate(row.confirmed_at),
    cancelledAt: toNullableDate(row.cancelled_at),
    createdAt: toDate(row.created_at),
  }
}

export function toBookingSegment(row: {
  id: string
  court_id: string
  status: BookingStatus
  starts_at: string
  ends_at: string
  price_cents: number
  courts?: { name: string } | null
}): BookingSegment {
  return {
    id: row.id,
    courtId: row.court_id,
    courtName: row.courts?.name ?? null,
    status: row.status,
    startsAt: toDate(row.starts_at),
    endsAt: toDate(row.ends_at),
    priceCents: row.price_cents,
  }
}

export function toBookingItemLine(row: {
  id: string
  product_id: string | null
  name_snapshot: string
  unit_price_cents: number
  quantity: number
  line_total_cents: number
}): BookingItemLine {
  return {
    id: row.id,
    productId: row.product_id,
    name: row.name_snapshot,
    unitPriceCents: row.unit_price_cents,
    quantity: row.quantity,
    lineTotalCents: row.line_total_cents,
  }
}

export function toPayment(row: {
  id: string
  booking_id: string
  method: Enums['payment_method']
  status: Enums['payment_status']
  amount_cents: number
  external_reference: string | null
  paid_at: string | null
  refunded_at: string | null
  proof_url: string | null
}): Payment {
  return {
    id: row.id,
    bookingId: row.booking_id,
    method: row.method,
    status: row.status,
    amountCents: row.amount_cents,
    externalReference: row.external_reference,
    paidAt: toNullableDate(row.paid_at),
    refundedAt: toNullableDate(row.refunded_at),
    proofUrl: row.proof_url,
  }
}

export function toCustomer(row: {
  id: string
  club_id: string
  full_name: string
  email: string
  phone: string | null
  tier: CustomerTier
  total_spend_cents: number
  bookings_count: number
  last_visit_at: string | null
}): Customer {
  return {
    id: row.id,
    clubId: row.club_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    tier: row.tier,
    totalSpendCents: row.total_spend_cents,
    bookingsCount: row.bookings_count,
    lastVisitAt: toNullableDate(row.last_visit_at),
  }
}

export function toAvailabilityBlock(row: {
  id: string
  court_id: string
  kind: Enums['block_kind']
  reason: string | null
  starts_at: string
  ends_at: string
}): AvailabilityBlock {
  return {
    id: row.id,
    courtId: row.court_id,
    kind: row.kind,
    reason: row.reason,
    startsAt: toDate(row.starts_at),
    endsAt: toDate(row.ends_at),
  }
}

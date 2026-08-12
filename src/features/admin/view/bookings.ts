import { durationMinutes } from '@/lib/domain/time'
import { nextStatuses } from '@/lib/domain/booking-status'
import { formatMinutes, formatMoney } from '@/lib/format/money'
import { formatDayInZone, formatTimeInZone } from '@/lib/format/time'
import type { BookingItemLine, Payment } from '@/lib/repositories/booking-mappers'
import type { BookingDetail } from '@/lib/repositories/bookings'
import type { Club } from '@/lib/repositories/mappers'
import type { Enums } from '@/lib/repositories/rows'
import type { BookingStatus } from '@/lib/domain/types'

/**
 * The admin Bookings ledger and the detail panel beside it.
 *
 * This module carries both the session and the money, because they belong to
 * one row and the desk reconciles them together. Payment status is kept
 * separate from booking status rather than folded into it: a confirmed booking
 * with an unsettled bank transfer still owes the club, and collapsing the two
 * would hide exactly the case staff need to chase.
 */

/** How the money on a booking reads, independent of the booking's own status. */
export type PaymentStatus = 'paid' | 'awaiting' | 'refunded' | 'failed'

export type BookingRow = {
  readonly id: string
  readonly reference: string
  readonly name: string
  readonly contact: string
  readonly court: string
  readonly when: string
  readonly extras: string
  readonly status: BookingStatus
  readonly method: string
  readonly paymentStatus: PaymentStatus
  readonly total: string
}

export type DetailLine = {
  readonly label: string
  readonly value: string
}

export type PaymentLine = {
  readonly id: string
  readonly method: string
  readonly status: PaymentStatus
  readonly amount: string
  /** A signed, time-boxed link to the guest's uploaded proof, when there is one. */
  readonly proofHref: string | null
}

export type BookingDetailView = {
  readonly id: string
  readonly reference: string
  readonly status: BookingStatus
  readonly paymentStatus: PaymentStatus
  readonly meta: readonly DetailLine[]
  readonly lines: readonly DetailLine[]
  readonly total: string
  readonly note: string
  readonly payments: readonly PaymentLine[]
  /** Where the desk can move this booking. Empty once it is cancelled or done. */
  readonly nextStatuses: readonly BookingStatus[]
  /** Defaults the record-payment amount, so staff do not retype the balance. */
  readonly outstandingCents: number
}

/** Proof storage path -> signed URL. The page signs; this module only renders. */
export type SignedProofUrls = Readonly<Record<string, string>>

const METHOD_LABELS: Record<Enums['payment_method'], string> = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  gcash: 'GCash',
  online: 'Online',
}

const PAYMENT_STATUS: Record<Enums['payment_status'], PaymentStatus> = {
  paid: 'paid',
  pending: 'awaiting',
  refunded: 'refunded',
  failed: 'failed',
}

const NOTHING = '—'
const NO_METHOD = 'Not recorded'
const NO_NOTE = 'No note on this booking.'

/**
 * The payment that decides how the money reads.
 *
 * A refund is the later and truer fact about money that was once paid, so it
 * wins over the successful charge that preceded it; otherwise the most
 * recently recorded payment stands.
 */
function decidingPayment(payments: readonly Payment[]): Payment | undefined {
  return payments.find((payment) => payment.status === 'refunded') ?? payments.at(-1)
}

function paymentStatusOf(payments: readonly Payment[]): PaymentStatus {
  const payment = decidingPayment(payments)

  return payment ? PAYMENT_STATUS[payment.status] : 'awaiting'
}

function methodOf(payments: readonly Payment[]): string {
  const payment = decidingPayment(payments)

  return payment ? METHOD_LABELS[payment.method] : NO_METHOD
}

/** A quantity of one is implied; printing "×1" on every line is noise. */
function describeItem(item: BookingItemLine): string {
  return item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name
}

function courtNames(detail: BookingDetail): readonly string[] {
  return [
    ...new Set(detail.segments.flatMap((segment) => (segment.courtName ? [segment.courtName] : []))),
  ]
}

function courtLabel(detail: BookingDetail): string {
  const names = courtNames(detail)

  return names.length > 0 ? names.join(', ') : NOTHING
}

function extras(detail: BookingDetail): string {
  return detail.items.length > 0 ? detail.items.map(describeItem).join(', ') : NOTHING
}

function whenLabel(detail: BookingDetail, club: Club): string {
  const { booking } = detail
  const minutes = durationMinutes({ startsAt: booking.startsAt, endsAt: booking.endsAt })

  return [
    formatDayInZone(booking.startsAt, club.timeZone),
    formatTimeInZone(booking.startsAt, club.timeZone),
    formatMinutes(minutes),
  ].join(' · ')
}

/**
 * What the booking still owes.
 *
 * Only settled money counts against the total: a failed charge collected
 * nothing, and a refund gave back what it had. Clamped at zero so an overpaid
 * booking does not offer the desk a negative amount to record.
 */
function outstandingCents(detail: BookingDetail): number {
  const settled = detail.payments
    .filter((payment) => payment.status === 'paid')
    .reduce((sum, payment) => sum + payment.amountCents, 0)

  const returned = detail.payments
    .filter((payment) => payment.status === 'refunded')
    .reduce((sum, payment) => sum + payment.amountCents, 0)

  return Math.max(0, detail.booking.totalCents - settled + returned)
}

function toPaymentLine(payment: Payment, club: Club, signed: SignedProofUrls): PaymentLine {
  return {
    id: payment.id,
    method: METHOD_LABELS[payment.method],
    status: PAYMENT_STATUS[payment.status],
    amount: formatMoney(payment.amountCents, club.currency),
    // An unsigned path stays unlinked: a link that 403s is worse than none.
    proofHref: payment.proofUrl ? (signed[payment.proofUrl] ?? null) : null,
  }
}

export function toBookingRows(
  bookings: readonly BookingDetail[],
  club: Club,
): readonly BookingRow[] {
  return bookings.map((detail) => {
    const { booking } = detail

    return {
      id: booking.id,
      reference: booking.reference,
      name: booking.contactName,
      // A phone number is what the desk actually uses to chase someone.
      contact: booking.contactPhone ?? booking.contactEmail,
      court: courtLabel(detail),
      when: whenLabel(detail, club),
      extras: extras(detail),
      // The badge component owns the wording; the raw status crosses unchanged.
      status: booking.status,
      method: methodOf(detail.payments),
      paymentStatus: paymentStatusOf(detail.payments),
      total: formatMoney(booking.totalCents, club.currency),
    }
  })
}

export function toBookingDetailView(
  detail: BookingDetail,
  club: Club,
  signedProofUrls: SignedProofUrls = {},
): BookingDetailView {
  const { booking } = detail

  return {
    id: booking.id,
    reference: booking.reference,
    status: booking.status,
    paymentStatus: paymentStatusOf(detail.payments),
    meta: [
      { label: 'Customer', value: booking.contactName },
      { label: 'Contact', value: booking.contactPhone ?? booking.contactEmail },
      { label: 'Court', value: courtLabel(detail) },
      { label: 'When', value: whenLabel(detail, club) },
    ],
    lines: [
      { label: 'Court time', value: formatMoney(booking.courtsSubtotalCents, club.currency) },
      ...detail.items.map((item) => ({
        label: describeItem(item),
        value: formatMoney(item.lineTotalCents, club.currency),
      })),
    ],
    total: formatMoney(booking.totalCents, club.currency),
    note: booking.notes ?? NO_NOTE,
    payments: detail.payments.map((payment) => toPaymentLine(payment, club, signedProofUrls)),
    nextStatuses: nextStatuses(booking.status),
    outstandingCents: outstandingCents(detail),
  }
}

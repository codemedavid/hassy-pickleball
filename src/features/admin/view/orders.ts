import { durationMinutes } from '@/lib/domain/time'
import { formatMinutes, formatMoney } from '@/lib/format/money'
import { formatDayInZone, formatTimeInZone } from '@/lib/format/time'
import type { BookingItemLine, Payment } from '@/lib/repositories/booking-mappers'
import type { BookingDetail } from '@/lib/repositories/bookings'
import type { Club } from '@/lib/repositories/mappers'
import type { Enums } from '@/lib/repositories/rows'

/**
 * The orders ledger: the same bookings the Bookings screen lists, seen through
 * the money. Its status is the payment's, not the booking's — a confirmed
 * booking with an unsettled bank transfer still owes the club.
 */

export type OrderStatus = 'paid' | 'awaiting' | 'refunded' | 'failed'

export type OrderRow = {
  readonly id: string
  readonly reference: string
  readonly who: string
  readonly items: string
  readonly method: string
  readonly status: OrderStatus
  readonly total: string
}

export type OrderLine = {
  readonly label: string
  readonly value: string
}

export type OrderDetail = {
  readonly id: string
  readonly reference: string
  readonly status: OrderStatus
  readonly meta: readonly OrderLine[]
  readonly lines: readonly OrderLine[]
  readonly total: string
  readonly note: string
}

const METHOD_LABELS: Record<Enums['payment_method'], string> = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  gcash: 'GCash',
  online: 'Online',
}

const PAYMENT_STATUS: Record<Enums['payment_status'], OrderStatus> = {
  paid: 'paid',
  pending: 'awaiting',
  refunded: 'refunded',
  failed: 'failed',
}

const NO_METHOD = 'Not recorded'
const NO_NOTE = 'No note on this order.'

/**
 * The payment that decides how the order reads.
 *
 * A refund is the later and truer fact about money that was once paid, so it
 * wins over the successful charge that preceded it; otherwise the most
 * recently recorded payment stands.
 */
function decidingPayment(payments: readonly Payment[]): Payment | undefined {
  return payments.find((payment) => payment.status === 'refunded') ?? payments.at(-1)
}

function itemLabel(item: BookingItemLine): string {
  return item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name
}

function courtMinutes(detail: BookingDetail): number {
  return durationMinutes({
    startsAt: detail.booking.startsAt,
    endsAt: detail.booking.endsAt,
  })
}

function describeItems(detail: BookingDetail): string {
  return [`Court ${formatMinutes(courtMinutes(detail))}`, ...detail.items.map(itemLabel)].join(
    ' + ',
  )
}

function statusOf(detail: BookingDetail): OrderStatus {
  const payment = decidingPayment(detail.payments)

  return payment ? PAYMENT_STATUS[payment.status] : 'awaiting'
}

function methodOf(detail: BookingDetail): string {
  const payment = decidingPayment(detail.payments)

  return payment ? METHOD_LABELS[payment.method] : NO_METHOD
}

export function toOrderRows(bookings: readonly BookingDetail[], club: Club): readonly OrderRow[] {
  return bookings.map((detail) => ({
    id: detail.booking.id,
    reference: detail.booking.reference,
    who: detail.booking.contactName,
    items: describeItems(detail),
    method: methodOf(detail),
    status: statusOf(detail),
    total: formatMoney(detail.booking.totalCents, club.currency),
  }))
}

export function toOrderDetail(detail: BookingDetail, club: Club): OrderDetail {
  const { booking } = detail
  const courtNames = [
    ...new Set(detail.segments.flatMap((s) => (s.courtName ? [s.courtName] : []))),
  ]

  return {
    id: booking.id,
    reference: booking.reference,
    status: statusOf(detail),
    meta: [
      { label: 'Customer', value: booking.contactName },
      { label: 'Court', value: courtNames.join(', ') },
      {
        label: 'When',
        value: `${formatDayInZone(booking.startsAt, club.timeZone)} · ${formatTimeInZone(booking.startsAt, club.timeZone)}`,
      },
      { label: 'Method', value: methodOf(detail) },
    ],
    lines: [
      { label: 'Court time', value: formatMoney(booking.courtsSubtotalCents, club.currency) },
      ...detail.items.map((item) => ({
        label: itemLabel(item),
        value: formatMoney(item.lineTotalCents, club.currency),
      })),
    ],
    total: formatMoney(booking.totalCents, club.currency),
    note: booking.notes ?? NO_NOTE,
  }
}

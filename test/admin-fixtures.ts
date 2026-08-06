import { zonedTimeToUtc } from '@/lib/domain/time'
import type { BookingDetail } from '@/lib/repositories/bookings'
import type {
  AvailabilityBlock,
  Booking,
  BookingItemLine,
  BookingSegment,
  Payment,
} from '@/lib/repositories/booking-mappers'
import type { Club, Court } from '@/lib/repositories/mappers'
import type { BookingStatus } from '@/lib/domain/types'

/**
 * Fixtures for the admin view-model tests.
 *
 * Lives outside src/ so it is neither collected as a test nor counted in
 * coverage. Every builder takes club-local wall-clock strings and converts
 * them to UTC instants, because that is exactly the direction the real data
 * flows: the database stores UTC, the screens render club-local.
 */

export const TIME_ZONE = 'Asia/Manila'
export const DAY = '2026-08-04'

export const club: Club = {
  id: 'club-1',
  name: 'Riverbend Pickleball',
  slug: 'baseline',
  timeZone: TIME_ZONE,
  currency: 'PHP',
  opensAt: '07:00:00',
  closesAt: '22:00:00',
  slotMinutes: 30,
  minDurationMinutes: 60,
  maxDurationMinutes: 180,
  phone: null,
  cancellationWindowHours: 24,
  groupBookingNote: null,
}

export function makeCourt(overrides: Partial<Court> & { id: string }): Court {
  return {
    clubId: club.id,
    name: 'Harbor Court',
    slug: 'harbor-court',
    surface: 'Cushioned acrylic',
    environment: 'indoor',
    isTournamentGrade: false,
    blurb: null,
    notes: [],
    tags: [],
    includes: [],
    heroImageUrl: null,
    basePriceCents: 60_000,
    sortOrder: 1,
    isActive: true,
    minPlayers: 2,
    maxPlayers: 4,
    ...overrides,
  }
}

/** A club-local "HH:MM" on `day` as the UTC instant the database would hold. */
export function at(time: string, day: string = DAY): Date {
  const [hours, minutes] = time.split(':').map(Number)

  return zonedTimeToUtc(day, hours * 60 + minutes, TIME_ZONE)
}

type SegmentSpec = {
  readonly courtId: string
  readonly courtName?: string
  readonly from: string
  readonly to: string
  readonly priceCents?: number
  readonly day?: string
}

type ItemSpec = {
  readonly name: string
  readonly quantity?: number
  readonly unitPriceCents?: number
}

type PaymentSpec = {
  readonly method: Payment['method']
  readonly status: Payment['status']
  readonly amountCents?: number
}

export type BookingSpec = {
  readonly id?: string
  readonly reference?: string
  readonly contactName?: string
  readonly contactEmail?: string
  readonly contactPhone?: string | null
  readonly status?: BookingStatus
  readonly notes?: string | null
  readonly segments: readonly SegmentSpec[]
  readonly items?: readonly ItemSpec[]
  readonly payments?: readonly PaymentSpec[]
}

function toSegment(spec: SegmentSpec, index: number, status: BookingStatus): BookingSegment {
  return {
    id: `segment-${index}`,
    courtId: spec.courtId,
    courtName: spec.courtName ?? 'Harbor Court',
    status,
    startsAt: at(spec.from, spec.day),
    endsAt: at(spec.to, spec.day),
    priceCents: spec.priceCents ?? 60_000,
  }
}

function toItem(spec: ItemSpec, index: number): BookingItemLine {
  const quantity = spec.quantity ?? 1
  const unitPriceCents = spec.unitPriceCents ?? 15_000

  return {
    id: `item-${index}`,
    productId: `product-${index}`,
    name: spec.name,
    unitPriceCents,
    quantity,
    lineTotalCents: unitPriceCents * quantity,
  }
}

export function makeBooking(spec: BookingSpec): BookingDetail {
  const status = spec.status ?? 'confirmed'
  const segments = spec.segments.map((segment, index) => toSegment(segment, index, status))
  const items = (spec.items ?? []).map(toItem)

  const courtsSubtotalCents = segments.reduce((sum, segment) => sum + segment.priceCents, 0)
  const itemsSubtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0)

  const booking: Booking = {
    id: spec.id ?? 'booking-1',
    clubId: club.id,
    reference: spec.reference ?? 'PB-4821',
    customerId: 'customer-1',
    contactName: spec.contactName ?? 'Maya Halvorsen',
    contactEmail: spec.contactEmail ?? 'maya@example.com',
    contactPhone: spec.contactPhone ?? null,
    status,
    startsAt: segments[0].startsAt,
    endsAt: segments[segments.length - 1].endsAt,
    courtsSubtotalCents,
    itemsSubtotalCents,
    totalCents: courtsSubtotalCents + itemsSubtotalCents,
    willPresentId: false,
    notes: spec.notes ?? null,
    confirmedAt: status === 'confirmed' ? at('08:00') : null,
    cancelledAt: status === 'cancelled' ? at('08:00') : null,
    createdAt: at('08:00'),
  }

  const payments: Payment[] = (spec.payments ?? []).map((payment, index) => ({
    id: `payment-${index}`,
    bookingId: booking.id,
    method: payment.method,
    status: payment.status,
    amountCents: payment.amountCents ?? booking.totalCents,
    externalReference: null,
    paidAt: payment.status === 'paid' ? at('09:12') : null,
    refundedAt: payment.status === 'refunded' ? at('10:30') : null,
  }))

  return { booking, segments, items, payments }
}

export function makeBlock(spec: {
  readonly id?: string
  readonly courtId: string
  readonly kind: AvailabilityBlock['kind']
  readonly reason?: string | null
  readonly from: string
  readonly to: string
}): AvailabilityBlock {
  return {
    id: spec.id ?? 'block-1',
    courtId: spec.courtId,
    kind: spec.kind,
    reason: spec.reason ?? null,
    startsAt: at(spec.from),
    endsAt: at(spec.to),
  }
}

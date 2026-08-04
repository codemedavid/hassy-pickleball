import type { BookingStatus } from '@/lib/domain/types'

/**
 * Booking and payment status pills.
 *
 * Database enum values are never printed directly — "awaiting_payment" is not
 * something to show a customer. Colour is paired with distinct wording so the
 * status is not conveyed by colour alone.
 */

type BadgeTone = 'neutral' | 'positive' | 'warning' | 'negative'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken text-muted',
  positive: 'bg-success-bg text-success',
  warning: 'bg-lime/35 text-olive',
  negative: 'bg-danger-bg text-danger',
}

const BOOKING_LABELS: Record<BookingStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Pending', tone: 'neutral' },
  awaiting_payment: { label: 'Awaiting payment', tone: 'warning' },
  confirmed: { label: 'Confirmed', tone: 'positive' },
  completed: { label: 'Completed', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'negative' },
}

export interface StatusBadgeProps {
  readonly status: BookingStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  // An unmapped status is still shown: a blank badge would hide the truth.
  const { label, tone } = BOOKING_LABELS[status] ?? { label: status, tone: 'neutral' as const }

  return (
    <span
      role="status"
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase ${TONES[tone]}`}
    >
      {label}
    </span>
  )
}

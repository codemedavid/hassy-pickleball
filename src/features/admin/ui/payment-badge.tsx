import type { PaymentStatus } from '../view/bookings'

/**
 * How the money on a booking reads. Sits beside the booking's own status
 * badge, because the two disagree often enough to matter: a confirmed booking
 * with an unsettled transfer is exactly what the desk chases.
 *
 * Colour is paired with distinct wording, so the state never depends on hue.
 */

const LABELS: Record<PaymentStatus, { label: string; tone: string }> = {
  paid: { label: 'Paid', tone: 'bg-success-bg text-success' },
  awaiting: { label: 'Awaiting', tone: 'bg-lime/35 text-olive' },
  refunded: { label: 'Refunded', tone: 'bg-surface-sunken text-muted' },
  failed: { label: 'Failed', tone: 'bg-danger-bg text-danger' },
}

export interface PaymentBadgeProps {
  readonly status: PaymentStatus
}

export function PaymentBadge({ status }: PaymentBadgeProps) {
  const { label, tone } = LABELS[status]

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase ${tone}`}
    >
      {label}
    </span>
  )
}

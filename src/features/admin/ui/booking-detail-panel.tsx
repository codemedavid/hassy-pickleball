'use client'

import { useState, useTransition } from 'react'
import { CARD } from './primitives'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { PaymentBadge } from './payment-badge'
import { toCents, toMajorUnits } from '../view/money-fields'
import type { BookingDetailView, PaymentLine } from '../view/bookings'
import type { BookingStatus } from '@/lib/domain/types'
import type { Result } from '@/lib/api/result'

/**
 * Managing one booking: the breakdown, the money against it, and the moves the
 * desk can make.
 *
 * Only the transitions the server would accept are rendered, because the view
 * layer derives them from the same table the server checks. A booking whose
 * life has ended offers nothing rather than buttons that come back refused.
 */

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'gcash', label: 'GCash' },
  { value: 'online', label: 'Online' },
] as const

const STATUS_ACTIONS: Record<
  BookingStatus,
  { label: string; variant: 'primary' | 'secondary' | 'danger' }
> = {
  pending: { label: 'Move to awaiting payment', variant: 'secondary' },
  awaiting_payment: { label: 'Move to awaiting payment', variant: 'secondary' },
  confirmed: { label: 'Confirm booking', variant: 'primary' },
  completed: { label: 'Mark completed', variant: 'secondary' },
  cancelled: { label: 'Cancel booking', variant: 'danger' },
}

const CLOSED_MESSAGE = 'This booking is closed. Rebook to put the customer back on a court.'
const NOTHING_OWED = 'A payment must be for more than nothing'

const FIELD =
  'h-10 w-full rounded-xl border border-line-strong bg-surface px-3 text-sm ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-mid'
const LABEL = 'text-[12px] font-bold tracking-[0.06em] text-subtle uppercase'
const ROW = 'flex justify-between gap-4 text-[14px]'

export interface BookingDetailPanelProps {
  readonly detail: BookingDetailView
  readonly currency: string
  readonly onSetStatus: (payload: unknown) => Promise<Result<unknown>>
  readonly onMarkPaid: (payload: unknown) => Promise<Result<unknown>>
  readonly onRefund: (payload: unknown) => Promise<Result<unknown>>
  /** Fired after any write lands, so the screen can pull fresh server data. */
  readonly onDone: () => void
}

export function BookingDetailPanel({
  detail,
  currency,
  onSetStatus,
  onMarkPaid,
  onRefund,
  onDone,
}: BookingDetailPanelProps) {
  const [error, setError] = useState<string | null>(null)
  const [method, setMethod] = useState<string>(PAYMENT_METHODS[0].value)
  const [amount, setAmount] = useState(() => toMajorUnits(detail.outstandingCents))
  const [reference, setReference] = useState('')
  const [isPending, startTransition] = useTransition()

  /** Every write reports the same way: an error stays put, a success refreshes. */
  function run(write: () => Promise<Result<unknown>>): void {
    setError(null)

    startTransition(async () => {
      const result = await write()

      if (!result.success) {
        setError(result.error)
        return
      }

      onDone()
    })
  }

  function recordPayment(): void {
    const amountCents = toCents(amount)

    // Checked here as well as in the schema so the desk gets the reason
    // immediately rather than after a round trip.
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setError(NOTHING_OWED)
      return
    }

    run(() =>
      onMarkPaid({
        bookingId: detail.id,
        method,
        amountCents,
        externalReference: reference.trim() === '' ? null : reference.trim(),
      }),
    )
  }

  return (
    <section aria-label={`Booking ${detail.reference}`} className={`${CARD} px-6 py-5`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 font-[family-name:var(--font-display)] text-[19px] font-bold">
          {detail.reference}
        </h2>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={detail.status} />
          <PaymentBadge status={detail.paymentStatus} />
        </div>
      </div>

      {error ? (
        <p role="alert" className="mb-4 rounded-xl bg-danger-bg px-4 py-3 text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      <dl className="m-0 flex flex-col gap-2.5 border-b border-surface-sunken pb-4">
        {detail.meta.map((line) => (
          <div key={line.label} className={ROW}>
            <dt className="text-muted">{line.label}</dt>
            <dd className="m-0 text-right font-semibold">{line.value}</dd>
          </div>
        ))}
      </dl>

      {detail.players.length > 0 ? (
        <div className="border-b border-surface-sunken py-4">
          <h3 className={`${LABEL} m-0 mb-2.5`}>Players</h3>
          <ul aria-label="Players" className="m-0 flex list-none flex-wrap gap-2 p-0 text-[13.5px]">
            {detail.players.map((player, index) => (
              <li
                key={`${index}-${player}`}
                className="rounded-lg bg-surface-alt px-3 py-2 font-semibold"
              >
                {player}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <dl className="m-0 flex flex-col gap-2.5 border-b border-surface-sunken py-4">
        {detail.lines.map((line) => (
          <div key={line.label} className={ROW}>
            <dt className="text-slate">{line.label}</dt>
            <dd className="m-0 tabular-nums">{line.value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-3.5 mb-0 flex items-baseline justify-between">
        <span className="font-bold">Total</span>
        <span className="font-[family-name:var(--font-display)] text-[24px] font-bold">
          {detail.total}
        </span>
      </p>

      <Payments
        payments={detail.payments}
        isPending={isPending}
        onRefund={(paymentId) => run(() => onRefund({ paymentId }))}
      />

      <div className="mt-5 border-t border-surface-sunken pt-4">
        <h3 className={`${LABEL} m-0 mb-3`}>Record a payment</h3>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Method</span>
            <select
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              className={FIELD}
            >
              {PAYMENT_METHODS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>{`Amount (${currency})`}</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className={FIELD}
            />
          </label>

          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={LABEL}>Reference (optional)</span>
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Deposit slip or gateway id"
              className={FIELD}
            />
          </label>
        </div>

        <Button onClick={recordPayment} isPending={isPending} className="mt-3">
          Record payment
        </Button>
      </div>

      <div className="mt-5 border-t border-surface-sunken pt-4">
        {detail.nextStatuses.length === 0 ? (
          <p className="m-0 text-[13px] text-muted">{CLOSED_MESSAGE}</p>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {detail.nextStatuses.map((status) => (
              <Button
                key={status}
                variant={STATUS_ACTIONS[status].variant}
                isPending={isPending}
                onClick={() => run(() => onSetStatus({ bookingId: detail.id, status }))}
              >
                {STATUS_ACTIONS[status].label}
              </Button>
            ))}
          </div>
        )}
      </div>

      <p className="mt-4 mb-0 rounded-[11px] border border-surface-sunken bg-surface-alt px-4 py-3.5 text-[13.5px] leading-relaxed text-slate">
        {detail.note}
      </p>
    </section>
  )
}

interface PaymentsProps {
  readonly payments: readonly PaymentLine[]
  readonly isPending: boolean
  readonly onRefund: (paymentId: string) => void
}

function Payments({ payments, isPending, onRefund }: PaymentsProps) {
  if (payments.length === 0) {
    return <p className="mt-4 mb-0 text-[13px] text-muted">No payment recorded yet.</p>
  }

  return (
    <ul aria-label="Payments" className="mt-4 mb-0 flex list-none flex-col gap-2.5 p-0">
      {payments.map((payment) => (
        <li
          key={payment.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-[11px] bg-surface-alt px-3.5 py-2.5 text-[13.5px]"
        >
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{payment.method}</span>
            <PaymentBadge status={payment.status} />
          </span>

          <span className="flex flex-wrap items-center gap-3">
            <span className="tabular-nums">{payment.amount}</span>

            {payment.proofHref ? (
              <a
                href={payment.proofHref}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-olive underline"
              >
                View proof
              </a>
            ) : null}

            {/* Only settled money can be given back. */}
            {payment.status === 'paid' ? (
              <Button
                variant="ghost"
                size="sm"
                isPending={isPending}
                onClick={() => onRefund(payment.id)}
              >
                Refund
              </Button>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  )
}

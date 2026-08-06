'use client'

import Link from 'next/link'
import { formatMoney } from '@/lib/format/money'
import type { CheckoutResult } from '../server/submit-checkout'

/**
 * The screen a guest lands on once the court is held.
 *
 * The reservation number is the entire point of this page — it is what the desk
 * asks for and what the lookup form takes — so it is set as the largest thing
 * on it, selectable, and repeated nowhere else that could disagree with it.
 */

export type CheckoutThankYouProps = {
  readonly result: CheckoutResult
  readonly currency: string
}

export function CheckoutThankYou({ result, currency }: CheckoutThankYouProps) {
  return (
    <section
      aria-labelledby="thank-you-title"
      className="mx-auto max-w-[560px] rounded-[18px] border border-line bg-surface p-8 text-center"
    >
      <p aria-hidden className="text-[32px]">
        🎾
      </p>

      <h1
        id="thank-you-title"
        className="mt-2 font-[family-name:var(--font-display)] text-[28px] font-bold tracking-[-0.02em] text-ink"
      >
        Thank you — your court is held
      </h1>

      <p className="mt-2 text-[14.5px] text-muted">
        We are checking your {result.paymentMethodLabel} payment. You will get a confirmation once
        the desk has verified it.
      </p>

      <div className="mt-6 rounded-[14px] border border-line-heavy bg-canvas px-6 py-5">
        <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-muted">
          Reservation number
        </p>
        <p className="mt-1.5 select-all font-[family-name:var(--font-display)] text-[34px] font-bold tracking-[0.04em] text-ink">
          {result.reference}
        </p>
        <p className="mt-2 text-[13px] text-muted">
          Quote this at the desk, or use it to look your booking up.
        </p>
      </div>

      <dl className="mt-5 flex justify-between border-t border-line pt-4 text-[14px]">
        <dt className="text-muted">Total to pay</dt>
        <dd className="font-bold tabular-nums text-ink">
          {formatMoney(result.totalCents, currency)}
        </dd>
      </dl>

      {/* Announced, not just shown: this one asks the guest to do something. */}
      <p role="status" className="mt-4 min-h-[20px] text-[13px] text-danger">
        {result.proofAttached
          ? ''
          : 'We could not save your payment screenshot. Please send it to the desk with your reservation number.'}
      </p>

      <div className="mt-6 flex flex-col gap-2">
        <Link
          href="/courts"
          className="rounded-[10px] bg-navy px-4 py-3 text-[14px] font-bold text-white"
        >
          Book another court
        </Link>
      </div>
    </section>
  )
}

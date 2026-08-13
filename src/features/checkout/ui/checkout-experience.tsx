'use client'

import { useRef, useState, useTransition } from 'react'
import { CheckoutThankYou } from './checkout-thank-you'
import { PaymentMethodPicker } from './payment-method-picker'
import { buildCheckoutOrder, buildOrderSummary } from '../view/checkout-view'
import type { CheckoutPaymentMethod } from '../view/checkout-view'
import type { CheckoutResult } from '../server/submit-checkout'
import { useCart } from '@/features/cart/cart-provider'
import type { Result } from '@/lib/api/result'
import { PROOF_ACCEPT_ATTRIBUTE, validatePaymentProof } from '@/lib/domain/payment-proof'
import { capacityBand, type CourtCapacity } from '@/lib/domain/pax'
import type { CartCourtLine } from '@/lib/domain/cart'

/**
 * Checkout.
 *
 * A client island because the cart it is checking out lives in the browser —
 * the server has never seen it. What the server does own is every price: this
 * screen sends court windows and product ids, and the total it displays comes
 * from the cart's own stored prices purely so the guest sees a figure before
 * submitting. The authoritative total is the one that comes back.
 *
 * The proof file is validated here as well as on the server. Not instead of:
 * the browser check exists to spare a guest a five-megabyte upload that was
 * going to be refused, and the server check exists because nothing a browser
 * says is binding.
 */

export type CheckoutExperienceProps = {
  readonly clubId: string
  readonly paymentMethods: readonly CheckoutPaymentMethod[]
  readonly currency: string
  readonly onSubmit: (form: FormData) => Promise<Result<CheckoutResult>>
}

type ContactFields = {
  contactName: string
  contactEmail: string
  contactPhone: string
  notes: string
}

const PROOF_INPUT_ID = 'checkout-proof'
const PROOF_HINT_ID = 'checkout-proof-hint'

const EMPTY_CONTACT: ContactFields = {
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  notes: '',
}

function hasCapacity(court: CartCourtLine): court is CartCourtLine & CourtCapacity {
  return (
    typeof court.minPlayers === 'number' &&
    typeof court.maxPlayers === 'number' &&
    typeof court.includedPlayers === 'number' &&
    typeof court.extraPlayerFeeCents === 'number'
  )
}

function Field({
  label,
  name,
  type = 'text',
  value,
  required,
  autoComplete,
  onChange,
}: {
  readonly label: string
  readonly name: string
  readonly type?: string
  readonly value: string
  readonly required?: boolean
  readonly autoComplete?: string
  readonly onChange: (value: string) => void
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-slate">{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-lime-deep"
      />
    </label>
  )
}

export function CheckoutExperience({
  clubId,
  paymentMethods,
  currency,
  onSubmit,
}: CheckoutExperienceProps) {
  const { cart, clear } = useCart()
  const [contact, setContact] = useState<ContactFields>(EMPTY_CONTACT)
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(
    paymentMethods[0]?.id ?? null,
  )
  const [proof, setProof] = useState<File | null>(null)
  const [players, setPlayers] = useState<readonly string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CheckoutResult | null>(null)
  const [isPending, startTransition] = useTransition()
  const proofInputRef = useRef<HTMLInputElement>(null)

  const capacity =
    cart.courts.length > 0 && cart.courts.every(hasCapacity)
      ? capacityBand(cart.courts)
      : null
  const namedPlayerCount = players.filter((player) => player.trim().length > 0).length
  const summary = buildOrderSummary(
    cart,
    currency,
    capacity && namedPlayerCount > 0 ? { partySize: namedPlayerCount, band: capacity } : undefined,
  )
  const method = paymentMethods.find((entry) => entry.id === selectedMethodId) ?? null

  if (result) {
    return <CheckoutThankYou result={result} currency={currency} />
  }

  if (summary.isEmpty) {
    return (
      <section className="mx-auto max-w-[480px] rounded-[18px] border border-line bg-surface p-8 text-center">
        <p className="text-[15px] font-bold text-ink">There is nothing to check out</p>
        <p className="mt-1 text-[13.5px] text-muted">
          Pick a court and a start time, then come back here.
        </p>
      </section>
    )
  }

  function setField(field: keyof ContactFields) {
    return (value: string) => setContact((current) => ({ ...current, [field]: value }))
  }

  /** Returns the reason this cannot be sent, or null if it can. */
  function findLocalProblem(): string | null {
    if (!method) {
      return 'Please choose how you would like to pay'
    }

    if (!proof) {
      return method.requiresProof
        ? `Please attach a screenshot of your ${method.label} payment`
        : null
    }

    const validated = validatePaymentProof(proof)

    return validated.success ? null : validated.error
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const problem = findLocalProblem()

    if (problem || !method) {
      setError(problem)
      return
    }

    setError(null)

    const form = new FormData()
    form.set(
      'order',
      JSON.stringify(
        buildCheckoutOrder({ clubId, cart, contact, paymentMethodId: method.id, players }),
      ),
    )

    if (proof) {
      form.set('proof', proof)
    }

    startTransition(async () => {
      const outcome = await onSubmit(form)

      if (!outcome.success) {
        // The cart is left alone on purpose: a slot conflict or a rate limit is
        // something the guest can act on, and clearing it would strand them.
        setError(outcome.error)
        return
      }

      setResult(outcome.data)
      clear()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-[1fr_400px] lg:items-start">
      <div className="flex flex-col gap-5">
        <section
          aria-labelledby="your-details"
          className="rounded-[18px] border border-line bg-surface p-6"
        >
          <h2
            id="your-details"
            className="font-[family-name:var(--font-display)] text-[20px] font-bold tracking-[-0.02em]"
          >
            Your details
          </h2>

          <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
            <Field
              label="Full name"
              name="contactName"
              value={contact.contactName}
              required
              autoComplete="name"
              onChange={setField('contactName')}
            />
            <Field
              label="Phone number"
              name="contactPhone"
              type="tel"
              value={contact.contactPhone}
              required
              autoComplete="tel"
              onChange={setField('contactPhone')}
            />
            <div className="sm:col-span-2">
              <Field
                label="Email address"
                name="contactEmail"
                type="email"
                value={contact.contactEmail}
                required
                autoComplete="email"
                onChange={setField('contactEmail')}
              />
            </div>
            <div className="sm:col-span-2">
              <Field
                label="Anything we should know? (optional)"
                name="notes"
                value={contact.notes}
                onChange={setField('notes')}
              />
            </div>
          </div>
        </section>

        {capacity ? (
          <section
            aria-labelledby="players"
            className="rounded-[18px] border border-line bg-surface p-6"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2
                id="players"
                className="font-[family-name:var(--font-display)] text-[20px] font-bold tracking-[-0.02em]"
              >
                Players
              </h2>
              <p className="text-[13px] font-semibold text-muted">
                Maximum {capacity.maxPlayers} players
              </p>
            </div>
            <p className="mt-1 text-[13px] text-muted">
              Add the names of everyone playing. This court seats {capacity.minPlayers}–
              {capacity.maxPlayers} players.
            </p>

            {players.length > 0 ? (
              <div className="mt-4 flex flex-col gap-2.5">
                {players.map((player, index) => (
                  <div key={index} className="flex items-end gap-2">
                    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="text-[13px] font-semibold text-slate">
                        Player {index + 1} name
                      </span>
                      <input
                        value={player}
                        autoComplete="off"
                        onChange={(event) =>
                          setPlayers((current) =>
                            current.map((name, position) =>
                              position === index ? event.target.value : name,
                            ),
                          )
                        }
                        className="rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-lime-deep"
                      />
                    </label>
                    <button
                      type="button"
                      aria-label={`Remove player ${index + 1}`}
                      onClick={() =>
                        setPlayers((current) => current.filter((_, position) => position !== index))
                      }
                      className="rounded-[9px] border border-line px-3 py-2.5 text-[13px] font-semibold text-muted hover:text-danger"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {players.length < capacity.maxPlayers ? (
              <button
                type="button"
                onClick={() => setPlayers((current) => [...current, ''])}
                className="mt-4 rounded-[9px] border border-navy px-3.5 py-2.5 text-[13px] font-bold text-navy"
              >
                + Add player
              </button>
            ) : null}
          </section>
        ) : null}

        <section
          aria-labelledby="payment"
          className="rounded-[18px] border border-line bg-surface p-6"
        >
          <h2
            id="payment"
            className="font-[family-name:var(--font-display)] text-[20px] font-bold tracking-[-0.02em]"
          >
            Payment
          </h2>

          <div className="mt-4">
            <PaymentMethodPicker
              methods={paymentMethods}
              selectedId={selectedMethodId}
              onSelect={(id) => {
                setSelectedMethodId(id)
                // The old file belongs to the old method's instructions.
                setProof(null)
                setError(null)

                if (proofInputRef.current) {
                  proofInputRef.current.value = ''
                }
              }}
            />
          </div>

          {method?.requiresProof ? (
            <div className="mt-5 flex flex-col gap-1.5">
              <label htmlFor={PROOF_INPUT_ID} className="text-[13px] font-semibold text-slate">
                Screenshot of your payment
              </label>
              <input
                id={PROOF_INPUT_ID}
                ref={proofInputRef}
                type="file"
                name="proof"
                accept={PROOF_ACCEPT_ATTRIBUTE}
                // Described, not labelled: folding the hint into the label would
                // make the field's accessible name a sentence about file sizes.
                aria-describedby={PROOF_HINT_ID}
                onChange={(event) => {
                  setProof(event.target.files?.[0] ?? null)
                  setError(null)
                }}
                className="rounded-[10px] border border-dashed border-line-heavy bg-canvas px-3.5 py-3 text-[13.5px] text-slate file:mr-3 file:rounded-[7px] file:border-0 file:bg-navy file:px-3 file:py-1.5 file:text-[13px] file:font-bold file:text-white"
              />
              <p id={PROOF_HINT_ID} className="text-[12.5px] text-muted">
                A JPG, PNG, or phone screenshot up to 5 MB.
              </p>
            </div>
          ) : null}
        </section>
      </div>

      <section
        aria-label="Order summary"
        className="flex flex-col gap-4 rounded-[18px] border border-line bg-surface p-6 lg:sticky lg:top-[88px]"
      >
        <h2 className="font-[family-name:var(--font-display)] text-[18px] font-bold">
          Order summary
        </h2>

        <ul className="flex flex-col">
          {summary.courtLines.map((line) => (
            <li
              key={line.key}
              className="flex items-start justify-between gap-3 border-b border-line py-3"
            >
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-ink">{line.name}</p>
                <p className="mt-0.5 text-[12.5px] text-muted">{line.window}</p>
              </div>
              <p className="shrink-0 text-[14px] font-bold tabular-nums text-ink">{line.price}</p>
            </li>
          ))}

          {summary.itemLines.map((line) => (
            <li
              key={line.key}
              className="flex items-center justify-between gap-3 border-b border-line py-3"
            >
              <p className="text-[14px] font-bold text-ink">
                {line.name}
                <span className="ml-1.5 font-semibold text-muted">× {line.quantity}</span>
              </p>
              <p className="shrink-0 text-[14px] font-bold tabular-nums text-ink">{line.price}</p>
            </li>
          ))}

          {summary.extraPlayersLine ? (
            <li className="flex items-center justify-between gap-3 border-b border-line py-3">
              <p className="text-[14px] font-bold text-ink">
                Extra players
                <span className="ml-1.5 font-semibold text-muted">
                  × {summary.extraPlayersLine.quantity}
                </span>
              </p>
              <p className="shrink-0 text-[14px] font-bold tabular-nums text-ink">
                {summary.extraPlayersLine.price}
              </p>
            </li>
          ) : null}
        </ul>

        <div className="flex items-baseline justify-between pt-1">
          <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">Total</p>
          <p
            data-testid="checkout-total"
            className="font-[family-name:var(--font-display)] text-[24px] font-bold tabular-nums text-ink"
          >
            {summary.total}
          </p>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="rounded-[10px] bg-navy px-4 py-3 text-[14px] font-bold text-white disabled:cursor-not-allowed disabled:bg-line-heavy disabled:text-muted"
        >
          {isPending ? 'Confirming…' : `Confirm reservation — ${summary.total}`}
        </button>

        {error ? (
          <p role="alert" className="text-[13px] font-semibold text-danger">
            {error}
          </p>
        ) : null}

        <p className="text-center text-[12.5px] text-muted">
          Your court is held while we verify your payment.
        </p>
      </section>
    </form>
  )
}

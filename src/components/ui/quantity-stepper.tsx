'use client'

/**
 * The −/qty/+ control on café and add-on rows.
 *
 * Bounds are enforced here as well as in the schema: a disabled control is
 * clearer than an error after the fact, and a negative quantity would price a
 * negative line.
 */

const MIN_QUANTITY = 0
/** Matches bookingItemSchema's ceiling in src/lib/api/schemas.ts. */
const MAX_QUANTITY = 99

export interface QuantityStepperProps {
  /** Product name, used to distinguish this row's controls from every other row's. */
  readonly label: string
  readonly quantity: number
  readonly onChange: (quantity: number) => void
  readonly min?: number
  readonly max?: number
}

export function QuantityStepper({
  label,
  quantity,
  onChange,
  min = MIN_QUANTITY,
  max = MAX_QUANTITY,
}: QuantityStepperProps) {
  const canDecrease = quantity > min
  const canIncrease = quantity < max

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-line-strong bg-surface p-1">
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={!canDecrease}
        onClick={() => onChange(quantity - 1)}
        className="grid h-7 w-7 place-items-center rounded-lg text-ink transition hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-40"
      >
        −
      </button>
      <span className="min-w-6 text-center text-sm font-semibold tabular-nums">{quantity}</span>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={!canIncrease}
        onClick={() => onChange(quantity + 1)}
        className="grid h-7 w-7 place-items-center rounded-lg text-ink transition hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-40"
      >
        +
      </button>
    </div>
  )
}

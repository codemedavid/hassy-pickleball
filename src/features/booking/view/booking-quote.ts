import { formatMinutes, formatMoney } from '@/lib/format/money'

/**
 * The "Your booking" sidebar's price breakdown.
 *
 * The court price arriving here has already been quoted by
 * `quoteCourtSegment`, which is the single source of truth for court pricing.
 * This module never re-prices a court: it explains the number, adds the
 * chosen extras, and applies a discount the pricing pipeline already decided.
 */

export type QuoteAddon = {
  readonly productId: string
  readonly name: string
  readonly unitPriceCents: number
  readonly quantity: number
}

export type PriceLine = {
  readonly label: string
  readonly value: string
}

export type BuildBookingQuoteInput = {
  readonly courtName: string
  readonly durationMinutes: number
  /** Null until a start time is picked — there is no session to price yet. */
  readonly courtPriceCents: number | null
  readonly discountCents: number
  readonly discountLabel?: string
  readonly addons: readonly QuoteAddon[]
  readonly currency: string
}

export type BookingQuote = {
  readonly lines: readonly PriceLine[]
  readonly totalCents: number
  readonly total: string
  /** False while no slot is selected, so the CTA can stay disabled. */
  readonly hasCourt: boolean
}

function addonLine(addon: QuoteAddon, currency: string): PriceLine {
  return {
    // "Extra players × 2" — the multiplier is only worth saying above one.
    label: addon.quantity > 1 ? `${addon.name} × ${addon.quantity}` : addon.name,
    value: formatMoney(addon.unitPriceCents * addon.quantity, currency),
  }
}

export function buildBookingQuote(input: BuildBookingQuoteInput): BookingQuote {
  const hasCourt = input.courtPriceCents !== null
  const courtCents = input.courtPriceCents ?? 0

  const courtLines: readonly PriceLine[] = hasCourt
    ? [
        {
          label: `${input.courtName} · ${formatMinutes(input.durationMinutes)}`,
          value: formatMoney(courtCents, input.currency),
        },
      ]
    : []

  const chosen = input.addons.filter((addon) => addon.quantity > 0)
  const addonCents = chosen.reduce(
    (running, addon) => running + addon.unitPriceCents * addon.quantity,
    0,
  )

  // A zero discount is left out rather than shown as "−₱0": an anonymous
  // visitor gets no tier pricing, and naming a discount they did not receive
  // would misrepresent the price.
  const discountLines: readonly PriceLine[] =
    input.discountCents > 0
      ? [
          {
            label: input.discountLabel ?? 'Discount',
            value: `−${formatMoney(input.discountCents, input.currency)}`,
          },
        ]
      : []

  const totalCents = Math.max(0, courtCents + addonCents - input.discountCents)

  return {
    lines: [
      ...courtLines,
      ...chosen.map((addon) => addonLine(addon, input.currency)),
      ...discountLines,
    ],
    totalCents,
    total: formatMoney(totalCents, input.currency),
    hasCourt,
  }
}

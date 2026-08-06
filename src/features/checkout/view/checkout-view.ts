import { summariseCart, type Cart } from '@/lib/domain/cart'
import { formatMoney } from '@/lib/format/money'
import { formatDayInZone, formatTimeInZone } from '@/lib/format/time'

/**
 * Read models for the checkout screen.
 *
 * Two jobs, both pure: turn the cart into lines a guest can read, and turn it
 * into the payload the server re-prices. Neither belongs in the component —
 * the second one especially, because "what exactly do we send" is the part
 * worth pinning down in tests rather than in JSX.
 */

/** A published payment method, narrowed to what the browser is allowed to see. */
export type CheckoutPaymentMethod = {
  readonly id: string
  readonly label: string
  readonly accountName: string | null
  readonly accountNumber: string | null
  readonly instructions: string | null
  readonly qrImageUrl: string | null
  readonly requiresProof: boolean
}

export type OrderCourtLine = {
  readonly key: string
  readonly name: string
  readonly window: string
  readonly price: string
}

export type OrderItemLine = {
  readonly key: string
  readonly name: string
  readonly quantity: number
  readonly price: string
}

export type OrderSummary = {
  readonly courtLines: readonly OrderCourtLine[]
  readonly itemLines: readonly OrderItemLine[]
  readonly total: string
  readonly totalCents: number
  readonly isEmpty: boolean
}

export type CheckoutContact = {
  readonly contactName: string
  readonly contactEmail: string
  readonly contactPhone: string
  readonly notes: string
}

export function buildOrderSummary(cart: Cart, currency: string): OrderSummary {
  const summary = summariseCart(cart)

  return {
    courtLines: cart.courts.map((court) => ({
      key: `${court.courtId}-${court.startsAt.toISOString()}`,
      name: court.courtName,
      window: `${formatDayInZone(court.startsAt, court.timeZone)} · ${formatTimeInZone(
        court.startsAt,
        court.timeZone,
      )} – ${formatTimeInZone(court.endsAt, court.timeZone)}`,
      price: formatMoney(court.priceCents, court.currency),
    })),
    itemLines: cart.items.map((item) => ({
      key: item.productId,
      name: item.name,
      quantity: item.quantity,
      // The extended price: a guest reconciling against their receipt is
      // checking the line, not the unit.
      price: formatMoney(item.unitPriceCents * item.quantity, item.currency),
    })),
    total: formatMoney(summary.totalCents, currency),
    totalCents: summary.totalCents,
    isEmpty: cart.courts.length === 0 && cart.items.length === 0,
  }
}

export type CheckoutOrder = {
  readonly clubId: string
  readonly contactName: string
  readonly contactEmail: string
  readonly contactPhone: string
  readonly notes: string | null
  readonly paymentMethodId: string
  readonly courts: ReadonlyArray<{
    readonly courtId: string
    readonly startsAt: string
    readonly endsAt: string
  }>
  readonly items: ReadonlyArray<{ readonly productId: string; readonly quantity: number }>
}

/**
 * The payload posted to the checkout action.
 *
 * Deliberately carries no prices. The cart holds them so it can render a total
 * offline, but sending them would invite a client to name its own — the server
 * re-quotes every segment from the catalog and the rule stack.
 */
export function buildCheckoutOrder({
  clubId,
  cart,
  contact,
  paymentMethodId,
}: {
  readonly clubId: string
  readonly cart: Cart
  readonly contact: CheckoutContact
  readonly paymentMethodId: string
}): CheckoutOrder {
  const notes = contact.notes.trim()

  return {
    clubId,
    contactName: contact.contactName.trim(),
    contactEmail: contact.contactEmail.trim(),
    contactPhone: contact.contactPhone.trim(),
    notes: notes.length > 0 ? notes : null,
    paymentMethodId,
    courts: cart.courts.map((court) => ({
      courtId: court.courtId,
      startsAt: court.startsAt.toISOString(),
      endsAt: court.endsAt.toISOString(),
    })),
    items: cart.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
  }
}

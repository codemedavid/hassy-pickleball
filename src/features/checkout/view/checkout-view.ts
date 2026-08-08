import { summariseCart, type Cart } from '@/lib/domain/cart'
import { extraPlayerFeeCents, type CapacityBand } from '@/lib/domain/pax'
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

/** The heads beyond what the slot price covers, as one line on the summary. */
export type OrderExtraPlayersLine = {
  readonly quantity: number
  readonly price: string
}

export type OrderSummary = {
  readonly courtLines: readonly OrderCourtLine[]
  readonly itemLines: readonly OrderItemLine[]
  readonly extraPlayersLine: OrderExtraPlayersLine | null
  readonly total: string
  readonly totalCents: number
  readonly isEmpty: boolean
}

/** Who is playing, and the seating terms of the courts they are playing on. */
export type PartyPricing = {
  readonly partySize: number
  readonly band: CapacityBand
}

export type CheckoutContact = {
  readonly contactName: string
  readonly contactEmail: string
  readonly contactPhone: string
  readonly notes: string
}

export function buildOrderSummary(
  cart: Cart,
  currency: string,
  party?: PartyPricing,
): OrderSummary {
  const summary = summariseCart(cart)
  // Zero until the guest has named enough players to exceed what the court
  // price covers, so the line stays absent for the common case.
  const extraFeeCents = party ? extraPlayerFeeCents(party.partySize, party.band) : 0
  const extraPlayers = party ? Math.max(0, party.partySize - party.band.includedPlayers) : 0
  const totalCents = summary.totalCents + extraFeeCents

  return {
    extraPlayersLine:
      extraFeeCents > 0
        ? { quantity: extraPlayers, price: formatMoney(extraFeeCents, currency) }
        : null,
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
    total: formatMoney(totalCents, currency),
    totalCents,
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
  /** Everyone playing, in the order the booker named them. Counting them is
   *  how the server derives the party size. */
  readonly players: readonly string[]
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
  players = [],
}: {
  readonly clubId: string
  readonly cart: Cart
  readonly contact: CheckoutContact
  readonly paymentMethodId: string
  readonly players?: readonly string[]
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
    // Blank rows are dropped rather than sent: the booker leaving the last row
    // empty means a smaller party, not a player with no name.
    players: players.map((player) => player.trim()).filter((player) => player.length > 0),
  }
}

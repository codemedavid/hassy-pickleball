import { rangesOverlap } from './time'
import type { CartItem, CourtSelection } from './types'

export type CartSummary = {
  readonly courtsSubtotalCents: number
  readonly itemsSubtotalCents: number
  readonly totalCents: number
  readonly courtCount: number
  readonly itemCount: number
  readonly startsAt: Date | null
  readonly endsAt: Date | null
}

export type Cart = {
  readonly courts: readonly CourtSelection[]
  readonly items: readonly CartItem[]
}

export function summariseCart(cart: Cart): CartSummary {
  const courtsSubtotalCents = cart.courts.reduce((sum, court) => sum + court.priceCents, 0)
  const itemsSubtotalCents = cart.items.reduce(
    (sum, item) => sum + item.unitPriceCents * item.quantity,
    0,
  )

  const startTimes = cart.courts.map((court) => court.startsAt.getTime())
  const endTimes = cart.courts.map((court) => court.endsAt.getTime())

  return {
    courtsSubtotalCents,
    itemsSubtotalCents,
    totalCents: courtsSubtotalCents + itemsSubtotalCents,
    courtCount: cart.courts.length,
    itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
    startsAt: startTimes.length > 0 ? new Date(Math.min(...startTimes)) : null,
    endsAt: endTimes.length > 0 ? new Date(Math.max(...endTimes)) : null,
  }
}

/**
 * Adds a court segment. Rejects a segment that collides with one already in the
 * cart — the database would reject it later anyway, and failing here lets the
 * UI say so before checkout.
 */
export function addCourtToCart(
  courts: readonly CourtSelection[],
  selection: CourtSelection,
): CourtSelection[] {
  const conflict = courts.some(
    (court) => court.courtId === selection.courtId && rangesOverlap(court, selection),
  )

  if (conflict) {
    throw new Error('That court and time is already in your cart')
  }

  return [...courts, selection]
}

export function removeCourtFromCart(
  courts: readonly CourtSelection[],
  target: { readonly courtId: string; readonly startsAt: Date },
): CourtSelection[] {
  return courts.filter(
    (court) =>
      court.courtId !== target.courtId ||
      court.startsAt.getTime() !== target.startsAt.getTime(),
  )
}

/** Sets a line's quantity. A quantity of zero or less removes the line. */
export function setItemQuantity(
  items: readonly CartItem[],
  productId: string,
  quantity: number,
): CartItem[] {
  if (quantity <= 0) {
    return items.filter((item) => item.productId !== productId)
  }

  return items.map((item) => (item.productId === productId ? { ...item, quantity } : item))
}

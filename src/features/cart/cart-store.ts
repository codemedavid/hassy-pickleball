import type { Cart } from '@/lib/domain/cart'
import type { CartItem, CourtSelection } from '@/lib/domain/types'

/**
 * Cart persistence.
 *
 * The cart is browser-side until checkout: holding a slot server-side would
 * mean writing rows the customer may never pay for, and the exclusion
 * constraint already settles the race at the moment of booking.
 *
 * Everything read back is treated as untrusted — it survived a reload, a
 * schema change, or a user editing localStorage by hand. Anything that does
 * not parse is dropped rather than allowed to reach the pricing code as
 * `Invalid Date`.
 */

const STORAGE_KEY = 'pickleball.cart.v1'

export const EMPTY_CART: Cart = { courts: [], items: [] }

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null
}

function toValidDate(value: unknown): Date | null {
  if (typeof value !== 'string') {
    return null
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}

function toCourtSelection(value: unknown): CourtSelection | null {
  if (!isRecord(value) || typeof value.courtId !== 'string') {
    return null
  }

  const startsAt = toValidDate(value.startsAt)
  const endsAt = toValidDate(value.endsAt)

  if (!startsAt || !endsAt || typeof value.priceCents !== 'number') {
    return null
  }

  return { courtId: value.courtId, startsAt, endsAt, priceCents: value.priceCents }
}

function toCartItem(value: unknown): CartItem | null {
  if (
    !isRecord(value) ||
    typeof value.productId !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.unitPriceCents !== 'number' ||
    typeof value.quantity !== 'number'
  ) {
    return null
  }

  return {
    productId: value.productId,
    name: value.name,
    unitPriceCents: value.unitPriceCents,
    quantity: value.quantity,
  }
}

function isNotNull<T>(value: T | null): value is T {
  return value !== null
}

export function readStoredCart(): Cart {
  if (typeof window === 'undefined') {
    return EMPTY_CART
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    return EMPTY_CART
  }

  try {
    const parsed: unknown = JSON.parse(raw)

    if (!isRecord(parsed) || !Array.isArray(parsed.courts) || !Array.isArray(parsed.items)) {
      return EMPTY_CART
    }

    return {
      courts: parsed.courts.map(toCourtSelection).filter(isNotNull),
      items: parsed.items.map(toCartItem).filter(isNotNull),
    }
  } catch {
    // Corrupt storage is not an error the customer can act on; start empty.
    return EMPTY_CART
  }
}

export function writeStoredCart(cart: Cart): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart))
}

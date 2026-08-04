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

/**
 * The cart as an external store, so components can read it through
 * `useSyncExternalStore`.
 *
 * The alternative — hydrating into `useState` from an effect — is what React 19
 * lints against, and it renders one frame with an empty cart before correcting
 * itself. Here the first client render already sees the stored cart, while the
 * server render sees a stable empty one.
 */

type Listener = () => void

const listeners = new Set<Listener>()

/**
 * `getSnapshot` must return a referentially stable value or React re-renders
 * forever, so the parsed cart is cached and only replaced on write.
 */
let snapshot: Cart | null = null

export function subscribeToCart(listener: Listener): () => void {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function getCartSnapshot(): Cart {
  snapshot ??= readStoredCart()

  return snapshot
}

/** Server render has no localStorage; a constant keeps hydration consistent. */
export function getCartServerSnapshot(): Cart {
  return EMPTY_CART
}

export function setCart(cart: Cart): void {
  snapshot = cart
  writeStoredCart(cart)

  for (const listener of listeners) {
    listener()
  }
}

/** Test seam: drops the cached snapshot so a fresh read hits storage again. */
export function resetCartSnapshot(): void {
  snapshot = null
}

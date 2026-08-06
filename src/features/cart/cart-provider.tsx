'use client'

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import {
  EMPTY_CART,
  getCartServerSnapshot,
  getCartSnapshot,
  setCart,
  subscribeToCart,
} from './cart-store'
import {
  addCourtToCart,
  removeCourtFromCart,
  setItemQuantity as setLineQuantity,
  summariseCart,
} from '@/lib/domain/cart'
import type { Cart, CartCourtLine, CartItemLine, CartSummary } from '@/lib/domain/cart'

/**
 * The cart, held client-side and mirrored to localStorage.
 *
 * All the arithmetic lives in lib/domain/cart, which is pure and already
 * tested; this provider only wires that to React. Adding an overlapping
 * segment throws there and is swallowed here — the customer has already been
 * shown that slot as taken, so surfacing an error would be noise.
 */

export type CartContextValue = {
  readonly cart: Cart
  readonly summary: CartSummary
  readonly addCourt: (selection: CartCourtLine) => void
  readonly removeCourt: (courtId: string, startsAt: Date) => void
  readonly setItemQuantity: (item: CartItemLine, quantity: number) => void
  readonly clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { readonly children: ReactNode }) {
  const cart = useSyncExternalStore(subscribeToCart, getCartSnapshot, getCartServerSnapshot)

  const addCourt = useCallback((selection: CartCourtLine) => {
    const current = getCartSnapshot()

    try {
      setCart({ ...current, courts: addCourtToCart(current.courts, selection) })
    } catch {
      // Already held. Leaving the cart unchanged is the correct outcome.
    }
  }, [])

  const removeCourt = useCallback((courtId: string, startsAt: Date) => {
    const current = getCartSnapshot()

    setCart({
      ...current,
      courts: removeCourtFromCart(current.courts, { courtId, startsAt }),
    })
  }, [])

  /**
   * Upsert: the domain helper updates or removes an existing line, but a
   * product added from the shop for the first time is not in the list yet.
   */
  const setItemQuantity = useCallback((item: CartItemLine, quantity: number) => {
    const current = getCartSnapshot()
    const exists = current.items.some((line) => line.productId === item.productId)

    if (!exists) {
      if (quantity > 0) {
        setCart({ ...current, items: [...current.items, { ...item, quantity }] })
      }

      return
    }

    setCart({ ...current, items: setLineQuantity(current.items, item.productId, quantity) })
  }, [])

  const clear = useCallback(() => setCart(EMPTY_CART), [])

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      summary: summariseCart(cart),
      addCourt,
      removeCourt,
      setItemQuantity,
      clear,
    }),
    [cart, addCourt, removeCourt, setItemQuantity, clear],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext)

  if (!value) {
    throw new Error('useCart must be used inside a CartProvider')
  }

  return value
}

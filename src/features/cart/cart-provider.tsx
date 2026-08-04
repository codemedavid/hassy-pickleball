'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { EMPTY_CART, readStoredCart, writeStoredCart } from './cart-store'
import {
  addCourtToCart,
  removeCourtFromCart,
  setItemQuantity as setLineQuantity,
  summariseCart,
} from '@/lib/domain/cart'
import type { Cart, CartSummary } from '@/lib/domain/cart'
import type { CartItem, CourtSelection } from '@/lib/domain/types'

/**
 * The cart, held client-side and mirrored to localStorage.
 *
 * All the arithmetic lives in lib/domain/cart, which is pure and already
 * tested; this provider only owns React state and persistence. Adding an
 * overlapping segment throws there, and is swallowed here — the customer has
 * already been shown that slot as taken, so a thrown error would be noise.
 */

export type CartContextValue = {
  readonly cart: Cart
  readonly summary: CartSummary
  readonly addCourt: (selection: CourtSelection) => void
  readonly removeCourt: (courtId: string, startsAt: Date) => void
  readonly setItemQuantity: (item: CartItem, quantity: number) => void
  readonly clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { readonly children: ReactNode }) {
  // Server and first client render must agree, so hydration happens in an
  // effect rather than in the initial state.
  const [cart, setCart] = useState<Cart>(EMPTY_CART)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setCart(readStoredCart())
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (isHydrated) {
      writeStoredCart(cart)
    }
  }, [cart, isHydrated])

  const addCourt = useCallback((selection: CourtSelection) => {
    setCart((current) => {
      try {
        return { ...current, courts: addCourtToCart(current.courts, selection) }
      } catch {
        // Already held. Keeping the cart unchanged is the correct outcome.
        return current
      }
    })
  }, [])

  const removeCourt = useCallback((courtId: string, startsAt: Date) => {
    setCart((current) => ({
      ...current,
      courts: removeCourtFromCart(current.courts, { courtId, startsAt }),
    }))
  }, [])

  /**
   * Upsert: the domain helper updates or removes an existing line, but a
   * product added from the shop for the first time is not in the list yet.
   */
  const setItemQuantity = useCallback((item: CartItem, quantity: number) => {
    setCart((current) => {
      const exists = current.items.some((line) => line.productId === item.productId)

      if (!exists) {
        return quantity > 0
          ? { ...current, items: [...current.items, { ...item, quantity }] }
          : current
      }

      return { ...current, items: setLineQuantity(current.items, item.productId, quantity) }
    })
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

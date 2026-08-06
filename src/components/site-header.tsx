'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { useCart } from '@/features/cart/cart-provider'
import { CartDrawer } from '@/features/cart/ui/cart-drawer'

/**
 * Site chrome for the storefront.
 *
 * A Client Component because the cart count lives in the client-side cart
 * store. The cart is the button that opens the drawer, and the drawer's open
 * state lives here because the same component owns both halves of the pair.
 */
export function SiteHeader() {
  const { summary } = useCart()
  const count = summary.courtCount + summary.itemCount
  const [isCartOpen, setIsCartOpen] = useState(false)
  const cartRef = useRef<HTMLButtonElement>(null)

  function closeCart() {
    setIsCartOpen(false)
    // The drawer took focus on open; dropping it on the body would restart
    // keyboard navigation at the top of the page.
    cartRef.current?.focus()
  }

  return (
    <header className="sticky top-0 z-40 bg-navy text-white">
      <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center gap-4 px-5 sm:px-7">
        {/* The mark and the wordmark are one link; the mark is decorative so
            the accessible name stays just the club name. */}
        <Link href="/" className="mr-2 flex items-center gap-2.5 text-white hover:text-white">
          <span
            aria-hidden
            className="grid size-[30px] place-items-center rounded-[9px] bg-lime font-[family-name:var(--font-display)] text-[16px] font-extrabold text-navy"
          >
            P
          </span>
          <span className="font-[family-name:var(--font-display)] text-[18px] font-bold tracking-[-0.02em]">
            Pickleball
          </span>
        </Link>

        <nav aria-label="Main" className="flex items-center gap-1">
          <Link
            href="/"
            className="rounded-lg bg-white/15 px-3.5 py-[7px] text-[13.5px] font-semibold text-white hover:text-white"
          >
            Courts
          </Link>
        </nav>

        <button
          ref={cartRef}
          type="button"
          aria-expanded={isCartOpen}
          aria-controls="cart-drawer-title"
          onClick={() => setIsCartOpen((wasOpen) => !wasOpen)}
          className="ml-auto flex items-center gap-2 rounded-[10px] border border-white/20 px-3.5 py-[7px] text-[13.5px] font-semibold text-white/85 hover:border-white/40 hover:text-white"
        >
          Cart{' '}
          {count === 0 ? (
            <span className="text-white/60">empty</span>
          ) : (
            <>
              <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-lime px-1.5 text-[12px] font-bold text-navy">
                {count}
              </span>{' '}
              {/* The badge is the visible count; the noun is announced only. */}
              <span className="sr-only">{count === 1 ? 'item' : 'items'}</span>
            </>
          )}
        </button>
      </div>

      <CartDrawer isOpen={isCartOpen} onClose={closeCart} />
    </header>
  )
}

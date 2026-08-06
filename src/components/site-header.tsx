'use client'

import Link from 'next/link'
import { useCart } from '@/features/cart/cart-provider'

/**
 * Site chrome for the storefront.
 *
 * A Client Component because the cart count lives in the client-side cart
 * store. The count is a `status` region rather than a link: there is no
 * checkout page yet, and a link to a route that 404s is worse than a summary.
 */
export function SiteHeader() {
  const { summary } = useCart()
  const count = summary.courtCount + summary.itemCount

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex w-full max-w-[1280px] items-center gap-6 px-7 py-4">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-[18px] font-extrabold tracking-[-0.02em]"
        >
          Pickleball
        </Link>

        <nav aria-label="Main" className="flex items-center gap-4">
          <Link href="/" className="text-[14px] font-bold text-muted hover:text-foreground">
            Courts
          </Link>
        </nav>

        <p
          role="status"
          className="ml-auto flex items-center gap-2 text-[14px] font-bold text-muted"
        >
          Cart{' '}
          {count === 0 ? (
            <span>empty</span>
          ) : (
            <>
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-navy px-2 text-[12px] text-white">
                {count}
              </span>{' '}
              {/* The badge is the visible count; the noun is announced only. */}
              <span className="sr-only">{count === 1 ? 'item' : 'items'}</span>
            </>
          )}
        </p>
      </div>
    </header>
  )
}

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

        <p
          role="status"
          className="ml-auto flex items-center gap-2 rounded-[10px] border border-white/20 px-3.5 py-[7px] text-[13.5px] font-semibold text-white/85"
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
        </p>
      </div>
    </header>
  )
}

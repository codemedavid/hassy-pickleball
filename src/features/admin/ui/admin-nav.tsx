'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ADMIN_NAV_ITEMS, isNavItemActive } from './nav-items'

const SCROLL_EDGE_TOLERANCE = 1
const SCROLL_PAGE_RATIO = 0.8

const MOBILE_NAV_LINK =
  'flex h-11 flex-none snap-center items-center border-b-2 px-3.5 text-[14px] font-semibold whitespace-nowrap ' +
  'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-navy ' +
  'lg:h-auto lg:rounded-lg lg:border-b-0 lg:px-3.5 lg:py-[7px] lg:text-[13.5px] lg:focus-visible:outline-white'

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

interface MobileAdminNavRailProps {
  readonly pathname: string
}

function MobileAdminNavRail({ pathname }: MobileAdminNavRailProps) {
  const viewportRef = useRef<HTMLElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateBoundaries = useCallback((): void => {
    const viewport = viewportRef.current
    if (!viewport) return

    const maximum = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
    setCanScrollLeft(viewport.scrollLeft > SCROLL_EDGE_TOLERANCE)
    setCanScrollRight(viewport.scrollLeft < maximum - SCROLL_EDGE_TOLERANCE)
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const activeLink = viewport.querySelector<HTMLElement>('[aria-current="page"]')
    activeLink?.scrollIntoView?.({ block: 'nearest', inline: 'center' })
    updateBoundaries()

    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(updateBoundaries)
    resizeObserver?.observe(viewport)
    window.addEventListener('resize', updateBoundaries)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateBoundaries)
    }
  }, [pathname, updateBoundaries])

  function scroll(direction: -1 | 1): void {
    const viewport = viewportRef.current
    if (!viewport) return

    viewport.scrollBy({
      left: direction * viewport.clientWidth * SCROLL_PAGE_RATIO,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }

  return (
    <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] bg-white text-navy lg:contents">
      <button
        type="button"
        aria-label="Scroll admin sections left"
        disabled={!canScrollLeft}
        onClick={() => scroll(-1)}
        className="grid size-11 place-items-center border-r border-navy/10 text-xl disabled:text-navy/25 lg:hidden"
      >
        <span aria-hidden>‹</span>
      </button>

      <nav
        ref={viewportRef}
        aria-label="Admin sections"
        onScroll={updateBoundaries}
        className="flex min-w-0 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:order-3 lg:flex-1 lg:gap-1 lg:snap-none"
      >
        {ADMIN_NAV_ITEMS.map((item) => {
          const isCurrent = isNavItemActive(pathname, item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isCurrent ? 'page' : undefined}
              className={`${MOBILE_NAV_LINK} ${
                isCurrent
                  ? 'border-navy text-navy lg:bg-white/15 lg:text-white'
                  : 'border-transparent text-navy/60 hover:text-navy lg:text-white/65 lg:hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      <button
        type="button"
        aria-label="Scroll admin sections right"
        disabled={!canScrollRight}
        onClick={() => scroll(1)}
        className="grid size-11 place-items-center border-l border-navy/10 text-xl disabled:text-navy/25 lg:hidden"
      >
        <span aria-hidden>›</span>
      </button>
    </div>
  )
}

export interface AdminNavProps {
  readonly clubName: string
  readonly staffName: string
}

function initialsOf(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

export function AdminNav({ clubName, staffName }: AdminNavProps) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 bg-navy text-white">
      <div className="mx-auto w-full max-w-[1440px] lg:flex lg:h-16 lg:items-center lg:gap-4 lg:px-7">
        <div className="flex h-14 items-center gap-2 px-4 sm:gap-3 sm:px-7 lg:contents">
          <Link
            href="/admin"
            className="order-1 flex min-w-0 flex-1 items-center gap-2.5 text-white hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:mr-1 lg:flex-none"
          >
            <span
              aria-hidden
              className="grid size-[30px] flex-none place-items-center rounded-[9px] bg-lime font-[family-name:var(--font-display)] text-[16px] font-extrabold text-navy"
            >
              P
            </span>
            <span className="truncate font-[family-name:var(--font-display)] text-[17px] font-bold tracking-[-0.02em] lg:text-[18px]">
              {clubName}
            </span>
          </Link>

          <span className="order-2 hidden flex-none rounded-md bg-white/12 px-2.5 py-[5px] text-[11px] font-bold tracking-[0.1em] text-lime uppercase lg:inline">
            Admin
          </span>

          <div className="order-4 ml-auto flex flex-none items-center gap-1 sm:gap-3 lg:gap-4">
            <Link
              href="/"
              aria-label="Customer site"
              className="flex min-h-11 items-center px-1 text-[13px] font-semibold text-white/70 hover:text-lime focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-2 lg:min-h-0 lg:px-0"
            >
              <span className="sm:hidden">Site</span>
              <span className="hidden sm:inline">Customer site</span>
            </Link>

            <span
              aria-label={`Signed in as ${staffName}`}
              className="flex min-h-11 items-center gap-2"
            >
              <span
                aria-hidden
                className="grid size-8 flex-none place-items-center rounded-full bg-navy-mid text-[12px] font-bold text-lime lg:size-7"
              >
                {initialsOf(staffName)}
              </span>
              <span className="hidden text-[13px] text-white/80 sm:inline">{staffName}</span>
            </span>
          </div>
        </div>

        <MobileAdminNavRail pathname={pathname} />
      </div>
    </header>
  )
}

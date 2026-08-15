'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ADMIN_NAV_ITEMS, currentNavLabel, isNavItemActive } from './nav-items'

/**
 * Console chrome. A Client Component because the current section comes from the
 * pathname and, below `lg`, the section list collapses behind a toggle.
 *
 * The current tab is marked with aria-current as well as a lighter background,
 * so where you are is not communicated by colour alone.
 *
 * There is one list of sections, revealed rather than duplicated: a second copy
 * for phones would double every link in the accessibility tree and drift from
 * the first the day a section was added. The menu wraps that one list plus the
 * account block, and `data-open` reveals it. The mobile and desktop layouts are
 * written in disjoint `max-lg:` / `lg:` rules, so which one applies never
 * depends on the order Tailwind emits them in.
 */

const MENU_ID = 'admin-menu'

/** Panel geometry below `lg`: dropped under the bar, which is h-14 there. */
const MENU_PHONE =
  'max-lg:absolute max-lg:inset-x-0 max-lg:top-14 max-lg:hidden max-lg:flex-col max-lg:gap-1 ' +
  'max-lg:border-t max-lg:border-white/10 max-lg:bg-navy max-lg:p-3 max-lg:shadow-lg ' +
  'max-lg:data-[open=true]:flex'

/** On `lg` the wrapper generates no box, so its children join the bar's flex row. */
const MENU_DESKTOP = 'lg:contents'

/** Tall enough to tap: 44px rows on a phone, the compact strip on a desktop. */
const MENU_LINK =
  'flex items-center rounded-lg font-semibold whitespace-nowrap hover:text-white ' +
  'max-lg:h-11 max-lg:px-3.5 max-lg:text-[15px] ' +
  'lg:px-3.5 lg:py-[7px] lg:text-[13.5px]'

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
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  function closeMenu(): void {
    setIsMenuOpen(false)
  }

  return (
    <header className="sticky top-0 z-40 bg-navy text-white">
      <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-3 px-4 sm:px-7 lg:h-16 lg:gap-4">
        <Link
          href="/admin"
          className="flex min-w-0 items-center gap-2.5 text-white hover:text-white lg:mr-1 lg:flex-none"
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

        {/* Below `lg` the club name and the toggle need the room more. */}
        <span className="hidden flex-none rounded-md bg-white/12 px-2.5 py-[5px] text-[11px] font-bold tracking-[0.1em] text-lime uppercase lg:inline">
          Admin
        </span>

        <button
          type="button"
          aria-expanded={isMenuOpen}
          aria-controls={MENU_ID}
          onClick={() => setIsMenuOpen((open) => !open)}
          className="ml-auto flex h-10 flex-none items-center gap-2 rounded-xl bg-white/12 px-3 text-[13.5px] font-semibold text-white lg:hidden"
        >
          <span aria-hidden className="text-[15px] leading-none">
            {isMenuOpen ? '✕' : '☰'}
          </span>
          {/* Closed, the button still says which section you are in. */}
          {currentNavLabel(pathname)}
        </button>

        <div id={MENU_ID} data-open={isMenuOpen} className={`${MENU_PHONE} ${MENU_DESKTOP}`}>
          <nav
            aria-label="Admin sections"
            className={
              'flex max-lg:flex-col max-lg:gap-1 ' +
              'lg:min-w-0 lg:flex-1 lg:gap-1 lg:overflow-x-auto lg:[scrollbar-width:none]'
            }
          >
            {ADMIN_NAV_ITEMS.map((item) => {
              const isCurrent = isNavItemActive(pathname, item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isCurrent ? 'page' : undefined}
                  onClick={closeMenu}
                  className={`${MENU_LINK} ${isCurrent ? 'bg-white/15 text-white' : 'text-white/65'}`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div
            className={
              'flex text-[13px] max-lg:mt-1 max-lg:flex-col max-lg:gap-1 max-lg:border-t ' +
              'max-lg:border-white/10 max-lg:pt-2 lg:flex-none lg:items-center lg:gap-4'
            }
          >
            <Link
              href="/"
              onClick={closeMenu}
              className={`${MENU_LINK} text-white/65 hover:text-lime lg:px-0 lg:py-0 lg:text-[13px]`}
            >
              Customer site
            </Link>
            <span className="flex items-center gap-2 max-lg:px-3.5 max-lg:pb-1">
              <span
                aria-hidden
                className="grid size-7 flex-none place-items-center rounded-full bg-navy-mid text-[12px] font-bold text-lime"
              >
                {initialsOf(staffName)}
              </span>
              <span className="text-white/80">{staffName}</span>
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}

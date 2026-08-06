'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ADMIN_NAV_ITEMS, isNavItemActive } from './nav-items'

/**
 * Console chrome. A Client Component only because the current section comes
 * from the pathname; nothing else here is interactive.
 *
 * The current tab is marked with aria-current as well as a lighter background,
 * so where you are is not communicated by colour alone.
 */

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
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-4 px-5 sm:px-7">
        <Link
          href="/admin"
          className="mr-1 flex flex-none items-center gap-2.5 text-white hover:text-white"
        >
          <span
            aria-hidden
            className="grid size-[30px] place-items-center rounded-[9px] bg-lime font-[family-name:var(--font-display)] text-[16px] font-extrabold text-navy"
          >
            P
          </span>
          <span className="font-[family-name:var(--font-display)] text-[18px] font-bold tracking-[-0.02em]">
            {clubName}
          </span>
        </Link>

        <span className="flex-none rounded-md bg-white/12 px-2.5 py-[5px] text-[11px] font-bold tracking-[0.1em] text-lime uppercase">
          Admin
        </span>

        <nav
          aria-label="Admin sections"
          className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none]"
        >
          {ADMIN_NAV_ITEMS.map((item) => {
            const isCurrent = isNavItemActive(pathname, item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isCurrent ? 'page' : undefined}
                className={`rounded-lg px-3.5 py-[7px] text-[13.5px] font-semibold whitespace-nowrap hover:text-white ${
                  isCurrent ? 'bg-white/15 text-white' : 'text-white/65'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex flex-none items-center gap-4 text-[13px]">
          <Link href="/" className="text-white/65 hover:text-lime">
            Customer site
          </Link>
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className="grid size-7 place-items-center rounded-full bg-navy-mid text-[12px] font-bold text-lime"
            >
              {initialsOf(staffName)}
            </span>
            <span className="hidden text-white/80 sm:inline">{staffName}</span>
          </span>
        </div>
      </div>
    </header>
  )
}

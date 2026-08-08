/** The admin console's sections, in the order the design's tab strip shows them. */

export type AdminNavItem = {
  readonly label: string
  readonly href: string
}

export const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  { label: 'Schedule', href: '/admin' },
  { label: 'Bookings', href: '/admin/bookings' },
  { label: 'Orders', href: '/admin/orders' },
  { label: 'Courts', href: '/admin/courts' },
  { label: 'Products', href: '/admin/products' },
  { label: 'Pricing', href: '/admin/pricing' },
  { label: 'Customers', href: '/admin/customers' },
  { label: 'Reports', href: '/admin/reports' },
]

const CONSOLE_ROOT = '/admin'

/**
 * Whether a tab should read as the current section.
 *
 * The schedule lives at the console root, so it is matched exactly — a prefix
 * match there would light up Schedule on every other page. Every other section
 * also claims its nested detail routes, so /admin/orders/ORD-1 keeps Orders lit.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === CONSOLE_ROOT) {
    return pathname === CONSOLE_ROOT
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

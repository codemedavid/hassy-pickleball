import { describe, expect, it } from 'vitest'
import { ADMIN_NAV_ITEMS, isNavItemActive } from './nav-items'

describe('ADMIN_NAV_ITEMS', () => {
  it('lists the seven console sections in the order the design shows them', () => {
    expect(ADMIN_NAV_ITEMS.map((item) => item.label)).toEqual([
      'Schedule',
      'Bookings',
      'Orders',
      'Products',
      'Pricing',
      'Customers',
      'Reports',
    ])
  })

  it('points every section at a route under /admin', () => {
    for (const item of ADMIN_NAV_ITEMS) {
      expect(item.href.startsWith('/admin')).toBe(true)
    }
  })
})

describe('isNavItemActive', () => {
  it('marks a section active on its own route', () => {
    expect(isNavItemActive('/admin/bookings', '/admin/bookings')).toBe(true)
  })

  it('marks a section active on a nested route beneath it', () => {
    expect(isNavItemActive('/admin/orders/ORD-2291', '/admin/orders')).toBe(true)
  })

  it('does not mark a section active for a sibling with a shared prefix', () => {
    expect(isNavItemActive('/admin/products-archive', '/admin/products')).toBe(false)
  })

  it('only marks Schedule active at the console root, not on every admin page', () => {
    // Arrange — /admin is the schedule route, so a naive prefix match would
    // light up Schedule on every other section too.
    const scheduleHref = '/admin'

    // Act & Assert
    expect(isNavItemActive('/admin', scheduleHref)).toBe(true)
    expect(isNavItemActive('/admin/reports', scheduleHref)).toBe(false)
  })
})

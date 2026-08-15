import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AdminNav } from './admin-nav'
import { ADMIN_NAV_ITEMS } from './nav-items'

const pathname = vi.hoisted(() => ({ current: '/admin' }))

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.current,
}))

describe('AdminNav', () => {
  it('names the club and the signed-in staff member', () => {
    // Arrange
    pathname.current = '/admin'

    // Act
    render(<AdminNav clubName="Riverbend Pickleball" staffName="Priya Desk" />)

    // Assert
    expect(screen.getByRole('link', { name: /Riverbend Pickleball/ })).toBeInTheDocument()
    expect(screen.getByText('Priya Desk')).toBeInTheDocument()
  })

  it('links to every console section', () => {
    // Arrange
    pathname.current = '/admin'

    // Act
    render(<AdminNav clubName="Riverbend" staffName="Priya" />)

    // Assert — one link per configured section. The list itself is asserted in
    // nav-items.test.ts, so counting a literal here would only duplicate it and
    // break every time a section is added.
    const nav = screen.getByRole('navigation', { name: 'Admin sections' })
    expect(nav.querySelectorAll('a')).toHaveLength(ADMIN_NAV_ITEMS.length)

    for (const item of ADMIN_NAV_ITEMS) {
      expect(screen.getByRole('link', { name: item.label })).toHaveAttribute('href', item.href)
    }
  })

  it('marks the section being viewed as current, for screen readers too', () => {
    // Arrange
    pathname.current = '/admin/bookings/PB-4821'

    // Act
    render(<AdminNav clubName="Riverbend" staffName="Priya" />)

    // Assert — colour alone would not tell a screen reader where it is.
    expect(screen.getByRole('link', { name: 'Bookings' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Schedule' })).not.toHaveAttribute('aria-current')
  })

  it('links staff directly to payment-method management', () => {
    pathname.current = '/admin/payment-methods'

    render(<AdminNav clubName="Riverbend" staffName="Priya" />)

    expect(screen.getByRole('link', { name: 'Payment methods' })).toHaveAttribute(
      'href',
      '/admin/payment-methods',
    )
    expect(screen.getByRole('link', { name: 'Payment methods' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('names the section being viewed on the phone menu button', () => {
    // Arrange — the tab strip is collapsed on a phone, so the button has to say
    // where you are without being opened.
    pathname.current = '/admin/payment-methods'

    // Act
    render(<AdminNav clubName="Riverbend" staffName="Priya" />)

    // Assert
    expect(screen.getByRole('button', { name: /Payment methods/ })).toBeInTheDocument()
  })

  it('starts with the phone section menu closed', () => {
    // Arrange
    pathname.current = '/admin'

    // Act
    render(<AdminNav clubName="Riverbend" staffName="Priya" />)

    // Assert
    expect(screen.getByRole('button', { name: /Schedule/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.getByRole('navigation', { name: 'Admin sections' })).toHaveAttribute(
      'data-open',
      'false',
    )
  })

  it('opens the section list when the phone menu button is pressed', async () => {
    // Arrange
    pathname.current = '/admin'
    const user = userEvent.setup()
    render(<AdminNav clubName="Riverbend" staffName="Priya" />)

    // Act
    await user.click(screen.getByRole('button', { name: /Schedule/ }))

    // Assert
    expect(screen.getByRole('button', { name: /Schedule/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getByRole('navigation', { name: 'Admin sections' })).toHaveAttribute(
      'data-open',
      'true',
    )
  })

  it('closes the menu once a section is chosen', async () => {
    // Arrange — leaving it open would cover the page the staff member just
    // asked for.
    pathname.current = '/admin'
    const user = userEvent.setup()
    render(<AdminNav clubName="Riverbend" staffName="Priya" />)
    await user.click(screen.getByRole('button', { name: /Schedule/ }))

    // Act
    await user.click(screen.getByRole('link', { name: 'Bookings' }))

    // Assert
    expect(screen.getByRole('navigation', { name: 'Admin sections' })).toHaveAttribute(
      'data-open',
      'false',
    )
  })

  it('points the phone menu button at the one list of sections', async () => {
    // Arrange
    pathname.current = '/admin'

    // Act
    render(<AdminNav clubName="Riverbend" staffName="Priya" />)

    // Assert — one list, revealed rather than duplicated: a second copy for
    // phones would drift from the first and double every link on the page.
    const nav = screen.getByRole('navigation', { name: 'Admin sections' })
    expect(screen.getByRole('button', { name: /Schedule/ })).toHaveAttribute(
      'aria-controls',
      nav.id,
    )
    expect(nav.id).not.toBe('')
    expect(screen.getAllByRole('link', { name: 'Bookings' })).toHaveLength(1)
  })

  it('offers a way back to the customer site', () => {
    // Arrange
    pathname.current = '/admin'

    // Act
    render(<AdminNav clubName="Riverbend" staffName="Priya" />)

    // Assert
    expect(screen.getByRole('link', { name: 'Customer site' })).toHaveAttribute('href', '/')
  })
})

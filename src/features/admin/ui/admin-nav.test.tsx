import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AdminNav } from './admin-nav'

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

    // Assert
    const nav = screen.getByRole('navigation', { name: 'Admin sections' })
    expect(nav.querySelectorAll('a')).toHaveLength(7)
  })

  it('marks the section being viewed as current, for screen readers too', () => {
    // Arrange
    pathname.current = '/admin/orders/ORD-2291'

    // Act
    render(<AdminNav clubName="Riverbend" staffName="Priya" />)

    // Assert — colour alone would not tell a screen reader where it is.
    expect(screen.getByRole('link', { name: 'Orders' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Schedule' })).not.toHaveAttribute('aria-current')
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

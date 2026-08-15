import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AdminNav } from './admin-nav'
import { ADMIN_NAV_ITEMS } from './nav-items'

const pathname = vi.hoisted(() => ({ current: '/admin' }))

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.current,
}))

function installScrollMetrics(
  viewport: HTMLElement,
  {
    clientWidth,
    scrollWidth,
    scrollLeft,
  }: Record<'clientWidth' | 'scrollWidth' | 'scrollLeft', number>,
): void {
  Object.defineProperties(viewport, {
    clientWidth: { configurable: true, value: clientWidth },
    scrollWidth: { configurable: true, value: scrollWidth },
    scrollLeft: { configurable: true, writable: true, value: scrollLeft },
  })
}

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

  it('keeps the compact header focused on identity and the customer site', () => {
    pathname.current = '/admin'

    render(<AdminNav clubName="Riverbend" staffName="Priya Desk" />)

    expect(screen.getByRole('link', { name: 'Customer site' })).toHaveAttribute('href', '/')
    expect(screen.getByLabelText('Signed in as Priya Desk')).toHaveTextContent('PD')
    expect(screen.queryByRole('button', { name: /Schedule/ })).not.toBeInTheDocument()
  })

  it('disables both scroll buttons when every admin section fits', async () => {
    pathname.current = '/admin'
    render(<AdminNav clubName="Riverbend" staffName="Priya" />)
    const nav = screen.getByRole('navigation', { name: 'Admin sections' })
    installScrollMetrics(nav, { clientWidth: 600, scrollWidth: 600, scrollLeft: 0 })

    fireEvent.scroll(nav)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Scroll admin sections left' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Scroll admin sections right' })).toBeDisabled()
    })
  })

  it('updates scroll-button availability at the rail boundaries', async () => {
    pathname.current = '/admin'
    render(<AdminNav clubName="Riverbend" staffName="Priya" />)
    const nav = screen.getByRole('navigation', { name: 'Admin sections' })
    const left = screen.getByRole('button', { name: 'Scroll admin sections left' })
    const right = screen.getByRole('button', { name: 'Scroll admin sections right' })
    installScrollMetrics(nav, { clientWidth: 300, scrollWidth: 900, scrollLeft: 0 })

    fireEvent.scroll(nav)

    await waitFor(() => {
      expect(left).toBeDisabled()
      expect(right).toBeEnabled()
    })

    nav.scrollLeft = 600
    fireEvent.scroll(nav)

    await waitFor(() => {
      expect(left).toBeEnabled()
      expect(right).toBeDisabled()
    })
  })

  it('remeasures overflow when the viewport width changes', async () => {
    pathname.current = '/admin'
    render(<AdminNav clubName="Riverbend" staffName="Priya" />)
    const nav = screen.getByRole('navigation', { name: 'Admin sections' })
    installScrollMetrics(nav, { clientWidth: 600, scrollWidth: 600, scrollLeft: 0 })

    fireEvent.resize(window)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Scroll admin sections left' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Scroll admin sections right' })).toBeDisabled()
    })

    installScrollMetrics(nav, { clientWidth: 300, scrollWidth: 900, scrollLeft: 0 })
    fireEvent.resize(window)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Scroll admin sections left' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Scroll admin sections right' })).toBeEnabled()
    })
  })

  it('scrolls the rail in both directions by a useful distance', async () => {
    pathname.current = '/admin'
    const user = userEvent.setup()
    render(<AdminNav clubName="Riverbend" staffName="Priya" />)
    const nav = screen.getByRole('navigation', { name: 'Admin sections' })
    const scrollBy = vi.fn()
    installScrollMetrics(nav, { clientWidth: 300, scrollWidth: 900, scrollLeft: 300 })
    Object.defineProperty(nav, 'scrollBy', { configurable: true, value: scrollBy })

    fireEvent.scroll(nav)
    const left = screen.getByRole('button', { name: 'Scroll admin sections left' })
    const right = screen.getByRole('button', { name: 'Scroll admin sections right' })
    await waitFor(() => {
      expect(left).toBeEnabled()
      expect(right).toBeEnabled()
    })

    await user.click(left)
    expect(scrollBy).toHaveBeenCalledWith({ left: -240, behavior: 'smooth' })

    scrollBy.mockClear()
    await user.click(right)
    expect(scrollBy).toHaveBeenCalledWith({ left: 240, behavior: 'smooth' })
  })

  it('uses instant rail movement when reduced motion is requested', async () => {
    const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia')
    const matchMedia = vi.fn((query: string) =>
      ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as MediaQueryList,
    )
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: matchMedia })
    pathname.current = '/admin'

    try {
      const user = userEvent.setup()
      render(<AdminNav clubName="Riverbend" staffName="Priya" />)
      const nav = screen.getByRole('navigation', { name: 'Admin sections' })
      const scrollBy = vi.fn()
      installScrollMetrics(nav, { clientWidth: 300, scrollWidth: 900, scrollLeft: 300 })
      Object.defineProperty(nav, 'scrollBy', { configurable: true, value: scrollBy })

      fireEvent.scroll(nav)
      const right = screen.getByRole('button', { name: 'Scroll admin sections right' })
      await waitFor(() => expect(right).toBeEnabled())
      await user.click(right)

      expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
      expect(scrollBy).toHaveBeenCalledWith({ left: 240, behavior: 'auto' })
    } finally {
      if (originalMatchMedia) {
        Object.defineProperty(window, 'matchMedia', originalMatchMedia)
      } else {
        Reflect.deleteProperty(window, 'matchMedia')
      }
    }
  })

  it('positions the active tab within the visible rail', () => {
    const originalScrollIntoView = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollIntoView',
    )
    const scrollIntoView = vi.fn(function (
      this: HTMLElement,
      options?: ScrollIntoViewOptions,
    ): void {
      void this
      void options
    })
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })
    pathname.current = '/admin/payment-methods'

    try {
      render(<AdminNav clubName="Riverbend" staffName="Priya" />)
      const activeLink = screen.getByRole('link', { name: 'Payment methods' })

      expect(activeLink).toHaveAttribute('aria-current', 'page')
      expect(scrollIntoView.mock.instances[0]).toBe(activeLink)
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'center' })
    } finally {
      if (originalScrollIntoView) {
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView)
      } else {
        delete HTMLElement.prototype.scrollIntoView
      }
    }
  })

  it('renders one responsive list of admin sections', () => {
    pathname.current = '/admin'

    render(<AdminNav clubName="Riverbend" staffName="Priya" />)

    expect(screen.getAllByRole('navigation', { name: 'Admin sections' })).toHaveLength(1)
    expect(screen.getAllByRole('link', { name: 'Bookings' })).toHaveLength(1)
  })

  it('offers a way back to the customer site', () => {
    pathname.current = '/admin'

    render(<AdminNav clubName="Riverbend" staffName="Priya" />)

    expect(screen.getByRole('link', { name: 'Customer site' })).toHaveAttribute('href', '/')
  })
})

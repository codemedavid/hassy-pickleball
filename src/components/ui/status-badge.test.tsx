import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from './status-badge'

/**
 * Status wording is customer-facing: "awaiting_payment" is a database enum, not
 * something to print on a confirmation page.
 */
describe('StatusBadge', () => {
  it('renders a booking status in plain language', () => {
    render(<StatusBadge status="awaiting_payment" />)

    expect(screen.getByText('Awaiting payment')).toBeInTheDocument()
  })

  it('renders a confirmed booking', () => {
    render(<StatusBadge status="confirmed" />)

    expect(screen.getByText('Confirmed')).toBeInTheDocument()
  })

  it('renders a cancelled booking', () => {
    render(<StatusBadge status="cancelled" />)

    expect(screen.getByText('Cancelled')).toBeInTheDocument()
  })

  it('distinguishes a cancelled booking from a confirmed one for screen readers', () => {
    const { rerender } = render(<StatusBadge status="confirmed" />)
    const confirmed = screen.getByRole('status').className

    rerender(<StatusBadge status="cancelled" />)

    expect(screen.getByRole('status').className).not.toBe(confirmed)
  })

  it('falls back to the raw value rather than rendering nothing for an unknown status', () => {
    render(<StatusBadge status={'archived' as never} />)

    expect(screen.getByRole('status')).toHaveTextContent('archived')
  })
})

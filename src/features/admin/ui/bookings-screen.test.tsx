import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BookingsScreen } from './bookings-screen'
import { toBookingDetailView, toBookingRows } from '../view/bookings'
import { club, makeBooking } from '../../../../test/admin-fixtures'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

/**
 * One ledger for every booking, with the selected one managed beside it. This
 * screen replaced the separate Orders ledger: the same rows, seen through both
 * the session and the money at once.
 */

const bookings = [
  makeBooking({
    id: 'b1',
    reference: 'PB-4821',
    contactName: 'Maya Halvorsen',
    status: 'confirmed',
    segments: [{ courtId: 'court-1', courtName: 'Harbor Court', from: '17:00', to: '18:30' }],
    items: [{ name: 'Paddle rental', quantity: 2 }],
    payments: [{ method: 'gcash', status: 'paid' }],
  }),
  makeBooking({
    id: 'b2',
    reference: 'PB-4820',
    contactName: 'Jun Park',
    status: 'awaiting_payment',
    segments: [{ courtId: 'court-1', courtName: 'Harbor Court', from: '20:00', to: '21:00' }],
    payments: [{ method: 'bank_transfer', status: 'pending' }],
  }),
]

const rows = toBookingRows(bookings, club)

function screenProps(detail = toBookingDetailView(bookings[0], club)) {
  return {
    rows,
    detail,
    currency: club.currency,
    onSetStatus: vi.fn(),
    onMarkPaid: vi.fn(),
    onRefund: vi.fn(),
  }
}

describe('BookingsScreen', () => {
  it('lists every booking as a row in a real table', () => {
    // Act
    render(<BookingsScreen {...screenProps()} />)

    // Assert — a table, not a grid of divs, so it can be read by column.
    const table = screen.getByRole('table', { name: 'Bookings' })
    expect(within(table).getAllByRole('row')).toHaveLength(3)
  })

  it('shows the reference, customer, court, time, and extras for each booking', () => {
    // Act
    render(<BookingsScreen {...screenProps()} />)

    // Assert
    const table = screen.getByRole('table', { name: 'Bookings' })
    expect(within(table).getByText('PB-4821')).toBeInTheDocument()
    expect(within(table).getByText('Maya Halvorsen')).toBeInTheDocument()
    expect(within(table).getByText(/5:00 PM · 1 hr 30 min/)).toBeInTheDocument()
    expect(within(table).getByText('Paddle rental ×2')).toBeInTheDocument()
  })

  it('states each booking’s status in words, not only in colour', () => {
    // Act
    render(<BookingsScreen {...screenProps()} />)

    // Assert
    const table = screen.getByRole('table', { name: 'Bookings' })
    expect(within(table).getByText('Awaiting payment')).toBeInTheDocument()
    expect(within(table).getByText('Confirmed')).toBeInTheDocument()
  })

  /**
   * The reason the two ledgers merged: one row now carries both facts, so the
   * desk sees a confirmed booking whose transfer has not cleared.
   */
  it('shows how each booking was paid and whether the money has landed', () => {
    // Act
    render(<BookingsScreen {...screenProps()} />)

    // Assert
    const table = screen.getByRole('table', { name: 'Bookings' })
    expect(within(table).getByText('GCash')).toBeInTheDocument()
    expect(within(table).getByText('Bank transfer')).toBeInTheDocument()
    expect(within(table).getByText('Paid')).toBeInTheDocument()
    expect(within(table).getByText('Awaiting')).toBeInTheDocument()
  })

  it('links each row to itself, so staff can send a colleague the exact booking', () => {
    // Act
    render(<BookingsScreen {...screenProps()} />)

    // Assert
    expect(screen.getByRole('link', { name: 'PB-4820' })).toHaveAttribute(
      'href',
      '/admin/bookings?booking=b2',
    )
  })

  it('opens the selected booking in the panel beside the table', () => {
    // Act
    render(<BookingsScreen {...screenProps()} />)

    // Assert
    expect(screen.getByRole('heading', { name: 'PB-4821' })).toBeInTheDocument()
  })

  it('says so plainly when there is nothing booked', () => {
    // Act
    render(<BookingsScreen {...screenProps()} rows={[]} detail={null} />)

    // Assert
    expect(screen.getByText('No bookings in this window yet.')).toBeInTheDocument()
  })

  it('counts what the desk is chasing in the subtitle', () => {
    // Act
    render(<BookingsScreen {...screenProps()} />)

    // Assert
    expect(screen.getByText(/1 awaiting payment/)).toBeInTheDocument()
  })
})

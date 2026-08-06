import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BookingsScreen } from './bookings-screen'
import { toBookingRows } from '../view/bookings'
import { club, makeBooking } from '../../../../test/admin-fixtures'

const rows = toBookingRows(
  [
    makeBooking({
      id: 'b1',
      reference: 'PB-4821',
      contactName: 'Maya Halvorsen',
      status: 'confirmed',
      segments: [{ courtId: 'court-1', courtName: 'Harbor Court', from: '17:00', to: '18:30' }],
      items: [{ name: 'Paddle rental', quantity: 2 }],
    }),
    makeBooking({
      id: 'b2',
      reference: 'PB-4820',
      contactName: 'Jun Park',
      status: 'awaiting_payment',
      segments: [{ courtId: 'court-1', courtName: 'Harbor Court', from: '20:00', to: '21:00' }],
    }),
  ],
  club,
)

describe('BookingsScreen', () => {
  it('lists every booking as a row in a real table', () => {
    // Act
    render(<BookingsScreen rows={rows} />)

    // Assert — a table, not a grid of divs, so it can be read by column.
    const table = screen.getByRole('table', { name: 'Bookings' })
    expect(within(table).getAllByRole('row')).toHaveLength(3)
  })

  it('shows the reference, customer, court, time, and total for each booking', () => {
    // Act
    render(<BookingsScreen rows={rows} />)

    // Assert
    expect(screen.getByText('PB-4821')).toBeInTheDocument()
    expect(screen.getByText('Maya Halvorsen')).toBeInTheDocument()
    expect(screen.getByText(/5:00 PM · 1 hr 30 min/)).toBeInTheDocument()
    expect(screen.getByText('Paddle rental ×2')).toBeInTheDocument()
  })

  it('states each booking’s status in words, not only in colour', () => {
    // Act
    render(<BookingsScreen rows={rows} />)

    // Assert
    expect(screen.getByText('Awaiting payment')).toBeInTheDocument()
    expect(screen.getByText('Confirmed')).toBeInTheDocument()
  })

  it('says so plainly when there is nothing booked', () => {
    // Act
    render(<BookingsScreen rows={[]} />)

    // Assert
    expect(screen.getByText('No bookings in this window yet.')).toBeInTheDocument()
  })
})

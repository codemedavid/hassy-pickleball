import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BookingsScreen } from './bookings-screen'
import { toBookingDetailView, toBookingRows } from '../view/bookings'
import { club, makeBooking } from '../../../../test/admin-fixtures'
import {
  expectCellsLabelledByColumn,
  expectExplicitTableRoles,
  expectNoPhoneMinimumWidth,
} from '../../../../test/responsive-table'

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

/**
 * Thirty days of bookings is an unscannable column of cards on a phone, so the
 * desk says what it is after rather than scrolling for it.
 */
describe('BookingsScreen searching', () => {
  it('narrows the ledger to the customer the desk typed', async () => {
    // Arrange
    render(<BookingsScreen {...screenProps()} />)
    const user = userEvent.setup()

    // Act
    await user.type(screen.getByRole('searchbox', { name: /search bookings/i }), 'Jun')

    // Assert
    const table = screen.getByRole('table', { name: 'Bookings' })
    expect(within(table).getByText('PB-4820')).toBeInTheDocument()
    expect(within(table).queryByText('PB-4821')).not.toBeInTheDocument()
  })

  it('says nothing matched rather than showing an empty ledger', async () => {
    // Arrange
    render(<BookingsScreen {...screenProps()} />)
    const user = userEvent.setup()

    // Act
    await user.type(screen.getByRole('searchbox', { name: /search bookings/i }), 'Nobody')

    // Assert
    expect(screen.getByText('No bookings match this search.')).toBeInTheDocument()
  })

  it('counts what sits behind each status tab', () => {
    // Act
    render(<BookingsScreen {...screenProps()} />)

    // Assert
    const tabs = screen.getByRole('group', { name: /filter bookings/i })
    expect(within(tabs).getByRole('button', { name: /^all 2$/i })).toBeInTheDocument()
    expect(within(tabs).getByRole('button', { name: /^awaiting payment 1$/i })).toBeInTheDocument()
  })

  it('narrows the ledger to the money it still has to chase', async () => {
    // Arrange
    render(<BookingsScreen {...screenProps()} />)
    const user = userEvent.setup()

    // Act
    await user.click(screen.getByRole('button', { name: /^awaiting payment 1$/i }))

    // Assert
    const table = screen.getByRole('table', { name: 'Bookings' })
    expect(within(table).getByText('PB-4820')).toBeInTheDocument()
    expect(within(table).queryByText('PB-4821')).not.toBeInTheDocument()
  })

  it('marks the tab in force, so the desk knows what it is looking at', async () => {
    // Arrange
    render(<BookingsScreen {...screenProps()} />)
    const user = userEvent.setup()

    // Act
    await user.click(screen.getByRole('button', { name: /^confirmed 1$/i }))

    // Assert
    expect(screen.getByRole('button', { name: /^confirmed 1$/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /^all 2$/i })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('BookingsScreen on a phone', () => {
  it('stacks each row into a labelled card instead of scrolling sideways', () => {
    // Arrange & Act
    render(<BookingsScreen {...screenProps()} />)

    // Assert — the header row is off-screen in the stacked layout, so every
    // cell names its own column and the table keeps its roles.
    const table = screen.getByRole('table', { name: 'Bookings' })
    expectCellsLabelledByColumn(table)
    expectExplicitTableRoles(table)
    expectNoPhoneMinimumWidth(table)
  })

  /**
   * Nine columns printed as nine label-and-value lines is a wall of grey text.
   * The card is led by the two things staff scan for — which booking, and how
   * much — with the badges beside them.
   */
  it('leads each card with the reference and the amount owed', () => {
    // Arrange & Act
    render(<BookingsScreen {...screenProps()} />)

    // Assert
    const table = screen.getByRole('table', { name: 'Bookings' })
    const [row] = within(table).getAllByRole('row').slice(1)
    const roleOf = (label: string): string | null =>
      within(row)
        .getAllByRole('cell')
        .find((cell) => cell.getAttribute('data-label') === label)
        ?.getAttribute('data-mobile') ?? null

    expect(roleOf('Reference')).toBe('title')
    expect(roleOf('Total')).toBe('trailing')
    expect(roleOf('Customer')).toBe('lead')
    expect(roleOf('Status')).toBe('badge')
    expect(roleOf('Payment')).toBe('badge')
    expect(roleOf('Court')).toBe('inline')
  })

  it('gives every card a tappable way into the booking, not just the reference', () => {
    // Arrange & Act
    render(<BookingsScreen {...screenProps()} />)

    // Assert
    expect(screen.getByRole('link', { name: /manage PB-4820/i })).toHaveAttribute(
      'href',
      '/admin/bookings?booking=b2',
    )
  })

  /**
   * Landing on Bookings shows the ledger. The panel would otherwise open on
   * whichever booking happened to be newest and push the list off the screen.
   */
  it('keeps the panel out of the way until a booking is actually opened', () => {
    // Arrange & Act
    render(<BookingsScreen {...screenProps()} isSelectionExplicit={false} />)

    // Assert
    const panel = screen.getByRole('region', { name: 'Booking PB-4821' })
    expect(panel.parentElement?.className).toContain('max-lg:hidden')
  })

  it('puts an opened booking above the ledger, with a way back to it', () => {
    // Arrange & Act
    render(<BookingsScreen {...screenProps()} isSelectionExplicit />)

    // Assert
    const panel = screen.getByRole('region', { name: 'Booking PB-4821' })
    expect(panel.parentElement?.className).toContain('max-lg:order-first')
    expect(screen.getByRole('link', { name: /all bookings/i })).toHaveAttribute(
      'href',
      '/admin/bookings',
    )
  })
})

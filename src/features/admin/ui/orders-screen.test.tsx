import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OrdersScreen } from './orders-screen'
import { toOrderDetail, toOrderRows } from '../view/orders'
import { club, makeBooking } from '../../../../test/admin-fixtures'

const paid = makeBooking({
  id: 'b1',
  reference: 'PB-4821',
  contactName: 'Maya Halvorsen',
  segments: [{ courtId: 'court-1', courtName: 'Harbor Court', from: '17:00', to: '18:30' }],
  items: [{ name: 'Flat white' }],
  payments: [{ method: 'card', status: 'paid' }],
  notes: 'Charged to Visa •••• 4417.',
})

const unpaid = makeBooking({
  id: 'b2',
  reference: 'PB-4820',
  contactName: 'Jun Park',
  status: 'awaiting_payment',
  segments: [{ courtId: 'court-1', courtName: 'Harbor Court', from: '20:00', to: '21:00' }],
  payments: [{ method: 'bank_transfer', status: 'pending' }],
})

const rows = toOrderRows([paid, unpaid], club)

describe('OrdersScreen', () => {
  it('lists the ledger with what each order was for and how it was paid', () => {
    // Act
    render(<OrdersScreen rows={rows} detail={toOrderDetail(paid, club)} />)

    // Assert
    const table = screen.getByRole('table', { name: 'Orders and payments' })
    expect(within(table).getByText('Court 1 hr 30 min + Flat white')).toBeInTheDocument()
    expect(within(table).getByText('Bank transfer')).toBeInTheDocument()
  })

  it('distinguishes settled orders from those still owing, in words', () => {
    // Act
    render(<OrdersScreen rows={rows} detail={toOrderDetail(paid, club)} />)
    const table = screen.getByRole('table', { name: 'Orders and payments' })

    // Assert
    expect(within(table).getByText('Paid')).toBeInTheDocument()
    expect(within(table).getByText('Awaiting')).toBeInTheDocument()
  })

  it('breaks the selected order down to its lines and total', () => {
    // Act
    render(<OrdersScreen rows={rows} detail={toOrderDetail(paid, club)} />)
    const panel = screen.getByRole('region', { name: 'Order PB-4821' })

    // Assert
    expect(within(panel).getByText('Court time')).toBeInTheDocument()
    expect(within(panel).getByText('Charged to Visa •••• 4417.')).toBeInTheDocument()
    expect(within(panel).getByText('₱750')).toBeInTheDocument()
  })

  it('links each row to its own order so a different one can be opened', () => {
    // Act
    render(<OrdersScreen rows={rows} detail={toOrderDetail(paid, club)} />)

    // Assert
    expect(screen.getByRole('link', { name: /PB-4820/ })).toHaveAttribute(
      'href',
      '/admin/orders?order=b2',
    )
  })

  it('says there is nothing to reconcile when the ledger is empty', () => {
    // Act
    render(<OrdersScreen rows={[]} detail={null} />)

    // Assert
    expect(screen.getByText('No orders in this window yet.')).toBeInTheDocument()
  })
})

import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CustomersScreen } from './customers-screen'
import { club, at } from '../../../../test/admin-fixtures'
import {
  expectCellsLabelledByColumn,
  expectExplicitTableRoles,
  expectNoPhoneMinimumWidth,
} from '../../../../test/responsive-table'
import type { Customer } from '@/lib/repositories/booking-mappers'

const customers: Customer[] = [
  {
    id: 'c1',
    clubId: club.id,
    fullName: 'Maya Halvorsen',
    email: 'maya@example.com',
    phone: null,
    tier: 'pro',
    totalSpendCents: 114_000,
    bookingsCount: 42,
    lastVisitAt: at('09:00'),
  },
  {
    id: 'c2',
    clubId: club.id,
    fullName: 'Jun Park',
    email: 'jun@example.com',
    phone: null,
    tier: 'standard',
    totalSpendCents: 7_400,
    bookingsCount: 3,
    lastVisitAt: null,
  },
]

describe('CustomersScreen', () => {
  it('lists players with their tier, booking count, and lifetime spend', () => {
    // Act
    render(<CustomersScreen customers={customers} club={club} />)

    // Assert
    const table = screen.getByRole('table', { name: 'Customers' })
    expect(within(table).getByText('Maya Halvorsen')).toBeInTheDocument()
    expect(within(table).getByText('Pro')).toBeInTheDocument()
    expect(within(table).getByText('42')).toBeInTheDocument()
    expect(within(table).getByText('₱1,140')).toBeInTheDocument()
  })

  it('says a customer has not visited rather than rendering an empty cell', () => {
    // Act
    render(<CustomersScreen customers={customers} club={club} />)

    // Assert
    expect(screen.getByText('Never')).toBeInTheDocument()
  })

  it('says there are no customers yet when the club is new', () => {
    // Act
    render(<CustomersScreen customers={[]} club={club} />)

    // Assert
    expect(screen.getByText('No customers yet.')).toBeInTheDocument()
  })
})

describe('CustomersScreen on a phone', () => {
  it('stacks each row into a labelled card instead of scrolling sideways', () => {
    // Arrange & Act
    render(<CustomersScreen customers={customers} club={club} />)

    // Assert — the header row is off-screen in the stacked layout, so every
    // cell names its own column and the table keeps its roles.
    const table = screen.getByRole('table', { name: 'Customers' })
    expectCellsLabelledByColumn(table)
    expectExplicitTableRoles(table)
    expectNoPhoneMinimumWidth(table)
  })
})

import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CustomersScreen } from './customers-screen'
import { ProductsScreen } from './products-screen'
import { club, at } from '../../../../test/admin-fixtures'
import type { Customer } from '@/lib/repositories/booking-mappers'
import type { Product } from '@/lib/repositories/mappers'

const products: Product[] = [
  {
    id: 'p1',
    clubId: club.id,
    name: 'Paddle rental',
    description: 'Loaner paddle for the session',
    type: 'addon',
    priceCents: 10_000,
    hasQuantity: true,
    imageUrl: null,
    sortOrder: 1,
    isActive: true,
  },
  {
    id: 'p2',
    clubId: club.id,
    name: 'Flat white',
    description: null,
    type: 'cafe',
    priceCents: 15_000,
    hasQuantity: true,
    imageUrl: null,
    sortOrder: 2,
    isActive: false,
  },
]


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

describe('ProductsScreen', () => {
  it('lists each product with its type and price', () => {
    // Act
    render(<ProductsScreen products={products} currency={club.currency} />)

    // Assert
    const table = screen.getByRole('table', { name: 'Products' })
    expect(within(table).getByText('Paddle rental')).toBeInTheDocument()
    expect(within(table).getByText('Add-on')).toBeInTheDocument()
    expect(within(table).getByText('₱100')).toBeInTheDocument()
  })

  it('marks a product that is not on sale, so a hidden item is not mistaken for a live one', () => {
    // Act
    render(<ProductsScreen products={products} currency={club.currency} />)

    // Assert
    expect(screen.getByText('Hidden')).toBeInTheDocument()
    expect(screen.getByText('On sale')).toBeInTheDocument()
  })

  it('says the catalog is empty rather than showing bare column headings', () => {
    // Act
    render(<ProductsScreen products={[]} currency={club.currency} />)

    // Assert
    expect(screen.getByText('No products yet.')).toBeInTheDocument()
  })
})

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

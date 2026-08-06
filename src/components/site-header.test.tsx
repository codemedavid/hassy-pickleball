import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { SiteHeader } from './site-header'
import { CartProvider, useCart } from '@/features/cart/cart-provider'
import type { CartItem, CourtSelection } from '@/lib/domain/types'

function selection(overrides: Partial<CourtSelection> = {}): CourtSelection {
  return {
    courtId: 'court-1',
    startsAt: new Date('2026-08-10T02:00:00.000Z'),
    endsAt: new Date('2026-08-10T03:00:00.000Z'),
    priceCents: 90000,
    ...overrides,
  }
}

function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productId: 'paddle-rental',
    name: 'Paddle rental',
    unitPriceCents: 15000,
    quantity: 1,
    ...overrides,
  }
}

/** Buttons that mutate the shared cart store so the badge has something to count. */
function CartSeeder() {
  const { addCourt, setItemQuantity } = useCart()

  return (
    <>
      <button type="button" onClick={() => addCourt(selection())}>
        seed court
      </button>
      <button type="button" onClick={() => setItemQuantity(item(), 2)}>
        seed items
      </button>
    </>
  )
}

function renderHeader() {
  return render(
    <CartProvider>
      <SiteHeader />
      <CartSeeder />
    </CartProvider>,
  )
}

afterEach(() => {
  window.localStorage.clear()
})

describe('SiteHeader', () => {
  it('exposes the header as a banner landmark', () => {
    renderHeader()

    expect(screen.getByRole('banner')).toBeInTheDocument()
  })

  it('points the brand mark at the storefront root', () => {
    renderHeader()

    expect(screen.getByRole('link', { name: /pickleball/i })).toHaveAttribute('href', '/')
  })

  it('links the catalog at the storefront root', () => {
    renderHeader()

    expect(screen.getByRole('link', { name: 'Courts' })).toHaveAttribute('href', '/')
  })

  it('describes an empty cart in words rather than showing a zero badge', () => {
    renderHeader()

    expect(screen.getByRole('status')).toHaveTextContent('Cart empty')
  })

  it('counts booked courts and add-on quantities together', async () => {
    const user = userEvent.setup()
    renderHeader()

    await user.click(screen.getByRole('button', { name: 'seed court' }))
    await user.click(screen.getByRole('button', { name: 'seed items' }))

    expect(screen.getByRole('status')).toHaveTextContent('Cart 3 items')
  })

  it('says "1 item" rather than "1 items" for a single selection', async () => {
    const user = userEvent.setup()
    renderHeader()

    await user.click(screen.getByRole('button', { name: 'seed court' }))

    expect(screen.getByRole('status')).toHaveTextContent('Cart 1 item')
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { SiteHeader } from './site-header'
import { CartProvider, useCart } from '@/features/cart/cart-provider'
import { resetCartSnapshot } from '@/features/cart/cart-store'
import type { CartCourtLine, CartItemLine } from '@/lib/domain/cart'

function selection(overrides: Partial<CartCourtLine> = {}): CartCourtLine {
  return {
    courtId: 'court-1',
    courtName: 'Court 1',
    startsAt: new Date('2026-08-10T02:00:00.000Z'),
    endsAt: new Date('2026-08-10T03:00:00.000Z'),
    priceCents: 90000,
    timeZone: 'Asia/Manila',
    currency: 'PHP',
    ...overrides,
  }
}

function item(overrides: Partial<CartItemLine> = {}): CartItemLine {
  return {
    productId: 'paddle-rental',
    name: 'Paddle rental',
    unitPriceCents: 15000,
    quantity: 1,
    currency: 'PHP',
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

/** The header's cart control, by the accessible name it carries in every state. */
function cartButton() {
  return screen.getByRole('button', { name: /^cart/i })
}

afterEach(() => {
  window.localStorage.clear()
  // The store caches its snapshot module-side; clearing storage alone would
  // leak one test's cart into the next.
  resetCartSnapshot()
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

    expect(cartButton()).toHaveAccessibleName('Cart empty')
  })

  it('counts booked courts and add-on quantities together', async () => {
    const user = userEvent.setup()
    renderHeader()

    await user.click(screen.getByRole('button', { name: 'seed court' }))
    await user.click(screen.getByRole('button', { name: 'seed items' }))

    expect(cartButton()).toHaveAccessibleName('Cart 3 items')
  })

  it('says "1 item" rather than "1 items" for a single selection', async () => {
    const user = userEvent.setup()
    renderHeader()

    await user.click(screen.getByRole('button', { name: 'seed court' }))

    expect(cartButton()).toHaveAccessibleName('Cart 1 item')
  })

  it('opens the cart drawer when the cart is pressed', async () => {
    const user = userEvent.setup()
    renderHeader()

    await user.click(cartButton())

    expect(screen.getByRole('dialog', { name: /your cart/i })).toBeInTheDocument()
  })

  it('shows what is in the cart once opened', async () => {
    const user = userEvent.setup()
    renderHeader()

    await user.click(screen.getByRole('button', { name: 'seed court' }))
    await user.click(cartButton())

    expect(screen.getByRole('dialog')).toHaveTextContent('Court 1')
  })

  it('keeps the drawer closed until the cart is pressed', () => {
    renderHeader()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(cartButton()).toHaveAttribute('aria-expanded', 'false')
  })

  it('reports the drawer as expanded while it is open', async () => {
    const user = userEvent.setup()
    renderHeader()

    await user.click(cartButton())

    expect(cartButton()).toHaveAttribute('aria-expanded', 'true')
  })

  it('returns focus to the cart button when the drawer closes', async () => {
    const user = userEvent.setup()
    renderHeader()

    await user.click(cartButton())
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(cartButton()).toHaveFocus()
  })
})

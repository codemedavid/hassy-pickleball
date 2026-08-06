import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CartProvider, useCart } from './cart-provider'
import { resetCartSnapshot, writeStoredCart } from './cart-store'

const COURT_A = {
  courtId: 'court-1',
  courtName: 'Court 1',
  startsAt: new Date('2026-03-01T02:00:00.000Z'),
  endsAt: new Date('2026-03-01T03:00:00.000Z'),
  priceCents: 60000,
  timeZone: 'Asia/Manila',
  currency: 'PHP',
}

/** Same court, overlapping window — the cart must refuse this. */
const COURT_A_OVERLAP = { ...COURT_A, startsAt: new Date('2026-03-01T02:30:00.000Z') }

/** Same window, different court — legitimate for a group booking. */
const COURT_B = { ...COURT_A, courtId: 'court-2' }

const PADDLE = {
  productId: 'product-1',
  name: 'Paddle',
  unitPriceCents: 20000,
  quantity: 1,
  currency: 'PHP',
}

function Harness() {
  const cart = useCart()

  return (
    <div>
      <output data-testid="courts">{cart.cart.courts.length}</output>
      <output data-testid="total">{cart.summary.totalCents}</output>
      <button type="button" onClick={() => cart.addCourt(COURT_A)}>
        add A
      </button>
      <button type="button" onClick={() => cart.addCourt(COURT_A_OVERLAP)}>
        add overlap
      </button>
      <button type="button" onClick={() => cart.addCourt(COURT_B)}>
        add B
      </button>
      <button type="button" onClick={() => cart.removeCourt('court-1', COURT_A.startsAt)}>
        remove A
      </button>
      <button type="button" onClick={() => cart.setItemQuantity(PADDLE, 3)}>
        set paddle 3
      </button>
      <button type="button" onClick={() => cart.clear()}>
        clear
      </button>
    </div>
  )
}

function renderCart() {
  return render(
    <CartProvider>
      <Harness />
    </CartProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
  // The store caches its snapshot for referential stability; drop it so each
  // test starts from storage rather than the previous test's cart.
  resetCartSnapshot()
})

describe('CartProvider', () => {
  it('starts empty when nothing was stored', () => {
    renderCart()

    expect(screen.getByTestId('courts')).toHaveTextContent('0')
  })

  it('rehydrates a cart left over from a previous visit', () => {
    writeStoredCart({ courts: [COURT_A], items: [] })

    renderCart()

    expect(screen.getByTestId('courts')).toHaveTextContent('1')
  })

  it('adds a court and reflects it in the total', async () => {
    renderCart()

    await userEvent.click(screen.getByText('add A'))

    expect(screen.getByTestId('courts')).toHaveTextContent('1')
    expect(screen.getByTestId('total')).toHaveTextContent('60000')
  })

  it('refuses a second segment that overlaps the same court', async () => {
    renderCart()

    await userEvent.click(screen.getByText('add A'))
    await userEvent.click(screen.getByText('add overlap'))

    expect(screen.getByTestId('courts')).toHaveTextContent('1')
  })

  it('allows the same window on a different court, which is a group booking', async () => {
    renderCart()

    await userEvent.click(screen.getByText('add A'))
    await userEvent.click(screen.getByText('add B'))

    expect(screen.getByTestId('courts')).toHaveTextContent('2')
  })

  it('removes a court segment', async () => {
    renderCart()

    await userEvent.click(screen.getByText('add A'))
    await userEvent.click(screen.getByText('remove A'))

    expect(screen.getByTestId('courts')).toHaveTextContent('0')
  })

  it('includes café items in the total', async () => {
    renderCart()

    await userEvent.click(screen.getByText('set paddle 3'))

    expect(screen.getByTestId('total')).toHaveTextContent('60000')
  })

  it('persists across a remount, so a reload does not lose the cart', async () => {
    const { unmount } = renderCart()

    await userEvent.click(screen.getByText('add A'))
    unmount()
    // A real reload loses the module-level cache, so drop it here too —
    // otherwise this passes off the cache even if persistence is broken.
    resetCartSnapshot()
    renderCart()

    expect(screen.getByTestId('courts')).toHaveTextContent('1')
  })

  it('clears both courts and items', async () => {
    renderCart()

    await userEvent.click(screen.getByText('add A'))
    await userEvent.click(screen.getByText('set paddle 3'))
    await userEvent.click(screen.getByText('clear'))

    expect(screen.getByTestId('total')).toHaveTextContent('0')
  })
})

describe('useCart outside a provider', () => {
  it('throws a named error instead of silently returning undefined', () => {
    expect(() => render(<Harness />)).toThrow(/CartProvider/)
  })
})

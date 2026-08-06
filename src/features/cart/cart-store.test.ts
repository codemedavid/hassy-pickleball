import { beforeEach, describe, expect, it } from 'vitest'
import { EMPTY_CART, readStoredCart, writeStoredCart } from './cart-store'

/**
 * The cart lives in the browser until checkout — there is no server-side cart.
 * Persisting it means surviving a reload, which means serialising Dates and
 * surviving whatever else is already in localStorage.
 */

const CART = {
  courts: [
    {
      courtId: 'court-1',
      courtName: 'Court 1',
      startsAt: new Date('2026-03-01T02:00:00.000Z'),
      endsAt: new Date('2026-03-01T03:00:00.000Z'),
      priceCents: 60000,
      timeZone: 'Asia/Manila',
      currency: 'PHP',
    },
  ],
  items: [
    {
      productId: 'product-1',
      name: 'Paddle',
      unitPriceCents: 20000,
      quantity: 2,
      currency: 'PHP',
    },
  ],
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('readStoredCart', () => {
  it('returns an empty cart when nothing has been stored', () => {
    expect(readStoredCart()).toEqual(EMPTY_CART)
  })

  it('restores court times as Date objects, not strings', () => {
    writeStoredCart(CART)

    const restored = readStoredCart()

    expect(restored.courts[0]?.startsAt).toBeInstanceOf(Date)
    expect(restored.courts[0]?.startsAt.toISOString()).toBe('2026-03-01T02:00:00.000Z')
  })

  it('restores café items with their quantities', () => {
    writeStoredCart(CART)

    expect(readStoredCart().items[0]).toMatchObject({ productId: 'product-1', quantity: 2 })
  })

  it('falls back to an empty cart when the stored value is not JSON', () => {
    window.localStorage.setItem('pickleball.cart.v1', 'not json{')

    expect(readStoredCart()).toEqual(EMPTY_CART)
  })

  it('falls back to an empty cart when the stored shape is wrong', () => {
    window.localStorage.setItem('pickleball.cart.v1', JSON.stringify({ courts: 'nope' }))

    expect(readStoredCart()).toEqual(EMPTY_CART)
  })

  it('restores the display context a court line was added with', () => {
    writeStoredCart(CART)

    expect(readStoredCart().courts[0]).toMatchObject({
      courtName: 'Court 1',
      timeZone: 'Asia/Manila',
      currency: 'PHP',
    })
  })

  it('drops a court line stored before names were kept, rather than rendering a nameless row', () => {
    window.localStorage.setItem(
      'pickleball.cart.v1',
      JSON.stringify({
        courts: [
          {
            courtId: 'court-1',
            startsAt: '2026-03-01T02:00:00.000Z',
            endsAt: '2026-03-01T03:00:00.000Z',
            priceCents: 60000,
          },
        ],
        items: [],
      }),
    )

    expect(readStoredCart().courts).toEqual([])
  })

  it('drops an add-on line with no currency, which would price in the wrong symbol', () => {
    window.localStorage.setItem(
      'pickleball.cart.v1',
      JSON.stringify({
        courts: [],
        items: [{ productId: 'product-1', name: 'Paddle', unitPriceCents: 20000, quantity: 2 }],
      }),
    )

    expect(readStoredCart().items).toEqual([])
  })

  it('drops a stored segment whose timestamps are unparseable rather than yielding Invalid Date', () => {
    window.localStorage.setItem(
      'pickleball.cart.v1',
      JSON.stringify({
        courts: [
          {
            courtId: 'court-1',
            courtName: 'Court 1',
            startsAt: 'yesterday',
            endsAt: 'x',
            priceCents: 1,
            timeZone: 'Asia/Manila',
            currency: 'PHP',
          },
        ],
        items: [],
      }),
    )

    expect(readStoredCart().courts).toEqual([])
  })
})

describe('writeStoredCart', () => {
  it('round-trips a cart without mutating the input', () => {
    const original = structuredClone(CART)

    writeStoredCart(CART)

    expect(CART).toEqual(original)
  })

  it('overwrites a previously stored cart rather than appending to it', () => {
    writeStoredCart(CART)
    writeStoredCart(EMPTY_CART)

    expect(readStoredCart()).toEqual(EMPTY_CART)
  })
})

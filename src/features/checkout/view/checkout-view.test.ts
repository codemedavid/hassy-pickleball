import { describe, expect, it } from 'vitest'
import { buildCheckoutOrder, buildOrderSummary } from './checkout-view'
import type { Cart } from '@/lib/domain/cart'

const CLUB_ID = '00000000-0000-4000-8000-000000000001'
const METHOD_ID = '00000000-0000-4000-8000-000000000002'

const CART: Cart = {
  courts: [
    {
      courtId: 'court-1',
      courtName: 'Court 3',
      startsAt: new Date('2026-08-08T06:00:00.000Z'),
      endsAt: new Date('2026-08-08T07:00:00.000Z'),
      priceCents: 60000,
      timeZone: 'Asia/Manila',
      currency: 'PHP',
    },
  ],
  items: [
    {
      productId: 'gatorade',
      name: 'Gatorade',
      unitPriceCents: 9000,
      quantity: 2,
      currency: 'PHP',
    },
  ],
}

const CONTACT = {
  contactName: 'Ana Cruz',
  contactEmail: 'ana@example.com',
  contactPhone: '0917 123 4567',
  notes: '',
}

describe('buildOrderSummary', () => {
  it('lists each court with its club-local window', () => {
    const summary = buildOrderSummary(CART, 'PHP')

    expect(summary.courtLines[0]).toMatchObject({
      name: 'Court 3',
      price: expect.stringContaining('600'),
    })
    expect(summary.courtLines[0]?.window).toMatch(/2:00/)
  })

  it('shows an add-on line at its extended price, not its unit price', () => {
    const summary = buildOrderSummary(CART, 'PHP')

    expect(summary.itemLines[0]).toMatchObject({ name: 'Gatorade', quantity: 2 })
    expect(summary.itemLines[0]?.price).toContain('180')
  })

  it('totals courts and add-ons together', () => {
    expect(buildOrderSummary(CART, 'PHP').total).toContain('780')
  })

  it('reports an empty cart as empty rather than as a zero-peso order', () => {
    const summary = buildOrderSummary({ courts: [], items: [] }, 'PHP')

    expect(summary.isEmpty).toBe(true)
  })
})

describe('buildCheckoutOrder', () => {
  it('sends court windows as ISO instants, so the server re-prices from real times', () => {
    const order = buildCheckoutOrder({
      clubId: CLUB_ID,
      cart: CART,
      contact: CONTACT,
      paymentMethodId: METHOD_ID,
    })

    expect(order.courts).toEqual([
      {
        courtId: 'court-1',
        startsAt: '2026-08-08T06:00:00.000Z',
        endsAt: '2026-08-08T07:00:00.000Z',
      },
    ])
  })

  it('never sends a price — the server quotes every line itself', () => {
    const order = buildCheckoutOrder({
      clubId: CLUB_ID,
      cart: CART,
      contact: CONTACT,
      paymentMethodId: METHOD_ID,
    })

    expect(order.courts[0]).not.toHaveProperty('priceCents')
    expect(order.items[0]).not.toHaveProperty('unitPriceCents')
    expect(order.items).toEqual([{ productId: 'gatorade', quantity: 2 }])
  })

  it('carries the contact details and the chosen method', () => {
    const order = buildCheckoutOrder({
      clubId: CLUB_ID,
      cart: CART,
      contact: CONTACT,
      paymentMethodId: METHOD_ID,
    })

    expect(order).toMatchObject({
      clubId: CLUB_ID,
      contactName: 'Ana Cruz',
      contactEmail: 'ana@example.com',
      contactPhone: '0917 123 4567',
      paymentMethodId: METHOD_ID,
    })
  })

  it('sends a blank note as null rather than an empty string', () => {
    const order = buildCheckoutOrder({
      clubId: CLUB_ID,
      cart: CART,
      contact: { ...CONTACT, notes: '   ' },
      paymentMethodId: METHOD_ID,
    })

    expect(order.notes).toBeNull()
  })
})

const BAND = {
  minPlayers: 2,
  includedPlayers: 4,
  maxPlayers: 6,
  extraPlayerFeeCents: 15_000,
}

describe('buildOrderSummary with a party', () => {
  it('adds no line when the party fits what the price already covers', () => {
    const summary = buildOrderSummary(CART, 'PHP', { partySize: 4, band: BAND })

    expect(summary.extraPlayersLine).toBeNull()
    expect(summary.total).toContain('780')
  })

  it('charges each head beyond the included count on its own line', () => {
    const summary = buildOrderSummary(CART, 'PHP', { partySize: 6, band: BAND })

    expect(summary.extraPlayersLine).toMatchObject({ quantity: 2 })
    expect(summary.extraPlayersLine?.price).toContain('300')
  })

  it('adds the extra-player charge to the total the guest is shown', () => {
    // 600 court + 180 add-ons + 300 for two extra heads.
    const summary = buildOrderSummary(CART, 'PHP', { partySize: 6, band: BAND })

    expect(summary.total).toContain('1,080')
    expect(summary.totalCents).toBe(108_000)
  })

  it('leaves the total alone when no party has been given yet', () => {
    expect(buildOrderSummary(CART, 'PHP').totalCents).toBe(78_000)
  })
})

describe('buildCheckoutOrder with players', () => {
  it('sends the players the booker named, in the order they entered them', () => {
    const order = buildCheckoutOrder({
      clubId: CLUB_ID,
      cart: CART,
      contact: CONTACT,
      paymentMethodId: METHOD_ID,
      players: ['Ana Cruz', 'Ben Uy', 'Cara Lim'],
    })

    expect(order.players).toEqual(['Ana Cruz', 'Ben Uy', 'Cara Lim'])
  })

  it('trims the names, because a trailing space is not a different player', () => {
    const order = buildCheckoutOrder({
      clubId: CLUB_ID,
      cart: CART,
      contact: CONTACT,
      paymentMethodId: METHOD_ID,
      players: ['  Ana Cruz ', 'Ben Uy'],
    })

    expect(order.players).toEqual(['Ana Cruz', 'Ben Uy'])
  })

  it('drops rows the booker left blank rather than sending an unnamed player', () => {
    const order = buildCheckoutOrder({
      clubId: CLUB_ID,
      cart: CART,
      contact: CONTACT,
      paymentMethodId: METHOD_ID,
      players: ['Ana Cruz', '   ', 'Ben Uy'],
    })

    expect(order.players).toEqual(['Ana Cruz', 'Ben Uy'])
  })

  it('still carries no prices — the party size is a count, not a charge', () => {
    const order = buildCheckoutOrder({
      clubId: CLUB_ID,
      cart: CART,
      contact: CONTACT,
      paymentMethodId: METHOD_ID,
      players: ['Ana Cruz', 'Ben Uy', 'Cara Lim', 'Dee Ng', 'Elle Sy', 'Fay Ко'],
    })

    expect(JSON.stringify(order)).not.toContain('15000')
    expect(JSON.stringify(order)).not.toContain('Cents')
  })
})

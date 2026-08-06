import { describe, expect, it } from 'vitest'
import { buildBookingQuote } from './booking-quote'

/**
 * The "Your booking" sidebar. The design shows a court line, one line per
 * chosen add-on, a discount line, and a total.
 *
 * The court price arriving here is already quoted by `quoteCourtSegment`, so
 * this module never re-prices a court — it only explains the number and adds
 * the extras on top.
 */

const CURRENCY = 'PHP'

const addon = (
  overrides: Partial<Parameters<typeof buildBookingQuote>[0]['addons'][number]> = {},
) => ({
  productId: 'p-1',
  name: 'Paddle rental',
  unitPriceCents: 20000,
  quantity: 1,
  ...overrides,
})

describe('buildBookingQuote', () => {
  it('opens with the court, its session length, and the quoted price', () => {
    // Arrange / Act
    const quote = buildBookingQuote({
      courtName: 'Harbor Court',
      durationMinutes: 90,
      courtPriceCents: 90000,
      discountCents: 0,
      addons: [],
      currency: CURRENCY,
    })

    // Assert
    expect(quote.lines[0]).toEqual({ label: 'Harbor Court · 1 hr 30 min', value: '₱900' })
  })

  it('adds one line per chosen add-on', () => {
    // Arrange / Act
    const quote = buildBookingQuote({
      courtName: 'Harbor Court',
      durationMinutes: 60,
      courtPriceCents: 60000,
      discountCents: 0,
      addons: [addon(), addon({ productId: 'p-2', name: 'Ball machine', unitPriceCents: 15000 })],
      currency: CURRENCY,
    })

    // Assert
    expect(quote.lines.slice(1)).toEqual([
      { label: 'Paddle rental', value: '₱200' },
      { label: 'Ball machine', value: '₱150' },
    ])
  })

  it('spells out the quantity and charges for every unit of a multi-quantity add-on', () => {
    // Arrange — the design writes "Extra players × 2" and charges twice.
    const quote = buildBookingQuote({
      courtName: 'Harbor Court',
      durationMinutes: 60,
      courtPriceCents: 60000,
      discountCents: 0,
      addons: [addon({ name: 'Extra players', unitPriceCents: 4000, quantity: 2 })],
      currency: CURRENCY,
    })

    // Assert
    expect(quote.lines[1]).toEqual({ label: 'Extra players × 2', value: '₱80' })
    expect(quote.totalCents).toBe(68000)
  })

  it('omits add-ons the customer has not chosen', () => {
    // Arrange / Act
    const quote = buildBookingQuote({
      courtName: 'Harbor Court',
      durationMinutes: 60,
      courtPriceCents: 60000,
      discountCents: 0,
      addons: [addon({ quantity: 0 })],
      currency: CURRENCY,
    })

    // Assert
    expect(quote.lines).toHaveLength(1)
    expect(quote.totalCents).toBe(60000)
  })

  it('shows a discount as a signed deduction and takes it off the total', () => {
    // Arrange — a tier rule already applied by the pricing pipeline.
    const quote = buildBookingQuote({
      courtName: 'Harbor Court',
      durationMinutes: 60,
      courtPriceCents: 60000,
      discountCents: 6000,
      discountLabel: 'Member discount',
      addons: [],
      currency: CURRENCY,
    })

    // Assert
    expect(quote.lines.at(-1)).toEqual({ label: 'Member discount', value: '−₱60' })
    expect(quote.totalCents).toBe(54000)
  })

  it('leaves out the discount line entirely when nothing was discounted', () => {
    // Arrange — an anonymous visitor gets no tier pricing, so claiming a
    // "member discount" of zero would be misleading.
    const quote = buildBookingQuote({
      courtName: 'Harbor Court',
      durationMinutes: 60,
      courtPriceCents: 60000,
      discountCents: 0,
      addons: [],
      currency: CURRENCY,
    })

    // Assert
    expect(quote.lines.some((line) => line.label.includes('discount'))).toBe(false)
  })

  it('totals the court, the extras, and the discount together', () => {
    // Arrange / Act
    const quote = buildBookingQuote({
      courtName: 'Harbor Court',
      durationMinutes: 90,
      courtPriceCents: 90000,
      discountCents: 9000,
      discountLabel: 'Member discount',
      addons: [addon({ unitPriceCents: 20000, quantity: 2 })],
      currency: CURRENCY,
    })

    // Assert — 900 court + 400 extras − 90 discount.
    expect(quote.totalCents).toBe(121000)
    expect(quote.total).toBe('₱1,210')
  })

  it('reports no total to charge when no start time has been picked yet', () => {
    // Arrange — the sidebar renders before a slot is chosen.
    const quote = buildBookingQuote({
      courtName: 'Harbor Court',
      durationMinutes: 60,
      courtPriceCents: null,
      discountCents: 0,
      addons: [addon()],
      currency: CURRENCY,
    })

    // Assert — extras alone are not a bookable session, so there is no court line.
    expect(quote.lines[0]?.label).not.toContain('Harbor Court')
    expect(quote.totalCents).toBe(20000)
    expect(quote.hasCourt).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { BLANK_PRODUCT_FORM, toFormState, toProductPayload } from './product-form'
import { makeProduct } from '../../../../test/admin-fixtures'

const PRODUCT_ID = '77777777-7777-4777-7777-777777777777'

const paddle = makeProduct({
  id: PRODUCT_ID,
  name: 'Paddle rental',
  description: 'Loaner paddle for the session',
  type: 'addon',
  priceCents: 10_000,
  hasQuantity: true,
  imageUrl: 'https://ik.imagekit.io/test/paddle.png',
  sortOrder: 3,
})

describe('toFormState', () => {
  it('fills every field from the product being edited', () => {
    // Act
    const state = toFormState(paddle)

    // Assert
    expect(state.name).toBe('Paddle rental')
    expect(state.description).toBe('Loaner paddle for the session')
    expect(state.type).toBe('addon')
    expect(state.hasQuantity).toBe(true)
    expect(state.imageUrl).toBe('https://ik.imagekit.io/test/paddle.png')
    expect(state.sortOrder).toBe('3')
  })

  it('shows the price in major units, because that is how staff think about it', () => {
    // Arrange — the row stores 10000 centavos.
    // Act & Assert — the field shows 100, not 10000.
    expect(toFormState(paddle).price).toBe('100')
  })

  it('keeps centavos on a price that has them', () => {
    const odd = makeProduct({ id: PRODUCT_ID, priceCents: 10_050 })

    expect(toFormState(odd).price).toBe('100.50')
  })

  it('renders a missing description as an empty field rather than the string "null"', () => {
    const bare = makeProduct({ id: PRODUCT_ID, description: null })

    expect(toFormState(bare).description).toBe('')
  })

  it('starts blank for a product that does not exist yet', () => {
    expect(toFormState(null)).toEqual(BLANK_PRODUCT_FORM)
  })

  it('starts a new product with no image, since nothing has been uploaded for it', () => {
    expect(BLANK_PRODUCT_FORM.imageUrl).toBeNull()
  })
})

describe('toProductPayload', () => {
  it('converts the price to cents, which is what the schema takes', () => {
    const state = { ...BLANK_PRODUCT_FORM, name: 'Flat white', price: '150' }

    expect(toProductPayload(state).priceCents).toBe(15_000)
  })

  it('carries the centavos on a fractional price rather than truncating them', () => {
    const state = { ...BLANK_PRODUCT_FORM, name: 'Flat white', price: '150.50' }

    expect(toProductPayload(state).priceCents).toBe(15_050)
  })

  it('trims the text fields, so trailing spaces never reach the catalog', () => {
    const state = {
      ...BLANK_PRODUCT_FORM,
      name: '  Paddle rental  ',
      description: '  Loaner paddle  ',
    }

    const payload = toProductPayload(state)

    expect(payload.name).toBe('Paddle rental')
    expect(payload.description).toBe('Loaner paddle')
  })

  it('sends a blank description as null, not an empty string', () => {
    const state = { ...BLANK_PRODUCT_FORM, name: 'Flat white', description: '   ' }

    expect(toProductPayload(state).description).toBeNull()
  })

  it('creates rather than patches when given no id', () => {
    const payload = toProductPayload({ ...BLANK_PRODUCT_FORM, name: 'Flat white' })

    expect(payload).not.toHaveProperty('id')
  })

  it('patches the product it was opened for when given its id', () => {
    const payload = toProductPayload({ ...BLANK_PRODUCT_FORM, name: 'Flat white' }, PRODUCT_ID)

    expect(payload.id).toBe(PRODUCT_ID)
  })

  it('carries the uploaded image URL through to the row', () => {
    const state = { ...BLANK_PRODUCT_FORM, imageUrl: 'https://ik.imagekit.io/test/paddle.png' }

    expect(toProductPayload(state).imageUrl).toBe('https://ik.imagekit.io/test/paddle.png')
  })

  it('leaves an unparseable price as NaN, so the schema refuses it', () => {
    // Defaulting to zero would quietly publish a free product, which is worse
    // than a rejected save.
    const state = { ...BLANK_PRODUCT_FORM, name: 'Flat white', price: 'free' }

    expect(toProductPayload(state).priceCents).toBeNaN()
  })

  it('round-trips a product through form state and back without changing it', () => {
    const payload = toProductPayload(toFormState(paddle), paddle.id)

    expect(payload).toEqual({
      id: PRODUCT_ID,
      name: 'Paddle rental',
      description: 'Loaner paddle for the session',
      type: 'addon',
      priceCents: 10_000,
      hasQuantity: true,
      imageUrl: 'https://ik.imagekit.io/test/paddle.png',
      sortOrder: 3,
    })
  })
})

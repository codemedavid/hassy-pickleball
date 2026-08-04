import { describe, expect, it } from 'vitest'
import { callsFor, fakeClient, fakeTable } from '../../../test/postgrest-fake'
import { createProduct, listActiveProducts, listAllProducts, updateProduct } from './products'

const PRODUCT_ROW = {
  id: 'product-1',
  club_id: 'club-1',
  name: 'Paddle rental',
  description: 'Per session',
  type: 'addon' as const,
  price_cents: 20000,
  has_quantity: true,
  image_url: null,
  sort_order: 1,
  is_active: true,
}

describe('listActiveProducts', () => {
  it('hides deactivated products from the customer shop', async () => {
    const products = fakeTable({ data: [], error: null })

    await listActiveProducts(fakeClient({ products }), 'club-1')

    expect(products.calls).toContainEqual({ method: 'eq', args: ['is_active', true] })
  })

  it('throws with context when the query errors', async () => {
    const client = fakeClient({ products: fakeTable({ data: null, error: { message: 'x' } }) })

    await expect(listActiveProducts(client, 'club-1')).rejects.toThrow(/Failed to load products/)
  })
})

describe('listAllProducts', () => {
  it('includes deactivated products, because the admin editor must show them', async () => {
    const products = fakeTable({ data: [PRODUCT_ROW], error: null })

    await listAllProducts(fakeClient({ products }), 'club-1')

    expect(products.calls).not.toContainEqual({ method: 'eq', args: ['is_active', true] })
  })
})

describe('createProduct', () => {
  it('writes the product against the club with snake_case columns', async () => {
    const products = fakeTable({ data: PRODUCT_ROW, error: null })

    await createProduct(fakeClient({ products }), {
      clubId: 'club-1',
      name: 'Paddle rental',
      description: 'Per session',
      type: 'addon',
      priceCents: 20000,
      hasQuantity: true,
      imageUrl: null,
      sortOrder: 1,
    })

    expect(callsFor(products, 'insert')[0]?.args[0]).toMatchObject({
      club_id: 'club-1',
      name: 'Paddle rental',
      type: 'addon',
      price_cents: 20000,
      has_quantity: true,
      sort_order: 1,
    })
  })

  it('throws with context when the insert is rejected', async () => {
    const client = fakeClient({ products: fakeTable({ data: null, error: { message: 'denied' } }) })

    await expect(
      createProduct(client, {
        clubId: 'club-1',
        name: 'x',
        description: null,
        type: 'cafe',
        priceCents: 1,
        hasQuantity: false,
        imageUrl: null,
        sortOrder: 0,
      }),
    ).rejects.toThrow(/Failed to create product: denied/)
  })
})

describe('updateProduct', () => {
  it('sends only the fields that were supplied, leaving the rest untouched', async () => {
    const products = fakeTable({ data: PRODUCT_ROW, error: null })

    await updateProduct(fakeClient({ products }), 'product-1', { priceCents: 25000 })

    expect(callsFor(products, 'update')[0]?.args[0]).toEqual({ price_cents: 25000 })
    expect(products.calls).toContainEqual({ method: 'eq', args: ['id', 'product-1'] })
  })

  it('archives a product by deactivating it rather than deleting history', async () => {
    const products = fakeTable({ data: { ...PRODUCT_ROW, is_active: false }, error: null })

    await updateProduct(fakeClient({ products }), 'product-1', { isActive: false })

    expect(callsFor(products, 'update')[0]?.args[0]).toEqual({ is_active: false })
  })

  it('rejects an empty patch instead of issuing a no-op write', async () => {
    const client = fakeClient({ products: fakeTable({ data: PRODUCT_ROW, error: null }) })

    await expect(updateProduct(client, 'product-1', {})).rejects.toThrow(/nothing to update/i)
  })

  it('throws with context when the update is rejected', async () => {
    const client = fakeClient({ products: fakeTable({ data: null, error: { message: 'nope' } }) })

    await expect(updateProduct(client, 'product-1', { priceCents: 1 })).rejects.toThrow(
      /Failed to update product: nope/,
    )
  })
})

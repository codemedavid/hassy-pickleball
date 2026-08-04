import 'server-only'

import { toProduct, type Product } from './mappers'
import { raise, RepositoryError, type Client } from './support'
import type { ProductType, Tables } from './rows'

type ProductUpdate = Tables['products']['Update']

/** Session add-ons and café items: customer reads plus the admin editor's writes. */

export type CreateProductInput = {
  readonly clubId: string
  readonly name: string
  readonly description: string | null
  readonly type: ProductType
  readonly priceCents: number
  readonly hasQuantity: boolean
  readonly imageUrl: string | null
  readonly sortOrder: number
}

/** Every field optional: the editor patches what changed and nothing else. */
export type ProductPatch = {
  readonly name?: string
  readonly description?: string | null
  readonly type?: ProductType
  readonly priceCents?: number
  readonly hasQuantity?: boolean
  readonly imageUrl?: string | null
  readonly sortOrder?: number
  readonly isActive?: boolean
}

export async function listActiveProducts(client: Client, clubId: string): Promise<Product[]> {
  const { data, error } = await client
    .from('products')
    .select('*')
    .eq('club_id', clubId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  raise('Failed to load products', error)

  return (data ?? []).map(toProduct)
}

/** The admin editor needs archived rows too, so it can bring one back. */
export async function listAllProducts(client: Client, clubId: string): Promise<Product[]> {
  const { data, error } = await client
    .from('products')
    .select('*')
    .eq('club_id', clubId)
    .order('sort_order', { ascending: true })

  raise('Failed to load products', error)

  return (data ?? []).map(toProduct)
}

export async function createProduct(client: Client, input: CreateProductInput): Promise<Product> {
  const { data, error } = await client
    .from('products')
    .insert({
      club_id: input.clubId,
      name: input.name,
      description: input.description,
      type: input.type,
      price_cents: input.priceCents,
      has_quantity: input.hasQuantity,
      image_url: input.imageUrl,
      sort_order: input.sortOrder,
    })
    .select('*')
    .single()

  raise('Failed to create product', error)

  return toProduct(data as NonNullable<typeof data>)
}

function toProductRowPatch(patch: ProductPatch): ProductUpdate {
  const columns: ProductUpdate = {}

  if (patch.name !== undefined) columns.name = patch.name
  if (patch.description !== undefined) columns.description = patch.description
  if (patch.type !== undefined) columns.type = patch.type
  if (patch.priceCents !== undefined) columns.price_cents = patch.priceCents
  if (patch.hasQuantity !== undefined) columns.has_quantity = patch.hasQuantity
  if (patch.imageUrl !== undefined) columns.image_url = patch.imageUrl
  if (patch.sortOrder !== undefined) columns.sort_order = patch.sortOrder
  if (patch.isActive !== undefined) columns.is_active = patch.isActive

  return columns
}

/**
 * Products are archived (`isActive: false`), never deleted — booking_items
 * reference them, and historical bookings must keep resolving.
 */
export async function updateProduct(
  client: Client,
  productId: string,
  patch: ProductPatch,
): Promise<Product> {
  const columns = toProductRowPatch(patch)

  if (Object.keys(columns).length === 0) {
    throw new RepositoryError('Nothing to update on this product')
  }

  const { data, error } = await client
    .from('products')
    .update(columns)
    .eq('id', productId)
    .select('*')
    .single()

  raise('Failed to update product', error)

  return toProduct(data as NonNullable<typeof data>)
}

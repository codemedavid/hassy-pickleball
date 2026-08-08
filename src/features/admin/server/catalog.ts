import 'server-only'

import { createProductSchema, productPatchSchema } from '@/lib/api/admin-schemas'
import { invalid, withStaff } from './session'
import { createProduct, updateProduct } from '@/lib/repositories/products'
import type { Product } from '@/lib/repositories/mappers'
import type { Result } from '@/lib/api/result'

/**
 * The product editor.
 *
 * Create or patch is decided by the presence of an id, because the editor
 * screen is the same form either way.
 *
 * `clubId` is never read from the request. It comes from the staff session, so
 * a staff member of one club cannot create rows under another — a filter the
 * caller controls would be no boundary at all.
 */

function hasId(input: unknown): boolean {
  return typeof input === 'object' && input !== null && 'id' in input
}

/** Zod drops keys that were not supplied, so a patch carries only real edits. */
function withoutId<T extends { id: string }>(parsed: T): Omit<T, 'id'> {
  const entries = Object.entries(parsed).filter(([key]) => key !== 'id')

  return Object.fromEntries(entries) as Omit<T, 'id'>
}

export async function saveProduct(input: unknown): Promise<Result<Product>> {
  if (hasId(input)) {
    const parsed = productPatchSchema.safeParse(input)

    if (!parsed.success) {
      return invalid('Check the product details')
    }

    const patch = withoutId(parsed.data)

    return withStaff(({ client }) => updateProduct(client, parsed.data.id, patch))
  }

  const parsed = createProductSchema.safeParse(input)

  if (!parsed.success) {
    return invalid('Check the product details')
  }

  return withStaff(({ staff, client }) =>
    createProduct(client, {
      clubId: staff.clubId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      type: parsed.data.type,
      priceCents: parsed.data.priceCents,
      hasQuantity: parsed.data.hasQuantity,
      imageUrl: parsed.data.imageUrl ?? null,
      sortOrder: parsed.data.sortOrder,
    }),
  )
}

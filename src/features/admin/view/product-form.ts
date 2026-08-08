import { toCents, toInteger, toMajorUnits } from './money-fields'
import type { Product } from '@/lib/repositories/mappers'
import type { ProductType } from '@/lib/repositories/rows'

/**
 * The product editor's form state, and its translation to and from a product row.
 *
 * Every field is held as the string the input actually carries, matching
 * ./court-form: a half-typed price is "1", not a number, and forcing it through
 * `number` mid-edit fights the staff member's cursor. Conversion happens once,
 * on submit.
 *
 * Kept out of the component so the mapping is testable without a DOM.
 */

export type ProductFormState = {
  readonly name: string
  readonly description: string
  readonly type: ProductType
  /** Major units, as shown to staff. ₱100, not 10000. */
  readonly price: string
  /** Whether the guest picks a count, rather than the item being one-per-booking. */
  readonly hasQuantity: boolean
  readonly imageUrl: string | null
  readonly sortOrder: string
}

/** An add-on the guest picks a count of is the common case, so a new product starts there. */
export const BLANK_PRODUCT_FORM: ProductFormState = {
  name: '',
  description: '',
  type: 'addon',
  price: '',
  hasQuantity: true,
  imageUrl: null,
  sortOrder: '0',
}

export function toFormState(product: Product | null): ProductFormState {
  if (!product) {
    return BLANK_PRODUCT_FORM
  }

  return {
    name: product.name,
    description: product.description ?? '',
    type: product.type,
    price: toMajorUnits(product.priceCents),
    hasQuantity: product.hasQuantity,
    imageUrl: product.imageUrl,
    sortOrder: String(product.sortOrder),
  }
}

export type ProductPayload = {
  readonly id?: string
  readonly name: string
  readonly description: string | null
  readonly type: ProductType
  readonly priceCents: number
  readonly hasQuantity: boolean
  readonly imageUrl: string | null
  readonly sortOrder: number
}

/**
 * Form state as the save action expects it.
 *
 * `productId` decides create versus patch, matching saveProduct, which keys off
 * the presence of an id. A price that failed to parse is left as NaN rather
 * than defaulted to zero — the schema must refuse it, not quietly publish a
 * free product.
 */
export function toProductPayload(state: ProductFormState, productId?: string): ProductPayload {
  const fields = {
    name: state.name.trim(),
    description: state.description.trim() || null,
    type: state.type,
    priceCents: toCents(state.price),
    hasQuantity: state.hasQuantity,
    imageUrl: state.imageUrl,
    sortOrder: toInteger(state.sortOrder),
  }

  return productId === undefined ? fields : { id: productId, ...fields }
}

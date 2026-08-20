import 'server-only'

import {
  createPaymentMethodSchema,
  movePaymentMethodSchema,
  paymentMethodPatchSchema,
  publishedPaymentMethodSchema,
} from '@/lib/api/admin-schemas'
import { invalid, withStaff } from './session'
import { ok, type Result } from '@/lib/api/result'
import {
  createPaymentMethod,
  findPaymentMethod,
  listAllPaymentMethods,
  movePaymentMethod,
  setPaymentMethodActive,
  updatePaymentMethod,
} from '@/lib/repositories/payment-methods'
import type { PaymentMethod } from '@/lib/repositories/mappers'

export type MovedPaymentMethod = {
  readonly id: string
  readonly direction: 'up' | 'down'
}

function hasId(input: unknown): boolean {
  return typeof input === 'object' && input !== null && 'id' in input
}

function flatten<T>(outer: Result<Result<T>>): Result<T> {
  return outer.success ? outer.data : outer
}

export async function savePaymentMethod(input: unknown): Promise<Result<PaymentMethod>> {
  if (!hasId(input)) {
    const parsed = createPaymentMethodSchema.safeParse(input)

    if (!parsed.success) return invalid('Check the payment method details')

    return withStaff(async ({ staff, client }) => {
      const methods = await listAllPaymentMethods(client, staff.clubId)
      const sortOrder =
        methods.reduce((highest, method) => Math.max(highest, method.sortOrder), 0) + 1

      return createPaymentMethod(client, {
        clubId: staff.clubId,
        ...parsed.data,
        accountName: parsed.data.accountName ?? null,
        accountNumber: parsed.data.accountNumber ?? null,
        instructions: parsed.data.instructions ?? null,
        qrImageUrl: parsed.data.qrImageUrl ?? null,
        sortOrder,
      })
    })
  }

  const parsed = paymentMethodPatchSchema.safeParse(input)

  if (!parsed.success) return invalid('Check the payment method details')

  return withStaff(async ({ staff, client }) => {
    const current = await findPaymentMethod(client, staff.clubId, parsed.data.id)

    if (!current) return invalid('That payment method is no longer available')

    const { id, acknowledgeCheckoutPause, ...patch } = parsed.data
    const merged = publishedPaymentMethodSchema.safeParse({ ...current, ...patch })

    if (!merged.success) return invalid('Add account details, payment instructions, or a QR image')

    if (patch.isActive === false && current.isActive && !acknowledgeCheckoutPause) {
      const methods = await listAllPaymentMethods(client, staff.clubId)
      const activeCount = methods.filter((method) => method.isActive).length

      if (activeCount <= 1) {
        return invalid('Confirm that hiding this method will pause online checkout')
      }
    }

    const { isActive, ...ordinaryPatch } = patch
    let saved = current

    if (Object.keys(ordinaryPatch).length > 0) {
      saved = await updatePaymentMethod(client, id, ordinaryPatch)
    }

    if (isActive !== undefined) {
      saved = await setPaymentMethodActive(client, id, isActive, acknowledgeCheckoutPause ?? false)
    }

    return ok(saved)
  }).then(flatten)
}

export async function movePublishedPaymentMethod(
  input: unknown,
): Promise<Result<MovedPaymentMethod>> {
  const parsed = movePaymentMethodSchema.safeParse(input)

  if (!parsed.success) return invalid('Choose a payment method and direction')

  return withStaff(async ({ staff, client }) => {
    const current = await findPaymentMethod(client, staff.clubId, parsed.data.id)

    if (!current) return invalid('That payment method is no longer available')

    await movePaymentMethod(client, current.id, parsed.data.direction)

    return ok(parsed.data)
  }).then(flatten)
}

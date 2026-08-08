'use server'

/**
 * The admin feature's server-action surface.
 *
 * Thin on purpose, matching src/features/booking/actions.ts: every action
 * delegates to a plain module under ./server, which is unit-testable without a
 * Next.js request. Authorisation is not repeated here — each module runs inside
 * withStaff, so an action that forgot the gate could not reach a repository.
 */

import { markBookingPaid, refundBookingPayment, type PaidResult } from './server/payments'
import { blockCourtTime, removeCourtBlock } from './server/blocks'
import { savePricingRule, saveProduct } from './server/catalog'
import { saveCourt } from './server/courts'
import { uploadCatalogImage, type UploadedCatalogImage } from './server/media'
import type { AvailabilityBlock, Payment } from '@/lib/repositories/booking-mappers'
import type { Court, Product } from '@/lib/repositories/mappers'
import type { PricingRule } from '@/lib/domain/types'
import type { Result } from '@/lib/api/result'

export async function markBookingPaidAction(input: unknown): Promise<Result<PaidResult>> {
  return markBookingPaid(input)
}

export async function refundPaymentAction(input: unknown): Promise<Result<Payment>> {
  return refundBookingPayment(input)
}

export async function blockCourtTimeAction(input: unknown): Promise<Result<AvailabilityBlock>> {
  return blockCourtTime(input)
}

export async function removeCourtBlockAction(input: unknown): Promise<Result<{ blockId: string }>> {
  return removeCourtBlock(input)
}

export async function saveProductAction(input: unknown): Promise<Result<Product>> {
  return saveProduct(input)
}

export async function savePricingRuleAction(input: unknown): Promise<Result<PricingRule>> {
  return savePricingRule(input)
}

export async function saveCourtAction(input: unknown): Promise<Result<Court>> {
  return saveCourt(input)
}

/** Takes FormData rather than a plain object: the payload is a file. */
export async function uploadCatalogImageAction(
  form: FormData,
): Promise<Result<UploadedCatalogImage>> {
  return uploadCatalogImage(form)
}

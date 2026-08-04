import { z } from 'zod'

/**
 * Boundary validation for staff-initiated writes.
 *
 * Two fields are deliberately absent from every schema here: `clubId` and the
 * identity of the acting staff member. Both are taken from the session in
 * src/features/admin/server/session.ts. Accepting either from the request
 * would let a signed-in staff member write into another club, or attribute a
 * payment to a colleague.
 */

const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'gcash', 'online'] as const
const BLOCK_KINDS = ['maintenance', 'league', 'private', 'closed'] as const
const PRODUCT_TYPES = ['addon', 'cafe'] as const
const RATE_KINDS = ['fixed', 'amount_delta', 'percent_delta'] as const
const CUSTOMER_TIERS = ['standard', 'regular', 'pro'] as const

/** Sunday is 0, matching Postgres `extract(dow ...)`. */
const DAY_OF_WEEK_MAX = 6
const MAX_PRIORITY = 1000

export const markBookingPaidSchema = z.object({
  bookingId: z.uuid(),
  method: z.enum(PAYMENT_METHODS),
  amountCents: z.number().int().positive('A payment must be for more than nothing'),
  /** Gateway or deposit-slip reference. Null for cash taken at the counter. */
  externalReference: z.string().trim().max(120).nullish(),
})

export const refundPaymentSchema = z.object({ paymentId: z.uuid() })

export const createBlockSchema = z
  .object({
    courtId: z.uuid(),
    kind: z.enum(BLOCK_KINDS),
    reason: z.string().trim().max(200).nullish(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
  })
  .refine((block) => block.endsAt > block.startsAt, {
    message: 'A block must end after it starts',
    path: ['endsAt'],
  })

export const removeBlockSchema = z.object({ blockId: z.uuid() })

const productFieldsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullish(),
  type: z.enum(PRODUCT_TYPES),
  priceCents: z.number().int().min(0, 'A price cannot be negative'),
  hasQuantity: z.boolean(),
  imageUrl: z.url().nullish(),
  sortOrder: z.number().int().min(0).max(9999),
})

/** Creating needs every field; patching needs an id and at least one change. */
export const productPatchSchema = productFieldsSchema
  .partial()
  .extend({ id: z.uuid(), isActive: z.boolean().optional() })

export const createProductSchema = productFieldsSchema

const ruleFieldsSchema = z.object({
  courtId: z.uuid().nullish(),
  label: z.string().trim().min(1).max(120),
  daysOfWeek: z.array(z.number().int().min(0).max(DAY_OF_WEEK_MAX)).max(7),
  startsAtTime: z.string().nullish(),
  endsAtTime: z.string().nullish(),
  minDurationMinutes: z.number().int().positive().nullish(),
  appliesToTier: z.enum(CUSTOMER_TIERS).nullish(),
  kind: z.enum(RATE_KINDS),
  valueCents: z.number().int().nullish(),
  valuePercent: z.number().nullish(),
  priority: z.number().int().min(0).max(MAX_PRIORITY),
})

/**
 * Mirrors the `pricing_rules_value_matches_kind` check constraint. The database
 * is still the authority; catching it here turns a 23514 into a field error the
 * editor can point at.
 */
function hasValueMatchingKind(rule: {
  kind: (typeof RATE_KINDS)[number]
  valueCents?: number | null
  valuePercent?: number | null
}): boolean {
  return rule.kind === 'percent_delta'
    ? rule.valuePercent !== null && rule.valuePercent !== undefined
    : rule.valueCents !== null && rule.valueCents !== undefined
}

export const createPricingRuleSchema = ruleFieldsSchema.refine(hasValueMatchingKind, {
  message: 'A percentage rule needs a percentage, and a cash rule needs an amount',
  path: ['kind'],
})

export const pricingRulePatchSchema = ruleFieldsSchema
  .partial()
  .extend({ id: z.uuid(), isActive: z.boolean().optional() })
  .refine((rule) => rule.kind === undefined || hasValueMatchingKind({ ...rule, kind: rule.kind }), {
    message: 'A percentage rule needs a percentage, and a cash rule needs an amount',
    path: ['kind'],
  })

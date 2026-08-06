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
const COURT_ENVIRONMENTS = ['indoor', 'outdoor'] as const

/** Lowercase, digits, single hyphens: what survives a URL without escaping. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** A doubles court seats four; the ceiling leaves room for coaching sessions. */
const MAX_PLAYERS_PER_COURT = 32

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

const courtFieldsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(SLUG_PATTERN, 'Use lowercase letters, numbers, and single hyphens'),
  surface: z.string().trim().min(1).max(120),
  environment: z.enum(COURT_ENVIRONMENTS),
  isTournamentGrade: z.boolean(),
  blurb: z.string().trim().max(500).nullish(),
  /** One "Good to know" line per entry — the detail page lists them. */
  notes: z.array(z.string().trim().min(1).max(200)).max(12),
  tags: z.array(z.string().trim().min(1).max(40)).max(12),
  includes: z.array(z.string().trim().min(1).max(120)).max(12),
  heroImageUrl: z.url().nullish(),
  basePriceCents: z.number().int().min(0, 'A price cannot be negative'),
  sortOrder: z.number().int().min(0).max(9999),
  minPlayers: z.number().int().min(1).max(MAX_PLAYERS_PER_COURT),
  maxPlayers: z.number().int().min(1).max(MAX_PLAYERS_PER_COURT),
})

/**
 * Mirrors the `courts_players_ordered` check constraint, so an inverted band
 * becomes a field error the editor can point at rather than a 23514.
 */
function hasOrderedCapacity(court: {
  minPlayers?: number | null
  maxPlayers?: number | null
}): boolean {
  const { minPlayers, maxPlayers } = court

  if (minPlayers === undefined || minPlayers === null) return true
  if (maxPlayers === undefined || maxPlayers === null) return true

  return maxPlayers >= minPlayers
}

const CAPACITY_MESSAGE = 'The most players cannot be fewer than the fewest'

export const createCourtSchema = courtFieldsSchema.refine(hasOrderedCapacity, {
  message: CAPACITY_MESSAGE,
  path: ['maxPlayers'],
})

/**
 * A patch may move one end of the capacity band on its own. That case is
 * checked against the stored row in the server module, which is the only place
 * that knows the other end; the database check constraint is the backstop.
 */
export const courtPatchSchema = courtFieldsSchema
  .partial()
  .extend({ id: z.uuid(), isActive: z.boolean().optional() })
  .refine(hasOrderedCapacity, { message: CAPACITY_MESSAGE, path: ['maxPlayers'] })

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

import { z } from 'zod'

/**
 * Boundary validation for everything a client can send.
 *
 * Prices are deliberately absent: the server quotes each segment with
 * src/lib/domain/pricing.ts. Any `priceCents` a client sends is stripped by
 * Zod's default object behaviour rather than trusted.
 */

const BOOKING_REFERENCE_PATTERN = /^PB-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{6}$/

const courtSelectionSchema = z
  .object({
    courtId: z.uuid(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
  })
  .refine((segment) => segment.endsAt > segment.startsAt, {
    message: 'A session must end after it starts',
    path: ['endsAt'],
  })

/**
 * A named player. The ceiling matches MAX_PLAYERS_PER_COURT in admin-schemas:
 * no court can seat more, so a longer roster is a mistake or an attack, not a
 * booking worth sending to the database.
 */
const MAX_PLAYERS_PER_BOOKING = 32

const playerNameSchema = z
  .string()
  .trim()
  .min(1, 'Please name every player, or remove the empty row')
  .max(120)

const bookingItemSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().positive().max(99),
})

export const createBookingSchema = z.object({
  clubId: z.uuid(),
  contactName: z.string().trim().min(1, 'Please tell us who is playing').max(120),
  contactEmail: z.email(),
  contactPhone: z.string().trim().max(32).nullish(),
  willPresentId: z.boolean().default(false),
  notes: z.string().trim().max(500).nullish(),
  courts: z.array(courtSelectionSchema).min(1, 'Pick at least one court and time'),
  items: z.array(bookingItemSchema).max(50).default([]),
  /**
   * Everyone playing. The server counts these to get the party size rather
   * than accepting a separate number, so the roster and the size cannot
   * disagree. Empty is allowed: a staff-side booking may have no roster yet.
   */
  players: z.array(playerNameSchema).max(MAX_PLAYERS_PER_BOOKING).default([]),
  /** How the guest intends to pay. Staff confirm settlement later. */
  paymentMethod: z.enum(['cash', 'card', 'bank_transfer', 'gcash', 'online']).nullish(),
})

export type CreateBookingInput = z.infer<typeof createBookingSchema>

/**
 * Guest checkout.
 *
 * Stricter than createBookingSchema on two counts, both because this is the
 * self-service path with no member on the other end: a phone number is required
 * (the club settles payments manually and calls when a receipt does not match),
 * and a published payment method must be named rather than a bare enum value
 * the client could invent.
 */

/** Long enough to be a real number once spaces and a country code are allowed for. */
const MIN_PHONE_LENGTH = 7

export const checkoutSchema = createBookingSchema
  .extend({
    contactPhone: z
      .string()
      .trim()
      .min(MIN_PHONE_LENGTH, 'Please give a phone number we can reach you on')
      .max(32),
    /** One of the club's published payment_methods rows, not the enum. */
    paymentMethodId: z.uuid('Please choose how you would like to pay'),
  })
  .omit({ paymentMethod: true })

export type CheckoutInput = z.infer<typeof checkoutSchema>

export const bookingLookupSchema = z.object({
  reference: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine((value) => BOOKING_REFERENCE_PATTERN.test(value), {
      message: 'That does not look like a booking reference',
    }),
  email: z.email(),
})

export type BookingLookupInput = z.infer<typeof bookingLookupSchema>

/**
 * Moving an existing booking. Authenticates on the same reference + email as a
 * lookup, and carries the new windows only — prices are re-quoted server-side.
 */
export const rescheduleBookingSchema = bookingLookupSchema.extend({
  courts: z.array(courtSelectionSchema).min(1, 'Pick at least one court and time'),
})

export type RescheduleBookingInput = z.infer<typeof rescheduleBookingSchema>

export const availabilityQuerySchema = z.object({
  clubId: z.uuid(),
  /** Club-local calendar day, "YYYY-MM-DD". */
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD day'),
  durationMinutes: z.number().int().min(30).max(480),
  courtId: z.uuid().optional(),
  /** Optional: identifies a returning customer so tier pricing applies. */
  email: z.email().optional(),
})

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>

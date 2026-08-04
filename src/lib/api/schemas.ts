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
  /** How the guest intends to pay. Staff confirm settlement later. */
  paymentMethod: z.enum(['cash', 'card', 'bank_transfer', 'gcash', 'online']).nullish(),
})

export type CreateBookingInput = z.infer<typeof createBookingSchema>

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

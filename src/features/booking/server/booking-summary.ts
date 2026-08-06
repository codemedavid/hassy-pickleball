import { consumeRateLimit } from '@/lib/security/rate-limit'

/**
 * Shared shape and guards for the guest-facing booking RPCs.
 *
 * Lookup, cancel, and reschedule all authenticate on the same reference +
 * email pair and all return the same row shape, so they read it, meter it, and
 * fail the same way rather than each keeping its own copy.
 */

export type BookingSummary = {
  readonly reference: string
  readonly status: string
  readonly totalCents: number
}

export type BookingRpcRow = { reference: string; status: string; total_cents: number }

/** Deliberately identical for a wrong reference and a wrong email. */
export const NO_MATCH = 'No booking matches that reference and email'

/** Raised by cancel_booking / reschedule_booking for an illegal transition. */
export const ILLEGAL_TRANSITION = 'P0002'

/** 23P01 is the exclusion-constraint violation; P0001 the RPC's own raise. */
export const SLOT_TAKEN_CODES = new Set(['23P01', 'P0001'])

export function toSummary(row: BookingRpcRow): BookingSummary {
  return { reference: row.reference, status: row.status, totalCents: row.total_cents }
}

/** These RPCs return `setof`, but a single composite comes back unwrapped. */
export function firstRow(data: unknown): BookingRpcRow | null {
  const rows = Array.isArray(data) ? data : [data]

  return (rows[0] as BookingRpcRow | undefined) ?? null
}

/**
 * Meters attempts against one booking's credentials.
 *
 * This is the inner gate. The outer gate in withRateLimit counts the client
 * address; this counts the email, so a distributed attempt to grind one
 * customer's booking is bounded too. Lower-cased because the address is the
 * counter key and `ANA@` must not open a fresh budget.
 *
 * Counted before the operation runs, so exhausting the limit keeps it
 * exhausted rather than letting a blocked caller decay back under it.
 */
export async function underLookupLimit(email: string): Promise<boolean> {
  return consumeRateLimit('lookup', `email:${email.toLowerCase()}`)
}

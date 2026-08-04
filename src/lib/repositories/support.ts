import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

/** Shared plumbing for every repository module. */

export type Client = SupabaseClient<Database>

/** Statuses that occupy a court. Cancelled bookings free their slot. */
export const LIVE_BOOKING_STATUSES = [
  'pending',
  'awaiting_payment',
  'confirmed',
  'completed',
] as const

/** Every list query is bounded, so a page can never fetch an unbounded table. */
export const MAX_ROWS = 500

export type PostgrestFailure = { readonly message: string; readonly code?: string }

/**
 * A database error carrying the Postgres SQLSTATE, so callers can distinguish a
 * slot conflict (23P01) from a generic failure without string-matching messages.
 */
export class RepositoryError extends Error {
  readonly code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'RepositoryError'
    this.code = code
  }
}

/** Turns a PostgREST error into a throw with context. Never swallows one. */
export function raise(context: string, error: PostgrestFailure | null): void {
  if (error) {
    throw new RepositoryError(`${context}: ${error.message}`, error.code)
  }
}

export function toDate(value: string): Date {
  return new Date(value)
}

export function toNullableDate(value: string | null): Date | null {
  return value === null ? null : new Date(value)
}

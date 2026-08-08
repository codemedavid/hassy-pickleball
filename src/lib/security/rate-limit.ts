import 'server-only'

import { clientIdentity } from './request-identity'
import { err, type Result } from '@/lib/api/result'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { callPendingRpc } from '@/lib/supabase/rpc'

/**
 * Rate limiting for the server-action surface.
 *
 * Every action here runs on the service-role client, so an unmetered one is an
 * unauthenticated caller driving privileged reads and writes. The counter
 * itself lives in Postgres (`record_lookup_attempt`) rather than in memory,
 * because serverless instances do not share memory and a per-instance counter
 * is no limit at all.
 */

export type RateLimitBucket = 'availability' | 'booking' | 'lookup'

export type RateLimitPolicy = {
  readonly limit: number
  /** A Postgres interval literal. */
  readonly window: string
}

/**
 * Per-bucket budgets. Browsing is chatty and read-only, so it gets room;
 * creating and looking up bookings is neither.
 */
export const RATE_LIMITS: Record<RateLimitBucket, RateLimitPolicy> = {
  availability: { limit: 120, window: '5 minutes' },
  booking: { limit: 10, window: '15 minutes' },
  lookup: { limit: 10, window: '15 minutes' },
}

export const RATE_LIMITED_MESSAGE = 'Too many requests. Please wait a few minutes and try again.'
export const RATE_LIMITED_CODE = 'RATE_LIMITED'

/**
 * Records one attempt and reports whether the caller may proceed.
 *
 * FAILS CLOSED. A limiter that waves callers through when its own counter is
 * unreachable is not a limiter — whoever can break the counter gets unlimited
 * attempts, which is precisely the caller this exists to stop.
 */
export async function consumeRateLimit(
  bucket: RateLimitBucket,
  identity: string,
): Promise<boolean> {
  const policy = RATE_LIMITS[bucket]

  try {
    const { data, error } = await callPendingRpc<'record_lookup_attempt', boolean>(
      createSupabaseAdminClient(),
      'record_lookup_attempt',
      {
        // Namespaced so exhausting one bucket cannot lock a caller out of the
        // others — browsing the catalog must not spend a booking attempt.
        p_identity: `${bucket}:${identity}`,
        p_limit: policy.limit,
        p_window: policy.window,
      },
    )

    if (error) {
      reportBrokenCounter(bucket, error.message)

      return false
    }

    return data === true
  } catch (error: unknown) {
    reportBrokenCounter(bucket, describe(error))

    return false
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * A broken counter and an exhausted one are the same refusal to the caller, by
 * design — the guest must not learn which. That makes this log the only place
 * the difference survives, so it must never be dropped. The identity is
 * deliberately absent: it is the one field here that is personal data.
 */
function reportBrokenCounter(bucket: RateLimitBucket, reason: string): void {
  console.error('Rate limit counter unavailable; refusing the call', { bucket, reason })
}

/**
 * Meters an action by client address.
 *
 * This is the outer gate, applied at the 'use server' boundary because that is
 * the network edge. Actions that authenticate on a caller-supplied field —
 * booking reference and email — additionally meter that field, since one
 * address grinding one booking is a different attack from one address grinding
 * the keyspace.
 */
export async function withRateLimit<T>(
  bucket: RateLimitBucket,
  run: () => Promise<Result<T>>,
): Promise<Result<T>> {
  const allowed = await consumeRateLimit(bucket, await clientIdentity())

  return allowed ? run() : err(RATE_LIMITED_MESSAGE, RATE_LIMITED_CODE)
}

'use server'

/**
 * The checkout feature's server-action surface.
 *
 * Thin for the same reason the booking actions are: a 'use server' file is a
 * network boundary, not a place for logic. It is, however, the right place for
 * the rate limit — this action runs on the service-role client and writes, so
 * it is metered on the same `booking` budget as createBookingAction.
 */

import { submitCheckout, type CheckoutResult } from './server/submit-checkout'
import type { Result } from '@/lib/api/result'
import { withRateLimit } from '@/lib/security/rate-limit'

export async function submitCheckoutAction(form: FormData): Promise<Result<CheckoutResult>> {
  return withRateLimit('booking', () => submitCheckout(form))
}

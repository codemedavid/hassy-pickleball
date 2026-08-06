import 'server-only'

import { createHash } from 'node:crypto'
import { headers } from 'next/headers'

/**
 * Who is calling, for rate-limiting purposes.
 *
 * Keyed on the client address rather than anything in the payload: an email or
 * a booking reference is chosen by the caller, so limiting on those alone lets
 * an attacker reset their own counter by editing a field.
 *
 * TRUST BOUNDARY: `x-forwarded-for` is caller-supplied unless a proxy rewrites
 * it. This is correct behind Vercel or any ingress that sets these headers
 * itself, and must not be relied on if the app is ever exposed directly.
 */

/** Every caller we cannot place shares one counter, so they cannot exceed it together. */
export const UNKNOWN_IDENTITY = 'unknown'

/** Truncated: 128 bits is far past collision risk for a rate-limit key. */
const DIGEST_LENGTH = 32

/** The left-most hop is the original client; the rest are proxies. */
function firstHop(forwardedFor: string | null): string | null {
  const hop = forwardedFor?.split(',')[0]?.trim()

  return hop ? hop : null
}

function fingerprint(address: string): string {
  return `ip:${createHash('sha256').update(address).digest('hex').slice(0, DIGEST_LENGTH)}`
}

/**
 * A stable, non-reversible id for the caller.
 *
 * The address is hashed rather than stored: the limiter table would otherwise
 * become a log of who visited, which is more personal data than a counter
 * needs.
 */
export async function clientIdentity(): Promise<string> {
  try {
    const store = await headers()
    // x-real-ip is set from the socket; x-forwarded-for is a caller-writable
    // list that a proxy only prepends to.
    const address = store.get('x-real-ip')?.trim() || firstHop(store.get('x-forwarded-for'))

    return address ? fingerprint(address) : UNKNOWN_IDENTITY
  } catch {
    // Called outside a request scope — no caller to identify.
    return UNKNOWN_IDENTITY
  }
}

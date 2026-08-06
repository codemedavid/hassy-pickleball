import { createHmac } from 'node:crypto'

/**
 * Signed delivery URLs for private ImageKit files.
 *
 * A proof of payment is a photo of someone's banking app, so its file is
 * uploaded private and is unreachable without one of these. ImageKit's scheme
 * is a keyed digest over the path and an expiry:
 *
 *   ik-s = HMAC-SHA1(privateKey, <path relative to the endpoint> + <ik-t>)
 *
 * Implemented here rather than pulled from the vendor SDK, which would add
 * axios and form-data to a project with seven runtime dependencies for the sake
 * of four lines of crypto. The scheme is pinned by a golden vector in the tests
 * that was verified against the live CDN, so a drift shows up as a red test
 * rather than as a 403 in front of a guest.
 */

/**
 * What may appear in a path we are willing to sign. Deliberately narrow: these
 * strings are built from booking references and club ids, and anything outside
 * this set means a caller is passing through input it did not construct.
 */
const SAFE_PATH_SEGMENT = /^[A-Za-z0-9._/-]+$/

export type SignatureInput = {
  readonly privateKey: string
  readonly urlEndpoint: string
  /** Storage path as ImageKit reports it, e.g. `/payment-proofs/PB-4G6JVH/proof.png`. */
  readonly path: string
  readonly expiresInSeconds: number
}

export function signImageUrl(input: SignatureInput): string {
  const path = normalisePath(input.path)
  const endpoint = withoutTrailingSlash(input.urlEndpoint)
  const expiry = currentUnixSeconds() + input.expiresInSeconds

  // The digest covers the path as it appears *after* the endpoint, which is
  // why the URL is assembled from the same normalised parts that are signed.
  const signature = createHmac('sha1', input.privateKey).update(`${path}${expiry}`).digest('hex')

  return `${endpoint}/${path}?ik-t=${expiry}&ik-s=${signature}`
}

/**
 * Strips the leading slash and refuses anything that could bend the signed URL
 * somewhere else — a `..` that climbs out of the folder, or a caller-supplied
 * query string that would let a forged `ik-s` sit ahead of the real one.
 */
function normalisePath(path: string): string {
  const trimmed = path.startsWith('/') ? path.slice(1) : path

  if (!SAFE_PATH_SEGMENT.test(trimmed) || trimmed.includes('..')) {
    throw new Error('Refusing to sign an untrusted image path')
  }

  return trimmed
}

function withoutTrailingSlash(endpoint: string): string {
  return endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint
}

function currentUnixSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

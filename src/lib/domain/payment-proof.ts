import { err, ok, type Result } from '@/lib/api/result'

/**
 * Proof-of-payment screenshots.
 *
 * The club settles GCash and bank transfers by eye, so what arrives here is a
 * photo or screenshot from a phone. This module decides what is acceptable and
 * where it is filed — pure, so both the browser (which can refuse before
 * uploading a megabyte) and the server (which cannot trust the browser) run the
 * same rules.
 */

/** Comfortably above a phone screenshot, well below a video someone mis-picked. */
export const MAX_PROOF_BYTES = 5 * 1024 * 1024

/**
 * Extension keyed by content type rather than taken from the filename: the name
 * is attacker-supplied and would otherwise decide a storage path.
 */
const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  // What an iPhone uploads unless the owner changed the camera format.
  'image/heic': 'heic',
  'image/heif': 'heif',
}

const ALLOWED_EXTENSIONS = new Set(Object.values(EXTENSION_BY_TYPE))

/** Booking references are the only thing allowed to name a proof's folder. */
const BOOKING_REFERENCE_PATTERN = /^PB-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{6}$/

export const PROOF_ACCEPT_ATTRIBUTE = Object.keys(EXTENSION_BY_TYPE).join(',')

/** The parts of a File this module needs, so tests need no browser. */
export type ProofFile = {
  readonly name: string
  readonly type: string
  readonly size: number
}

export type ValidatedProof = {
  readonly contentType: string
  readonly extension: string
}

export function validatePaymentProof(file: ProofFile): Result<ValidatedProof> {
  const extension = EXTENSION_BY_TYPE[file.type]

  if (!extension) {
    return err('Please upload an image of your payment — a JPG, PNG, or screenshot from your phone')
  }

  if (file.size <= 0) {
    return err('That file came through empty. Please pick the screenshot again.')
  }

  if (file.size > MAX_PROOF_BYTES) {
    return err('That image is too large. Please upload one smaller than 5 MB.')
  }

  return ok({ contentType: file.type, extension })
}

/**
 * Where a proof is filed: one folder per booking, one proof in it.
 *
 * Both parts are checked rather than escaped. This string becomes a storage
 * object key, and the only safe way to build one from outside input is to
 * refuse anything that is not already the shape we issue.
 */
export function buildPaymentProofPath(reference: string, extension: string): string {
  if (!BOOKING_REFERENCE_PATTERN.test(reference)) {
    return raiseInvalid('reference')
  }

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return raiseInvalid('extension')
  }

  return `${reference}/proof.${extension}`
}

function raiseInvalid(part: 'reference' | 'extension'): never {
  throw new Error(`Refusing to build a proof path from an untrusted ${part}`)
}

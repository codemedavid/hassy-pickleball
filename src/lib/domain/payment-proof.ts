import {
  ALLOWED_EXTENSIONS,
  IMAGE_ACCEPT_ATTRIBUTE,
  MAX_IMAGE_BYTES,
  validateImage,
  type ImageFile,
  type ValidatedImage,
} from './image-upload'
import type { Result } from '@/lib/api/result'

/**
 * Proof-of-payment screenshots.
 *
 * The club settles GCash and bank transfers by eye, so what arrives here is a
 * photo or screenshot from a phone. What makes a file acceptable is shared with
 * every other image the site takes (see image-upload); what is specific to a
 * proof is where it is filed, and that the folder may only ever be named by a
 * booking reference.
 */

/** Booking references are the only thing allowed to name a proof's folder. */
const BOOKING_REFERENCE_PATTERN = /^PB-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{6}$/

export const MAX_PROOF_BYTES = MAX_IMAGE_BYTES
export const PROOF_ACCEPT_ATTRIBUTE = IMAGE_ACCEPT_ATTRIBUTE

export type ProofFile = ImageFile
export type ValidatedProof = ValidatedImage

export function validatePaymentProof(file: ProofFile): Result<ValidatedProof> {
  return validateImage(file)
}

/**
 * Where a proof is filed: one folder per booking, one proof in it.
 *
 * Both parts are checked rather than escaped. This string becomes a storage
 * path, and the only safe way to build one from outside input is to refuse
 * anything that is not already the shape we issue.
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

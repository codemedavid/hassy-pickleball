import 'server-only'

import { err, ok, type Result } from '@/lib/api/result'
import type { Client } from '@/lib/repositories/support'

/**
 * Uploads to the private `payment-proofs` bucket.
 *
 * Private, and written only from here on the service-role client: a bucket a
 * browser can write to directly is an anonymous file drop. The desk reads a
 * proof back through a signed URL.
 */

export const PAYMENT_PROOF_BUCKET = 'payment-proofs'

/** How long a link to a proof stays valid when staff open one. */
const SIGNED_URL_TTL_SECONDS = 300

export type ProofUpload = {
  readonly path: string
  readonly contentType: string
  readonly body: ArrayBuffer
}

/** Returns the stored object key, or the reason it could not be stored. */
export async function uploadPaymentProof(
  client: Client,
  upload: ProofUpload,
): Promise<Result<string>> {
  const { error } = await client.storage
    .from(PAYMENT_PROOF_BUCKET)
    .upload(upload.path, upload.body, {
      contentType: upload.contentType,
      // One proof per booking: re-submitting replaces rather than accumulating.
      upsert: true,
    })

  if (error) {
    return err(error.message, 'STORAGE_ERROR')
  }

  return ok(upload.path)
}

/** A time-boxed link for staff reviewing a payment in the admin console. */
export async function signPaymentProofUrl(client: Client, path: string): Promise<Result<string>> {
  const { data, error } = await client.storage
    .from(PAYMENT_PROOF_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

  if (error || !data) {
    return err(error?.message ?? 'Could not open that proof', 'STORAGE_ERROR')
  }

  return ok(data.signedUrl)
}

import 'server-only'

import { signImageUrl } from './signature'
import { err, ok, type Result } from '@/lib/api/result'
import { readServerEnv } from '@/lib/env'

/**
 * ImageKit, reached over its REST API.
 *
 * Everything here runs on the server. Uploads are proxied rather than sent
 * straight from the browser: ImageKit's client-side auth parameters do not
 * constrain `fileName`, `folder`, or `isPrivateFile`, so handing them out would
 * let anyone holding a checkout page write anywhere in the media library. The
 * cost is that a proof crosses our server on its way; the benefit is that the
 * type and size checks stay on the side of the boundary we control.
 *
 * `fetch` is a parameter so tests can assert on the request we build without a
 * network — the request shape is the contract, not ImageKit's uptime.
 */

const UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload'
const FILES_URL = 'https://api.imagekit.io/v1/files'

/** How long a link to a private file stays valid when staff open one. */
export const SIGNED_URL_TTL_SECONDS = 300

export type Fetch = (url: string, init: RequestInit) => Promise<Response>

export type ImageUpload = {
  /** Folder path, e.g. `/payment-proofs/PB-4G6JVH`. */
  readonly folder: string
  readonly fileName: string
  readonly contentType: string
  readonly body: ArrayBuffer
  /** Private files 403 without a signed URL. True for anything guest-supplied. */
  readonly isPrivate: boolean
}

export type StoredImage = {
  /** ImageKit's `filePath`, which is what we persist. */
  readonly path: string
  readonly fileId: string
  readonly url: string
}

export async function uploadImage(
  upload: ImageUpload,
  fetchImpl: Fetch = fetch,
): Promise<Result<StoredImage>> {
  const env = readServerEnv()
  const form = new FormData()

  form.set('file', new Blob([upload.body], { type: upload.contentType }), upload.fileName)
  form.set('fileName', upload.fileName)
  form.set('folder', upload.folder)
  form.set('isPrivateFile', String(upload.isPrivate))
  // One image per subject: re-submitting replaces rather than accumulating.
  form.set('useUniqueFileName', 'false')
  form.set('overwriteFile', 'true')

  try {
    const response = await fetchImpl(UPLOAD_URL, {
      method: 'POST',
      headers: { authorization: basicAuth(env.IMAGEKIT_PRIVATE_KEY) },
      body: form,
    })

    if (!response.ok) {
      return err(await describeFailure(response, 'Could not store that image'), 'STORAGE_ERROR')
    }

    const body = (await response.json()) as Partial<{
      filePath: string
      fileId: string
      url: string
    }>

    if (!body.filePath || !body.fileId || !body.url) {
      return err('Image store returned an unexpected response', 'STORAGE_ERROR')
    }

    return ok({ path: body.filePath, fileId: body.fileId, url: body.url })
  } catch {
    // The reason is deliberately generic: whatever fetch threw may quote the
    // request, and the request carries the private key.
    return err('Could not reach the image store', 'STORAGE_ERROR')
  }
}

/** A time-boxed link to a private file, for staff reviewing a proof. */
export function signStoredImageUrl(path: string): Result<string> {
  const env = readServerEnv()

  try {
    return ok(
      signImageUrl({
        privateKey: env.IMAGEKIT_PRIVATE_KEY,
        urlEndpoint: env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT,
        path,
        expiresInSeconds: SIGNED_URL_TTL_SECONDS,
      }),
    )
  } catch {
    return err('Could not open that image', 'STORAGE_ERROR')
  }
}

export async function deleteImage(fileId: string, fetchImpl: Fetch = fetch): Promise<Result<null>> {
  const env = readServerEnv()

  try {
    const response = await fetchImpl(`${FILES_URL}/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      headers: { authorization: basicAuth(env.IMAGEKIT_PRIVATE_KEY) },
    })

    if (!response.ok) {
      return err(await describeFailure(response, 'Could not remove that image'), 'STORAGE_ERROR')
    }

    return ok(null)
  } catch {
    return err('Could not reach the image store', 'STORAGE_ERROR')
  }
}

/** Basic auth with the private key as the username and an empty password. */
function basicAuth(privateKey: string): string {
  return `Basic ${Buffer.from(`${privateKey}:`).toString('base64')}`
}

/**
 * ImageKit's own wording when it offers one, since "over quota" or "file too
 * large" is more use to an operator than a bare status code.
 */
async function describeFailure(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string }

    return body.message ?? fallback
  } catch {
    return fallback
  }
}

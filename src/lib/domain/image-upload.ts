import { err, ok, type Result } from '@/lib/api/result'

/**
 * What counts as an uploadable image, and where one is filed.
 *
 * Pure, so the browser and the server can run the same rules — the browser to
 * refuse before uploading a megabyte, the server because it cannot trust the
 * browser. Shared by payment proofs and catalog images: the two differ in where
 * they are stored and who may read them, not in what makes a file acceptable.
 */

/** Comfortably above a phone screenshot, well below a video someone mis-picked. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/**
 * Extension keyed by content type rather than taken from the file name: the
 * name is attacker-supplied and would otherwise decide a storage path.
 *
 * SVG is absent on purpose. It is an image to a browser and a script host to
 * an attacker, and nothing here needs one.
 */
export const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  // What an iPhone uploads unless the owner changed the camera format.
  'image/heic': 'heic',
  'image/heif': 'heif',
}

export const ALLOWED_EXTENSIONS = new Set(Object.values(EXTENSION_BY_TYPE))

export const IMAGE_ACCEPT_ATTRIBUTE = Object.keys(EXTENSION_BY_TYPE).join(',')

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The parts of a File this module needs, so tests need no browser. */
export type ImageFile = {
  readonly name: string
  readonly type: string
  readonly size: number
}

export type ValidatedImage = {
  readonly contentType: string
  readonly extension: string
}

export function validateImage(file: ImageFile): Result<ValidatedImage> {
  const extension = EXTENSION_BY_TYPE[file.type]

  if (!extension) {
    return err('Please upload an image — a JPG, PNG, or screenshot from your phone')
  }

  if (file.size <= 0) {
    return err('That file came through empty. Please pick the image again.')
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return err('That image is too large. Please upload one smaller than 5 MB.')
  }

  return ok({ contentType: file.type, extension })
}

/** What a catalog image can be attached to. */
export type CatalogSubject = 'product' | 'court' | 'payment-method'

export type CatalogImageLocation = {
  readonly clubId: string
  readonly subject: CatalogSubject
  /** Id of the row the image belongs to. */
  readonly id: string
  readonly extension: string
}

/**
 * Where a catalog image is filed: one folder per club, then per subject.
 *
 * Both ids are checked rather than escaped. This string becomes a storage path,
 * and the only safe way to build one from outside input is to refuse anything
 * that is not already the shape we issue.
 */
export function buildCatalogImagePath(location: CatalogImageLocation): string {
  if (!UUID_PATTERN.test(location.clubId)) {
    raiseInvalid('club')
  }

  if (!UUID_PATTERN.test(location.id)) {
    raiseInvalid('id')
  }

  if (!ALLOWED_EXTENSIONS.has(location.extension)) {
    raiseInvalid('extension')
  }

  return `/catalog/${location.clubId}/${location.subject}/${location.id}.${location.extension}`
}

function raiseInvalid(part: 'club' | 'id' | 'extension'): never {
  throw new Error(`Refusing to build an image path from an untrusted ${part}`)
}

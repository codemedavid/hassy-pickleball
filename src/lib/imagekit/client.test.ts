import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteImage, signStoredImageUrl, uploadImage } from './client'

/**
 * The upload path is exercised against a fake `fetch` rather than the network:
 * what matters is the request we send ImageKit — the auth header, the private
 * flag, the overwrite semantics — not that ImageKit is reachable from CI.
 */

const ORIGINAL_ENV = process.env

const ENV = {
  IMAGEKIT_PRIVATE_KEY: 'private_test_key',
  NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT: 'https://ik.imagekit.io/testendpoint',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
}

const UPLOAD_OK = {
  fileId: 'file-123',
  filePath: '/payment-proofs/PB-4G6JVH/proof.png',
  url: 'https://ik.imagekit.io/testendpoint/payment-proofs/PB-4G6JVH/proof.png',
  name: 'proof.png',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function fakeFetch(response: Response) {
  return vi.fn(() => Promise.resolve(response))
}

/** The request body ImageKit received, decoded back into a plain object. */
async function sentFields(fetchMock: ReturnType<typeof fakeFetch>): Promise<Record<string, string>> {
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
  const form = init.body as FormData
  const entries: Record<string, string> = {}

  for (const [key, value] of form.entries()) {
    if (typeof value === 'string') entries[key] = value
  }

  return entries
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, ...ENV }
})

afterEach(() => {
  process.env = ORIGINAL_ENV
  vi.restoreAllMocks()
})

describe('uploadImage', () => {
  it('returns the stored file path and id on success', async () => {
    const fetchMock = fakeFetch(jsonResponse(UPLOAD_OK))

    const result = await uploadImage(
      {
        folder: '/payment-proofs/PB-4G6JVH',
        fileName: 'proof.png',
        contentType: 'image/png',
        body: new ArrayBuffer(8),
        isPrivate: true,
      },
      fetchMock,
    )

    expect(result).toEqual({
      success: true,
      data: { path: UPLOAD_OK.filePath, fileId: UPLOAD_OK.fileId, url: UPLOAD_OK.url },
    })
  })

  it('authenticates with the private key as HTTP basic username', async () => {
    const fetchMock = fakeFetch(jsonResponse(UPLOAD_OK))

    await uploadImage(
      {
        folder: '/payment-proofs/PB-4G6JVH',
        fileName: 'proof.png',
        contentType: 'image/png',
        body: new ArrayBuffer(8),
        isPrivate: true,
      },
      fetchMock,
    )

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const header = new Headers(init.headers).get('authorization') ?? ''
    const [scheme, encoded] = header.split(' ')

    expect(scheme).toBe('Basic')
    expect(Buffer.from(encoded, 'base64').toString()).toBe(`${ENV.IMAGEKIT_PRIVATE_KEY}:`)
  })

  it('uploads a proof as a private file so it cannot be fetched unsigned', async () => {
    const fetchMock = fakeFetch(jsonResponse(UPLOAD_OK))

    await uploadImage(
      {
        folder: '/payment-proofs/PB-4G6JVH',
        fileName: 'proof.png',
        contentType: 'image/png',
        body: new ArrayBuffer(8),
        isPrivate: true,
      },
      fetchMock,
    )

    expect(await sentFields(fetchMock)).toMatchObject({ isPrivateFile: 'true' })
  })

  it('uploads a catalog image as a public file', async () => {
    const fetchMock = fakeFetch(jsonResponse(UPLOAD_OK))

    await uploadImage(
      {
        folder: '/catalog',
        fileName: 'racket.png',
        contentType: 'image/png',
        body: new ArrayBuffer(8),
        isPrivate: false,
      },
      fetchMock,
    )

    expect(await sentFields(fetchMock)).toMatchObject({ isPrivateFile: 'false' })
  })

  it('replaces rather than accumulates when the same name is uploaded twice', async () => {
    const fetchMock = fakeFetch(jsonResponse(UPLOAD_OK))

    await uploadImage(
      {
        folder: '/payment-proofs/PB-4G6JVH',
        fileName: 'proof.png',
        contentType: 'image/png',
        body: new ArrayBuffer(8),
        isPrivate: true,
      },
      fetchMock,
    )

    // One proof per booking: the pair that makes a re-submission overwrite.
    expect(await sentFields(fetchMock)).toMatchObject({
      useUniqueFileName: 'false',
      overwriteFile: 'true',
    })
  })

  it('reports a failure instead of throwing when ImageKit rejects the upload', async () => {
    const fetchMock = fakeFetch(jsonResponse({ message: 'Your account is over quota' }, 400))

    const result = await uploadImage(
      {
        folder: '/payment-proofs/PB-4G6JVH',
        fileName: 'proof.png',
        contentType: 'image/png',
        body: new ArrayBuffer(8),
        isPrivate: true,
      },
      fetchMock,
    )

    expect(result).toMatchObject({ success: false, code: 'STORAGE_ERROR' })
  })

  it('reports a failure instead of throwing when the network is down', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error('ECONNREFUSED')))

    const result = await uploadImage(
      {
        folder: '/payment-proofs/PB-4G6JVH',
        fileName: 'proof.png',
        contentType: 'image/png',
        body: new ArrayBuffer(8),
        isPrivate: true,
      },
      fetchMock,
    )

    expect(result).toMatchObject({ success: false, code: 'STORAGE_ERROR' })
  })

  it('does not leak the private key into the error message', async () => {
    const fetchMock = fakeFetch(jsonResponse({ message: 'Bad auth' }, 401))

    const result = await uploadImage(
      {
        folder: '/payment-proofs/PB-4G6JVH',
        fileName: 'proof.png',
        contentType: 'image/png',
        body: new ArrayBuffer(8),
        isPrivate: true,
      },
      fetchMock,
    )

    expect(JSON.stringify(result)).not.toContain(ENV.IMAGEKIT_PRIVATE_KEY)
  })
})

describe('signStoredImageUrl', () => {
  it('returns a signed URL carrying an expiry and a signature', () => {
    const result = signStoredImageUrl('/payment-proofs/PB-4G6JVH/proof.png')

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data).toContain(`${ENV.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT}/payment-proofs/`)
    expect(result.data).toMatch(/ik-t=\d+/)
    expect(result.data).toMatch(/ik-s=[a-f0-9]{40}/)
  })

  it('reports a failure rather than throwing on an untrusted path', () => {
    const result = signStoredImageUrl('../../etc/passwd')

    expect(result).toMatchObject({ success: false, code: 'STORAGE_ERROR' })
  })
})

describe('deleteImage', () => {
  it('reports success when ImageKit accepts the deletion', async () => {
    const fetchMock = fakeFetch(new Response(null, { status: 204 }))

    const result = await deleteImage('file-123', fetchMock)

    expect(result.success).toBe(true)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/v1/files/file-123')
    expect(init.method).toBe('DELETE')
  })

  it('reports a failure instead of throwing when the file is already gone', async () => {
    const fetchMock = fakeFetch(jsonResponse({ message: 'Not found' }, 404))

    const result = await deleteImage('file-123', fetchMock)

    expect(result).toMatchObject({ success: false, code: 'STORAGE_ERROR' })
  })
})

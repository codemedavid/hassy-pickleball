import { describe, expect, it } from 'vitest'
import {
  IMAGE_ACCEPT_ATTRIBUTE,
  MAX_IMAGE_BYTES,
  buildCatalogImagePath,
  validateImage,
} from './image-upload'

/**
 * The rules a catalog image must satisfy. Shared with the payment-proof module
 * so the browser and the server judge a file the same way — the browser to
 * refuse before uploading a megabyte, the server because it cannot trust the
 * browser.
 */

function file(overrides: Partial<{ name: string; type: string; size: number }> = {}) {
  return { name: 'racket.png', type: 'image/png', size: 1024, ...overrides }
}

describe('validateImage', () => {
  it('accepts a PNG and reports the extension to file it under', () => {
    expect(validateImage(file())).toEqual({
      success: true,
      data: { contentType: 'image/png', extension: 'png' },
    })
  })

  it.each([
    ['image/jpeg', 'jpg'],
    ['image/webp', 'webp'],
    ['image/heic', 'heic'],
  ])('accepts %s', (type, extension) => {
    expect(validateImage(file({ type }))).toMatchObject({
      success: true,
      data: { extension },
    })
  })

  /**
   * SVG is an image to a browser and a script host to an attacker. Excluded
   * deliberately, not by oversight.
   */
  it('refuses an SVG', () => {
    expect(validateImage(file({ type: 'image/svg+xml' }))).toMatchObject({ success: false })
  })

  it('refuses a file that is not an image', () => {
    const result = validateImage(file({ type: 'application/pdf' }))

    expect(result).toMatchObject({ success: false })
    if (result.success) return
    expect(result.error).toMatch(/image/i)
  })

  it('takes the extension from the content type, not the file name', () => {
    // A name is attacker-supplied and would otherwise decide a storage path.
    expect(validateImage(file({ name: 'payload.php', type: 'image/png' }))).toMatchObject({
      success: true,
      data: { extension: 'png' },
    })
  })

  it('refuses an empty file', () => {
    expect(validateImage(file({ size: 0 }))).toMatchObject({ success: false })
  })

  it('accepts a file exactly at the size limit', () => {
    expect(validateImage(file({ size: MAX_IMAGE_BYTES }))).toMatchObject({ success: true })
  })

  it('refuses a file one byte over the limit', () => {
    const result = validateImage(file({ size: MAX_IMAGE_BYTES + 1 }))

    expect(result).toMatchObject({ success: false })
    if (result.success) return
    expect(result.error).toMatch(/large/i)
  })
})

describe('IMAGE_ACCEPT_ATTRIBUTE', () => {
  it('lists the accepted types for a file input', () => {
    expect(IMAGE_ACCEPT_ATTRIBUTE).toContain('image/png')
    expect(IMAGE_ACCEPT_ATTRIBUTE).not.toContain('svg')
  })
})

describe('buildCatalogImagePath', () => {
  it('files an image under its club and subject', () => {
    const path = buildCatalogImagePath({
      clubId: '3f8a1c2e-0000-4000-8000-000000000001',
      subject: 'product',
      id: '3f8a1c2e-0000-4000-8000-000000000002',
      extension: 'png',
    })

    expect(path).toBe(
      '/catalog/3f8a1c2e-0000-4000-8000-000000000001/product/3f8a1c2e-0000-4000-8000-000000000002.png',
    )
  })

  /**
   * These parts name a folder. Checked rather than escaped: the only safe way
   * to build a storage path from outside input is to refuse anything that is
   * not already the shape we issue.
   */
  it('refuses a club id that is not a uuid', () => {
    expect(() =>
      buildCatalogImagePath({
        clubId: '../../payment-proofs',
        subject: 'product',
        id: '3f8a1c2e-0000-4000-8000-000000000002',
        extension: 'png',
      }),
    ).toThrow(/untrusted/i)
  })

  it('refuses a subject id that is not a uuid', () => {
    expect(() =>
      buildCatalogImagePath({
        clubId: '3f8a1c2e-0000-4000-8000-000000000001',
        subject: 'product',
        id: 'a/../../b',
        extension: 'png',
      }),
    ).toThrow(/untrusted/i)
  })

  it('refuses an extension outside the allowed set', () => {
    expect(() =>
      buildCatalogImagePath({
        clubId: '3f8a1c2e-0000-4000-8000-000000000001',
        subject: 'product',
        id: '3f8a1c2e-0000-4000-8000-000000000002',
        extension: 'svg',
      }),
    ).toThrow(/untrusted/i)
  })
})

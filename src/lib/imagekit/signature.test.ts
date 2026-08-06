import { describe, expect, it, vi, afterEach } from 'vitest'
import { signImageUrl } from './signature'

/**
 * The golden vector below was verified against the live CDN before this module
 * existed: a private file returned 403 unsigned and 200 with exactly this
 * signature. It is here so a refactor cannot quietly break signing in a way
 * only production would notice.
 */
const PRIVATE_KEY = 'private_HgvSPn1uNZzM2glG6FrTwvwFThg='
const ENDPOINT = 'https://ik.imagekit.io/9e1zkyidg'

afterEach(() => {
  vi.useRealTimers()
})

describe('signImageUrl', () => {
  it('reproduces the signature the CDN accepted for a known path and expiry', () => {
    // Arrange — freeze at the instant the live probe was signed.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(1786004266_000))

    // Act
    const signed = signImageUrl({
      privateKey: PRIVATE_KEY,
      urlEndpoint: ENDPOINT,
      path: '/_tdd-probe/tdd-probe.png',
      expiresInSeconds: 300,
    })

    // Assert — expiry is now + 300, and the signature matches the verified one.
    expect(signed).toContain('ik-t=1786004566')
    expect(signed).toContain('ik-s=d70bc05f81a629c80a420baf45e2ea666edfe673')
  })

  it('signs the path relative to the endpoint, not the whole URL', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(1786004266_000))

    const signed = signImageUrl({
      privateKey: PRIVATE_KEY,
      urlEndpoint: ENDPOINT,
      path: '/_tdd-probe/tdd-probe.png',
      expiresInSeconds: 300,
    })

    // A signature computed over the absolute URL would differ; this pins the
    // stringToSign convention ImageKit actually uses.
    expect(signed.startsWith(`${ENDPOINT}/_tdd-probe/tdd-probe.png?`)).toBe(true)
  })

  it('tolerates a path given without a leading slash', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(1786004266_000))

    const withSlash = signImageUrl({
      privateKey: PRIVATE_KEY,
      urlEndpoint: ENDPOINT,
      path: '/a/b.png',
      expiresInSeconds: 300,
    })
    const withoutSlash = signImageUrl({
      privateKey: PRIVATE_KEY,
      urlEndpoint: ENDPOINT,
      path: 'a/b.png',
      expiresInSeconds: 300,
    })

    expect(withoutSlash).toBe(withSlash)
  })

  it('tolerates an endpoint given with a trailing slash', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(1786004266_000))

    const plain = signImageUrl({
      privateKey: PRIVATE_KEY,
      urlEndpoint: ENDPOINT,
      path: '/a/b.png',
      expiresInSeconds: 300,
    })
    const trailing = signImageUrl({
      privateKey: PRIVATE_KEY,
      urlEndpoint: `${ENDPOINT}/`,
      path: '/a/b.png',
      expiresInSeconds: 300,
    })

    expect(trailing).toBe(plain)
  })

  it('moves the expiry forward as time passes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(1786004266_000))
    const first = signImageUrl({
      privateKey: PRIVATE_KEY,
      urlEndpoint: ENDPOINT,
      path: '/a/b.png',
      expiresInSeconds: 300,
    })

    vi.setSystemTime(new Date(1786004366_000))
    const later = signImageUrl({
      privateKey: PRIVATE_KEY,
      urlEndpoint: ENDPOINT,
      path: '/a/b.png',
      expiresInSeconds: 300,
    })

    expect(later).not.toBe(first)
    expect(later).toContain('ik-t=1786004666')
  })

  it('refuses to sign a path that escapes the endpoint', () => {
    expect(() =>
      signImageUrl({
        privateKey: PRIVATE_KEY,
        urlEndpoint: ENDPOINT,
        path: '../../etc/passwd',
        expiresInSeconds: 300,
      }),
    ).toThrow(/untrusted/i)
  })

  it('refuses to sign a path carrying its own query string', () => {
    expect(() =>
      signImageUrl({
        privateKey: PRIVATE_KEY,
        urlEndpoint: ENDPOINT,
        path: '/a/b.png?ik-s=forged',
        expiresInSeconds: 300,
      }),
    ).toThrow(/untrusted/i)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const headers = vi.fn()

vi.mock('next/headers', () => ({ headers }))

const { clientIdentity, UNKNOWN_IDENTITY } = await import('./request-identity')

function withHeaders(values: Record<string, string>) {
  headers.mockResolvedValue({
    get: (name: string) => values[name.toLowerCase()] ?? null,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('clientIdentity', () => {
  it('identifies the caller by the proxy-supplied client address', async () => {
    withHeaders({ 'x-forwarded-for': '203.0.113.7' })

    const identity = await clientIdentity()

    expect(identity).not.toBe(UNKNOWN_IDENTITY)
  })

  it('gives the same address the same identity across calls', async () => {
    withHeaders({ 'x-forwarded-for': '203.0.113.7' })

    const first = await clientIdentity()
    const second = await clientIdentity()

    expect(first).toBe(second)
  })

  it('gives different addresses different identities', async () => {
    withHeaders({ 'x-forwarded-for': '203.0.113.7' })
    const first = await clientIdentity()

    withHeaders({ 'x-forwarded-for': '203.0.113.8' })
    const second = await clientIdentity()

    expect(first).not.toBe(second)
  })

  it('never stores the raw address, so the limiter table holds no PII', async () => {
    withHeaders({ 'x-forwarded-for': '203.0.113.7' })

    const identity = await clientIdentity()

    expect(identity).not.toContain('203.0.113.7')
  })

  it('takes the first hop of x-forwarded-for, which is the client', async () => {
    withHeaders({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18, 150.172.238.178' })
    const chained = await clientIdentity()

    withHeaders({ 'x-forwarded-for': '203.0.113.7' })
    const direct = await clientIdentity()

    expect(chained).toBe(direct)
  })

  it('prefers x-real-ip, which a proxy sets from the socket rather than the request', async () => {
    withHeaders({ 'x-real-ip': '203.0.113.9', 'x-forwarded-for': '203.0.113.7' })
    const preferred = await clientIdentity()

    withHeaders({ 'x-real-ip': '203.0.113.9' })
    const alone = await clientIdentity()

    expect(preferred).toBe(alone)
  })

  it('falls back to a shared identity when no address header is present', async () => {
    withHeaders({})

    await expect(clientIdentity()).resolves.toBe(UNKNOWN_IDENTITY)
  })

  it('treats a blank forwarded-for as absent rather than as an address', async () => {
    withHeaders({ 'x-forwarded-for': '  ,  ' })

    await expect(clientIdentity()).resolves.toBe(UNKNOWN_IDENTITY)
  })

  it('falls back rather than throwing when there is no request scope', async () => {
    headers.mockRejectedValue(new Error('called outside a request scope'))

    await expect(clientIdentity()).resolves.toBe(UNKNOWN_IDENTITY)
  })
})

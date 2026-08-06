import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
const clientIdentity = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }))
vi.mock('./request-identity', () => ({ clientIdentity, UNKNOWN_IDENTITY: 'anon' }))

const { consumeRateLimit, withRateLimit, RATE_LIMITS } = await import('./rate-limit')
const { ok } = await import('@/lib/api/result')

beforeEach(() => {
  vi.clearAllMocks()
  clientIdentity.mockResolvedValue('ip:abc123')
})

describe('consumeRateLimit', () => {
  it('allows the call while the identity is under its limit', async () => {
    rpc.mockResolvedValue({ data: true, error: null })

    await expect(consumeRateLimit('booking', 'ip:abc123')).resolves.toBe(true)
  })

  it('refuses the call once the identity has spent its limit', async () => {
    rpc.mockResolvedValue({ data: false, error: null })

    await expect(consumeRateLimit('booking', 'ip:abc123')).resolves.toBe(false)
  })

  it('namespaces the counter by bucket so browsing cannot exhaust booking', async () => {
    rpc.mockResolvedValue({ data: true, error: null })

    await consumeRateLimit('availability', 'ip:abc123')
    const availabilityIdentity = rpc.mock.calls[0][1].p_identity

    rpc.mockClear()
    await consumeRateLimit('booking', 'ip:abc123')
    const bookingIdentity = rpc.mock.calls[0][1].p_identity

    expect(availabilityIdentity).not.toBe(bookingIdentity)
  })

  it('sends the bucket policy rather than relying on the database default', async () => {
    rpc.mockResolvedValue({ data: true, error: null })

    await consumeRateLimit('booking', 'ip:abc123')

    expect(rpc).toHaveBeenCalledWith(
      'record_lookup_attempt',
      expect.objectContaining({
        p_limit: RATE_LIMITS.booking.limit,
        p_window: RATE_LIMITS.booking.window,
      }),
    )
  })

  // A limiter that waves callers through when its own counter is broken is not
  // a limiter — an attacker who can break the counter gets unlimited attempts.
  it('fails closed when the counter errors', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'function does not exist' } })

    await expect(consumeRateLimit('booking', 'ip:abc123')).resolves.toBe(false)
  })

  it('fails closed when the counter returns nothing', async () => {
    rpc.mockResolvedValue({ data: null, error: null })

    await expect(consumeRateLimit('booking', 'ip:abc123')).resolves.toBe(false)
  })

  it('fails closed when the counter throws', async () => {
    rpc.mockRejectedValue(new Error('connection refused'))

    await expect(consumeRateLimit('booking', 'ip:abc123')).resolves.toBe(false)
  })
})

describe('withRateLimit', () => {
  it('runs the action when the caller is under the limit', async () => {
    rpc.mockResolvedValue({ data: true, error: null })
    const run = vi.fn().mockResolvedValue(ok({ done: true }))

    const result = await withRateLimit('booking', run)

    expect(run).toHaveBeenCalledOnce()
    expect(result).toMatchObject({ success: true })
  })

  it('refuses without running the action once the limit is spent', async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    const run = vi.fn().mockResolvedValue(ok({ done: true }))

    const result = await withRateLimit('booking', run)

    expect(run).not.toHaveBeenCalled()
    expect(result).toMatchObject({ success: false, code: 'RATE_LIMITED' })
  })

  it('counts the caller by client address, not by anything they can choose', async () => {
    rpc.mockResolvedValue({ data: true, error: null })

    await withRateLimit('booking', () => Promise.resolve(ok(null)))

    expect(clientIdentity).toHaveBeenCalledOnce()
    expect(rpc.mock.calls[0][1].p_identity).toContain('ip:abc123')
  })

  it('gives every bucket a limit', () => {
    for (const policy of Object.values(RATE_LIMITS)) {
      expect(policy.limit).toBeGreaterThan(0)
      expect(policy.window).toMatch(/\d+ (second|minute|hour)s?/)
    }
  })
})

import { describe, expect, it } from 'vitest'
import { callPendingRpc } from './rpc'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/**
 * Stands in for the real client in the one respect that matters here: in
 * supabase-js `rpc` is a prototype method that reaches for `this.rest`. A
 * helper that hands the method around detached throws
 * "Cannot read properties of undefined (reading 'rest')" — which
 * consumeRateLimit swallows into a fail-closed `false`, so every first-time
 * checkout is told it is rate limited.
 */
class FakeSupabaseClient {
  readonly rest = { calls: [] as Array<{ name: string; args: unknown }> }

  rpc(name: string, args: unknown) {
    this.rest.calls.push({ name, args })

    return Promise.resolve({ data: true, error: null })
  }
}

function fakeClient() {
  const client = new FakeSupabaseClient()

  return { client, asSupabase: client as unknown as SupabaseClient<Database> }
}

describe('callPendingRpc', () => {
  it('calls rpc with the client still bound as its receiver', async () => {
    // Arrange
    const { client, asSupabase } = fakeClient()

    // Act
    const result = await callPendingRpc<'record_lookup_attempt', boolean>(
      asSupabase,
      'record_lookup_attempt',
      { p_identity: 'booking:test', p_limit: 10, p_window: '15 minutes' },
    )

    // Assert
    expect(result).toEqual({ data: true, error: null })
    expect(client.rest.calls).toEqual([
      {
        name: 'record_lookup_attempt',
        args: { p_identity: 'booking:test', p_limit: 10, p_window: '15 minutes' },
      },
    ])
  })

  it('does not throw when the client method depends on instance state', async () => {
    // Arrange
    const { asSupabase } = fakeClient()

    // Act & Assert
    await expect(
      callPendingRpc(asSupabase, 'cancel_booking', { p_reference: 'ABC123', p_email: 'a@b.co' }),
    ).resolves.toBeDefined()
  })
})

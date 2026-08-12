import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/**
 * Typed access to RPCs that exist in the migrations but not yet in the
 * generated types.
 *
 * `database.types.ts` is generated from a live database. The functions added by
 * the 20260102* migrations are therefore absent until `pnpm db:types:remote`
 * runs against the hosted project after `pnpm db:push`. Hand-editing the
 * generated file would be overwritten by the next generation, so the gap is
 * bridged here instead — one file, one cast, deletable in a single step.
 *
 * DELETE THIS FILE once the types are regenerated and `client.rpc(...)` accepts
 * these names directly.
 */

export type PendingRpcArgs = {
  cancel_booking: { p_reference: string; p_email: string }
  reschedule_booking: {
    p_reference: string
    p_email: string
    p_courts: readonly unknown[]
  }
  record_lookup_attempt: { p_identity: string; p_limit?: number; p_window?: string }
  report_club_totals: { p_club_id: string; p_from: string; p_to: string }
  report_court_revenue: { p_club_id: string; p_from: string; p_to: string }
  report_product_sales: { p_club_id: string; p_from: string; p_to: string }
}

export type RpcResult<T> = { data: T | null; error: { message: string; code?: string } | null }

/**
 * Calls a migration-defined RPC that the generated types do not know about yet.
 * The name is constrained to the map above, so a typo is still a type error.
 */
export async function callPendingRpc<K extends keyof PendingRpcArgs, T>(
  client: SupabaseClient<Database>,
  name: K,
  args: PendingRpcArgs[K],
): Promise<RpcResult<T>> {
  // Bound, not detached: `rpc` is a prototype method that reads `this.rest`,
  // so calling it as a bare function throws before the request is ever made.
  const rpc = client.rpc.bind(client) as unknown as (n: string, a: unknown) => Promise<RpcResult<T>>

  return rpc(name, args)
}

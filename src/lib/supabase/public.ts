import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { readPublicEnv } from '@/lib/env'
import type { Database } from './database.types'

/**
 * Anon-key client with no session and no cookies. Runs as anon, so RLS still
 * applies — it can read only what `*_public_read` exposes to everyone.
 *
 * Exists because createSupabaseServerClient() reads `cookies()`, which Next.js
 * forbids inside an unstable_cache scope: request state cannot be captured in
 * a response shared across visitors. Use this for reads that are identical for
 * every visitor and therefore cacheable; use the cookie-bound client whenever
 * the answer depends on who is asking.
 */
export function createSupabasePublicClient() {
  const env = readPublicEnv()

  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

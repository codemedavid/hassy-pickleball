import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { readServerEnv } from '@/lib/env'
import type { Database } from './database.types'

/**
 * Service-role client. BYPASSES RLS.
 *
 * The `server-only` import makes the build fail if a Client Component ever
 * reaches this module. Use it only where a request genuinely must act outside
 * any user's permissions — seeding, webhooks, admin reconciliation jobs.
 * Prefer createSupabaseServerClient() everywhere else.
 */
export function createSupabaseAdminClient() {
  const env = readServerEnv()

  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

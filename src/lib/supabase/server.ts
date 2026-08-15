import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { readPublicEnv } from '@/lib/env'
import type { Database } from './database.types'

/**
 * Next.js has no error code for this, only the message it throws when a Server
 * Component writes a cookie. Matched on the stable half of that sentence.
 */
function isReadOnlyCookieStore(cause: unknown): boolean {
  return cause instanceof Error && cause.message.includes('can only be modified in a Server Action')
}

/**
 * Anon-key client bound to the request's cookies. Runs as the signed-in user
 * (or anon), so RLS still applies. Use this for anything user-facing.
 */
export async function createSupabaseServerClient() {
  const env = readPublicEnv()
  const cookieStore = await cookies()

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch (cause) {
            // A Server Component's cookie store is read-only. That write was
            // never going to land and does not need to: the proxy refreshes
            // the session before the render. Anything else means a session was
            // dropped, which surfaces as an unexplained bounce to sign-in, so
            // it is reported rather than swallowed. Never rethrown either way —
            // a failed write must not take the page down with it.
            if (!isReadOnlyCookieStore(cause)) {
              console.error('Could not persist the Supabase session cookie', { cause })
            }
          }
        },
      },
    },
  )
}

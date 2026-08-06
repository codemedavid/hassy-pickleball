import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { readPublicEnv } from '@/lib/env'

/**
 * Refreshes the Supabase auth cookie on every request so Server Components
 * never see an expired session. Route protection itself lives in the /admin
 * layout, which can read the staff role.
 *
 * Named `proxy` in src/proxy.ts — Next.js 16 renamed the middleware entry point.
 */
/**
 * Supabase writes its session to `sb-<ref>-auth-token`. A caller with no such
 * cookie has no session to refresh, and getUser() is a network round trip to
 * the auth server — paid on every request, including anonymous ones, if we do
 * not check first.
 */
function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) => cookie.name.startsWith('sb-'))
}

export async function proxy(request: NextRequest) {
  if (!hasSessionCookie(request)) {
    return NextResponse.next({ request })
  }

  const env = readPublicEnv()
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}

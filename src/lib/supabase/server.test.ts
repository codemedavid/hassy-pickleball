import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The server client's cookie writes.
 *
 * Server Components render with read-only cookies, so a failed write there is
 * expected and ignored — middleware has already refreshed the session. Every
 * other failure means a session was silently dropped, which is what turns an
 * auth bug into an unexplained redirect. Those must not be swallowed quietly.
 */

const cookieStore = { getAll: vi.fn(() => []), set: vi.fn() }
const capturedOptions = { current: null as { cookies: CookieAdapter } | null }

type CookieAdapter = {
  getAll: () => unknown
  setAll: (cookies: readonly { name: string; value: string; options?: unknown }[]) => void
}

vi.mock('next/headers', () => ({ cookies: () => Promise.resolve(cookieStore) }))
vi.mock('@supabase/ssr', () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: CookieAdapter }) => {
    capturedOptions.current = options

    return {}
  },
}))
vi.mock('@/lib/env', () => ({
  readPublicEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  }),
}))

const { createSupabaseServerClient } = await import('./server')

const SESSION_COOKIE = [{ name: 'sb-project-auth-token', value: 'token', options: {} }]

/** What Next.js throws when a Server Component tries to write a cookie. */
const READ_ONLY = new Error(
  'Cookies can only be modified in a Server Action or Route Handler. Read more: ...',
)

async function setAllWith(failure: Error | null) {
  cookieStore.set.mockImplementation(() => {
    if (failure) throw failure
  })

  await createSupabaseServerClient()
  capturedOptions.current?.cookies.setAll(SESSION_COOKIE)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('createSupabaseServerClient', () => {
  it('writes the session cookies it is handed', async () => {
    await setAllWith(null)

    expect(cookieStore.set).toHaveBeenCalledWith('sb-project-auth-token', 'token', {})
  })

  it('stays quiet about the read-only cookie store of a Server Component', async () => {
    await setAllWith(READ_ONLY)

    expect(console.error).not.toHaveBeenCalled()
  })

  it('reports a dropped session rather than swallowing it', async () => {
    await setAllWith(new Error('cookie jar exploded'))

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Could not persist the Supabase session cookie'),
      expect.anything(),
    )
  })

  it('keeps rendering after a failed write, whatever the cause', async () => {
    await expect(setAllWith(new Error('cookie jar exploded'))).resolves.not.toThrow()
  })
})

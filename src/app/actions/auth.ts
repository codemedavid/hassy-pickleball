'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { err, ok, type Err, type Result } from '@/lib/api/result'

const credentialsSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
})

/**
 * Staff sign-in with an email address and password.
 *
 * Every credential failure returns the same message, so this cannot be used to
 * work out which addresses belong to staff. Authorisation is decided later by
 * getCurrentStaff() and by RLS, not here — a signed-in user with no staff row
 * is sent straight back by the /admin layout.
 *
 * Returns only on failure: success redirects, and redirect() throws.
 */
export async function signInWithEmailAndPassword(input: unknown): Promise<Err> {
  const parsed = credentialsSchema.safeParse(input)

  if (!parsed.success) {
    return err(parsed.error.issues[0].message, 'INVALID')
  }

  const client = await createSupabaseServerClient()
  const { error } = await client.auth.signInWithPassword(parsed.data)

  if (error) {
    return err('Email or password is incorrect', 'AUTH_ERROR')
  }

  redirect('/admin')
}

export async function signOut(): Promise<Result<{ signedOut: true }>> {
  const client = await createSupabaseServerClient()
  const { error } = await client.auth.signOut()

  if (error) {
    return err('Could not sign out', 'AUTH_ERROR')
  }

  return ok({ signedOut: true })
}

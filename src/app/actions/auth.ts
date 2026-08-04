'use server'

import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { err, ok, type Result } from '@/lib/api/result'

const signInSchema = z.object({ email: z.email() })

/**
 * Staff sign-in by magic link.
 *
 * Succeeds with the same message whether or not the address belongs to a staff
 * member, so this cannot be used to enumerate staff emails. Authorisation is
 * decided later by getCurrentStaff() and by RLS, not here.
 */
export async function signInWithMagicLink(input: unknown): Promise<Result<{ sent: true }>> {
  const parsed = signInSchema.safeParse(input)

  if (!parsed.success) {
    return err('Enter a valid email address', 'INVALID')
  }

  const client = await createSupabaseServerClient()

  const { error } = await client.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: false },
  })

  if (error) {
    return err('We could not send that link right now', 'AUTH_ERROR')
  }

  return ok({ sent: true })
}

export async function signOut(): Promise<Result<{ signedOut: true }>> {
  const client = await createSupabaseServerClient()
  const { error } = await client.auth.signOut()

  if (error) {
    return err('Could not sign out', 'AUTH_ERROR')
  }

  return ok({ signedOut: true })
}

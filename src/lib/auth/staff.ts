import 'server-only'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Enums } from '@/lib/repositories/rows'

export type StaffMember = {
  readonly id: string
  readonly userId: string
  readonly clubId: string
  readonly role: Enums['staff_role']
  readonly fullName: string
}

/**
 * The signed-in user's staff record, or null.
 *
 * Uses the anon-key server client so RLS applies: the `staff_self_read` policy
 * is what actually decides whether this row is visible. A user with no staff
 * row gets null, which the /admin layout turns into a redirect.
 *
 * Always reads the user via getUser(), never getSession() — getSession() trusts
 * the cookie without revalidating it against the auth server.
 */
export async function getCurrentStaff(): Promise<StaffMember | null> {
  const client = await createSupabaseServerClient()

  const {
    data: { user },
  } = await client.auth.getUser()

  if (!user) {
    return null
  }

  const { data, error } = await client
    .from('staff')
    .select('id, user_id, club_id, role, full_name')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return {
    id: data.id,
    userId: data.user_id,
    clubId: data.club_id,
    role: data.role,
    fullName: data.full_name,
  }
}

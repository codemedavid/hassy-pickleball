import 'server-only'

import { err, ok, type Result } from '@/lib/api/result'
import { getCurrentStaff, type StaffMember } from '@/lib/auth/staff'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { RepositoryError, type Client } from '@/lib/repositories/support'

/**
 * The gate every admin mutation runs through.
 *
 * Two jobs. First, it establishes who is acting: the staff record comes from
 * the session, never from the request, so the identity stamped on a payment or
 * a block cannot be chosen by the caller. Second, it uses the anon-key server
 * client rather than the service-role one, so RLS is still the boundary — this
 * check decides what the UI offers, the database decides what is allowed.
 */

export type StaffContext = {
  readonly staff: StaffMember
  readonly client: Client
}

/** Exclusion-constraint violation: the slot is already taken. */
const SLOT_CONFLICT = '23P01'

const CONFLICT_MESSAGE = 'That clashes with a booking or block already on the calendar'
const FAILURE_MESSAGE = 'We could not save that change. Please try again.'

export async function withStaff<T>(run: (context: StaffContext) => Promise<T>): Promise<Result<T>> {
  const staff = await getCurrentStaff()

  if (!staff) {
    return err('You need to be signed in as staff to do that', 'UNAUTHORIZED')
  }

  const client = (await createSupabaseServerClient()) as unknown as Client

  try {
    return ok(await run({ staff, client }))
  } catch (cause) {
    if (cause instanceof RepositoryError && cause.code === SLOT_CONFLICT) {
      return err(CONFLICT_MESSAGE, 'CONFLICT')
    }

    // Database messages name relations, columns, and constraints. Supabase logs
    // the detail server-side; the staff member gets something actionable.
    return err(FAILURE_MESSAGE, 'DB_ERROR')
  }
}

/** Shared shape for a rejected payload, so every action fails the same way. */
export function invalid(message: string): Result<never> {
  return err(message, 'INVALID')
}

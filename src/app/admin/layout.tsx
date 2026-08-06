import { redirect } from 'next/navigation'
import { AdminNav } from '@/features/admin/ui/admin-nav'
import { getCurrentStaff } from '@/lib/auth/staff'
import { findClubById } from '@/lib/repositories/clubs'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Server-side gate for the whole admin console. Rendering is blocked here
 * rather than in middleware so the staff role is read with RLS in force.
 * The database policies remain the real boundary — this only decides what UI
 * gets rendered.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentStaff()

  if (!staff) {
    redirect('/staff/sign-in')
  }

  // The club name heads the console; a missing club is not worth blocking the
  // whole shell over, so the chrome degrades to a generic label.
  const client = await createSupabaseServerClient()
  const club = await findClubById(client, staff.clubId)

  return (
    <>
      <AdminNav clubName={club?.name ?? 'Admin console'} staffName={staff.fullName} />
      {children}
    </>
  )
}

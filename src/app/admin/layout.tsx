import { redirect } from 'next/navigation'
import { AdminNav } from '@/features/admin/ui/admin-nav'
import { NoStaffNotice } from '@/features/admin/ui/no-staff-notice'
import { getStaffAccess } from '@/lib/auth/staff'
import { findClubById } from '@/lib/repositories/clubs'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Server-side gate for the whole admin console. Rendering is blocked here
 * rather than in middleware so the staff role is read with RLS in force.
 * The database policies remain the real boundary — this only decides what UI
 * gets rendered.
 *
 * Three outcomes, not two. Redirecting a signed-in user who simply has no staff
 * row sent them back to a sign-in form they had just completed successfully,
 * which looks like a rejected password and loops. They are told instead.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await getStaffAccess()

  if (access.status === 'anonymous') {
    redirect('/staff/sign-in')
  }

  if (access.status === 'not-staff') {
    return <NoStaffNotice />
  }

  // The club name heads the console; a missing club is not worth blocking the
  // whole shell over, so the chrome degrades to a generic label.
  const client = await createSupabaseServerClient()
  const club = await findClubById(client, access.staff.clubId)

  return (
    <>
      <AdminNav clubName={club?.name ?? 'Admin console'} staffName={access.staff.fullName} />
      {children}
    </>
  )
}

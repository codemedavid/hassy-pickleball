import { redirect } from 'next/navigation'
import { getCurrentStaff } from '@/lib/auth/staff'

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

  return <>{children}</>
}

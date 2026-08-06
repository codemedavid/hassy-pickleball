import { redirect } from 'next/navigation'
import { signInWithMagicLink } from '@/app/actions/auth'
import { StaffSignInForm } from '@/features/admin/ui/staff-sign-in-form'
import { getCurrentStaff } from '@/lib/auth/staff'

/**
 * Where the admin layout sends anyone without a staff session.
 *
 * Someone who is already staff is bounced straight to the console rather than
 * being asked to sign in again.
 */
export default async function StaffSignInPage() {
  if (await getCurrentStaff()) {
    redirect('/admin')
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col justify-center px-6 py-16">
      <h1 className="mb-2 font-[family-name:var(--font-display)] text-[28px] font-bold tracking-[-0.03em]">
        Staff sign-in
      </h1>
      <p className="mt-0 mb-6 text-[14px] text-muted">
        We’ll email you a link that signs you into the admin console.
      </p>

      <div className="rounded-[14px] border border-line bg-surface px-6 py-6">
        <StaffSignInForm onSubmit={signInWithMagicLink} />
      </div>
    </main>
  )
}

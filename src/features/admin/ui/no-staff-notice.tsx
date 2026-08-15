import Link from 'next/link'

/**
 * What a signed-in user without a staff row sees instead of the console.
 *
 * The sign-in page is offered as a link rather than a redirect: arriving there
 * on your own is a choice to use another account, whereas being sent there
 * after a successful sign-in reads as the password having failed.
 *
 * No staff detail is named. The caller is signed in but unrecognised by this
 * club, and telling them which club or who to ask would answer a question they
 * have not been authorised to ask.
 */

const LINK_CLASS = 'text-[14px] font-bold text-navy underline underline-offset-4'

export function NoStaffNotice() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col justify-center px-6 py-16">
      <div className="rounded-[14px] border border-line bg-surface px-6 py-7">
        <h1 className="mt-0 mb-2 font-[family-name:var(--font-display)] text-[24px] font-bold tracking-[-0.03em]">
          This account has no admin access
        </h1>
        <p className="mt-0 mb-6 text-[14px] text-muted">
          You are signed in, but the account you used is not set up as staff for this club. Ask an
          administrator to add it, or sign in with the account that has access.
        </p>

        <div className="flex flex-col gap-3">
          <Link href="/staff/sign-in" className={LINK_CLASS}>
            Sign in with a different account
          </Link>
          <Link href="/" className={LINK_CLASS}>
            Back to the customer site
          </Link>
        </div>
      </div>
    </main>
  )
}

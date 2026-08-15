# TDD evidence: the admin sign-in bounce

**Source plan**: produced inline during the `/ecc:plan` run of 2026-08-15; no `*.plan.md` artifact was written.
**Branch**: `feat/admin-mobile`

## The defect

Signing in at `/staff/sign-in` returned the user to `/staff/sign-in`, with no error shown.

The credentials were never the problem. `admin@hassypickleball.com` authenticated
successfully every time — its `auth.users.last_sign_in_at` advanced with each attempt — but
it had **no row in `staff`**. The only staff row belonged to a different account,
`admin@pickleball.com`. So:

```
sign in → session cookie set → redirect('/admin')
        → AdminLayout: getCurrentStaff() → null (no staff row)
        → redirect('/staff/sign-in')      ← silent, indistinguishable from a rejected password
```

The gate itself was sound. Verified before changing anything: a session minted for a user
*with* a staff row rendered `GET /admin` → `200`, so the cookie write, the proxy refresh, the
`staff_self_read` RLS policy and the layout all worked. The bug was one missing row plus a
redirect that could not tell "not signed in" from "signed in, not staff".

## User journeys

1. As a signed-in user without staff access, I want to be told my account has no admin access,
   so that I stop looping through a login form I have already completed.
2. As a visitor with no session, I want to be sent to the staff sign-in page.
3. As a staff member, I want the console, headed by my club's name.

## Task report

### Phase 1 — restore the missing staff row (data, not code)

Inserted a staff row for `3ca3ae2d-baf0-452a-8991-a14cb2bb771f` against club
`00000000-0000-4000-8000-000000000001` (Baseline Pickleball Club), role `admin`, active.

Verified end to end against the running dev server:

```
signInWithPassword => OK, user admin@hassypickleball.com
GET /admin => 200 (rendered)
console shows club/staff => true / true
```

**Not covered**: this was applied as a one-off insert. No seed or migration provisions an
admin account for a fresh environment — a new deployment will reproduce the same dead end.

### Phase 2 — separate "not signed in" from "signed in, not staff"

`getStaffAccess()` returns `anonymous | not-staff | staff`. The layout redirects only on
`anonymous`. `getCurrentStaff()` is kept as a derivation of it, so the mutation gates in
`withStaff()` are untouched — they fail the same way for both no-access cases.

- RED: `npx vitest run src/lib/auth/staff.test.ts src/app/admin/layout.test.tsx`
  → `Tests 11 failed | 7 passed (18)` — `TypeError: getStaffAccess is not a function`
- GREEN: same command → `Tests 18 passed (18)`

One RED failure was a faulty stub rather than a real defect: the mocked `redirect()` returned
instead of throwing, letting the layout run past the branch Next.js would have halted. The
stub was corrected to throw; the assertion was not weakened.

Verified live by deactivating the staff row (`is_active = false`) and re-running the flow:
`GET /admin` → `200` rendering the notice and the "different account" link, **not** a redirect
to sign-in. The row was restored to `is_active = true` immediately after.

### Phase 2b — stop swallowing failed cookie writes

`setAll`'s `catch {}` in `src/lib/supabase/server.ts` ignored every failure. It did not cause
this bug, but it is why the cause had to be found with a database query: a genuinely dropped
session would have looked identical. Only the read-only cookie store of a Server Component is
expected there now; anything else is logged. Still never rethrown.

- RED: `npx vitest run src/lib/supabase/server.test.ts` → `Tests 1 failed | 3 passed (4)`
- GREEN: same command → `Tests 4 passed (4)`

## Test specification

| # | What is guaranteed | Test | Type | Result |
|---|---|---|---|---|
| 1 | An anonymous visitor is sent to the staff sign-in page | `src/app/admin/layout.test.tsx:sends an anonymous visitor to the staff sign-in page` | unit | PASS |
| 2 | A signed-in non-staff user is **not** redirected back to sign-in | `src/app/admin/layout.test.tsx:does not bounce a signed-in user who is not staff back to sign-in` | unit | PASS |
| 3 | That user is told why the console is closed to them | `src/app/admin/layout.test.tsx:tells a signed-in non-staff user why the console is closed` | unit | PASS |
| 4 | That user is offered a route to another account | `src/app/admin/layout.test.tsx:offers a signed-in non-staff user a way to try another account` | unit | PASS |
| 5 | That user gets neither the console chrome nor its children | `src/app/admin/layout.test.tsx:withholds the console from a signed-in non-staff user` | unit | PASS |
| 6 | A staff member gets the console headed by their club | `src/app/admin/layout.test.tsx:renders the console for a staff member` | unit | PASS |
| 7 | A missing club degrades to a generic label, not a blocked shell | `src/app/admin/layout.test.tsx:degrades to a generic label rather than blocking on a missing club` | unit | PASS |
| 8 | Anonymous, not-staff and staff are three distinct answers | `src/lib/auth/staff.test.ts:describe getStaffAccess` (4 cases) | unit | PASS |
| 9 | A failed staff lookup fails closed to no access | `src/lib/auth/staff.test.ts:fails closed to not-staff when the lookup errors` | unit | PASS |
| 10 | A Server Component's read-only cookie store stays quiet | `src/lib/supabase/server.test.ts:stays quiet about the read-only cookie store of a Server Component` | unit | PASS |
| 11 | Any other dropped session cookie is reported | `src/lib/supabase/server.test.ts:reports a dropped session rather than swallowing it` | unit | PASS |
| 12 | A failed cookie write never takes the page down | `src/lib/supabase/server.test.ts:keeps rendering after a failed write, whatever the cause` | unit | PASS |

## Coverage and known gaps

`npm run test:coverage` → **99 files, 1098 tests passed**; all files 95.7% statements,
89.49% branches, 96.61% functions, 97.23% lines. `tsc --noEmit` and `eslint` clean.

Gaps, stated rather than papered over:

- **No seed/migration for the admin account** (see Phase 1). The next fresh environment hits
  the same wall.
- **No E2E test** drives a browser through sign-in → console. The flow was verified against
  the running dev server with a scripted HTTP client, which is evidence but not a regression
  guard.
- **No test asserts the sign-in action's `Set-Cookie`.** Attempting to invoke the server
  action over HTTP returned 404 on the action id, so the cookie write was proved indirectly,
  by minting a session and reaching `/admin` with it.
- **One unexplained suite failure** was observed in a single `npm test` run while adding
  `server.test.ts`; it did not reproduce in three subsequent full runs and was not identified.

## Merge evidence

| Stage | Commit | Evidence |
|---|---|---|
| RED | `6326cfa` test: add reproducer for the admin sign-in bounce | 11 failed \| 7 passed — `getStaffAccess is not a function` |
| GREEN | `b910ca4` fix: tell a signed-in non-staff user why the console is closed | 98 files, 1094 tests passed; typecheck + lint clean |
| REFACTOR | `96a4d8a` refactor: report a dropped session cookie instead of swallowing it | 99 files, 1098 tests passed; typecheck + lint clean |

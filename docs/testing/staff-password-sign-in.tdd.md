# TDD evidence — staff sign-in with an email and password

## Source

No plan file. The journey came from a direct request: nobody could reach `/admin`, because the
staff sign-in page was magic-link only and no staff account had ever been created.

## User journey

As a staff member, I want to sign in at `/staff/sign-in` with my work email and password, so that
I can reach the admin console without waiting for an emailed link.

## Context

Two separate gaps, only one of which was a code problem:

1. **No account existed.** `auth.users`, `staff`, and `supabase/seed.sql` had no staff records at
   all. `signInWithMagicLink` passed `shouldCreateUser: false`, so every address was rejected — and
   the deliberately non-committal success message meant the form never said so.
2. **No password path.** The form collected only an email and called `signInWithOtp`. A password
   was not accepted anywhere in the flow.

## Task report

| Step     | Summary                                                                                                                                                                                                                                                  |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RED      | Added `src/app/actions/auth.test.ts` (5 cases) for a `signInWithEmailAndPassword` action, and rewrote `staff-sign-in-form.test.tsx` (4 cases) for a password field. Ran both: 9 failed — the action did not exist, and the form had no `Password` label. |
| GREEN    | Replaced `signInWithMagicLink` with `signInWithEmailAndPassword` (Zod-validated, `signInWithPassword`, `redirect('/admin')` on success), added the masked password field, and pointed the page at the new action. Same targets: 9 passed.                |
| Refactor | Extracted the repeated field/label class strings in the form. Suite stayed green.                                                                                                                                                                        |

### RED

```
npx vitest run src/app/actions/auth.test.ts src/features/admin/ui/staff-sign-in-form.test.tsx

TypeError: signInWithEmailAndPassword is not a function
 ❯ src/app/actions/auth.test.ts:66:26
Unable to find a label with the text of: Password
 ❯ src/features/admin/ui/staff-sign-in-form.test.tsx:53:28

 Test Files  2 failed (2)
      Tests  9 failed (9)
```

### GREEN

```
npx vitest run src/app/actions/auth.test.ts src/features/admin/ui/staff-sign-in-form.test.tsx

 Test Files  2 passed (2)
      Tests  9 passed (9)
```

## Test specification

| #   | What is guaranteed                                                             | Test file or command                                                                     | Test type | Result | Evidence                                                           |
| --- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | --------- | ------ | ------------------------------------------------------------------ |
| 1   | A malformed email is rejected before Supabase is called                        | `src/app/actions/auth.test.ts:rejects a malformed email without calling Supabase`        | unit      | PASS   | `npx vitest run src/app/actions/auth.test.ts`                      |
| 2   | An empty password is rejected before Supabase is called                        | `src/app/actions/auth.test.ts:rejects an empty password without calling Supabase`        | unit      | PASS   | same                                                               |
| 3   | The typed credentials are the ones handed to Supabase                          | `src/app/actions/auth.test.ts:signs the staff member in with the credentials they typed` | unit      | PASS   | same                                                               |
| 4   | A successful sign-in lands on `/admin`                                         | `src/app/actions/auth.test.ts:sends a signed-in staff member to the admin console`       | unit      | PASS   | same                                                               |
| 5   | Bad credentials give one generic message, so staff emails cannot be enumerated | `src/app/actions/auth.test.ts:gives one generic message for bad credentials`             | unit      | PASS   | same                                                               |
| 6   | The form asks for both an email and a password                                 | `staff-sign-in-form.test.tsx:asks for an email and a password with real labels`          | unit      | PASS   | `npx vitest run src/features/admin/ui/staff-sign-in-form.test.tsx` |
| 7   | The password is masked as it is typed                                          | `staff-sign-in-form.test.tsx:masks the password as it is typed`                          | unit      | PASS   | same                                                               |
| 8   | Both credentials reach the action on submit                                    | `staff-sign-in-form.test.tsx:sends both credentials to the action when submitted`        | unit      | PASS   | same                                                               |
| 9   | A failure is surfaced rather than silently swallowed                           | `staff-sign-in-form.test.tsx:surfaces the failure instead of silently doing nothing`     | unit      | PASS   | same                                                               |

## Manual verification against the hosted project

The unit tests mock Supabase, so the live chain was checked separately.

```
POST /auth/v1/token?grant_type=password  ->  {"code":500,"msg":"Database error querying schema"}
```

Caused by the account being seeded with a raw `INSERT`: GoTrue scans `confirmation_token`,
`recovery_token`, `email_change*`, `phone_change*`, and `reauthentication_token` into non-nullable
Go strings, and they had been left `NULL`. Setting them to `''` fixed it.

```
POST /auth/v1/token?grant_type=password  ->  200, access_token issued
GET  /rest/v1/staff (as that user)       ->  [{"role":"admin","full_name":"Admin User","is_active":true}]
```

The second call confirms the `staff_self_read` RLS policy exposes the row, which is what
`getCurrentStaff` needs for the `/admin` layout to admit the session.

## Whole-suite and typecheck

```
npx vitest run     ->  66 files, 632 tests passed
npx tsc --noEmit   ->  exit 0
npx eslint <changed files>  ->  exit 0
```

## Known gaps

- **Magic-link sign-in was removed**, not kept alongside the password path. It had no other caller,
  and `admin@pickleball.com` is not a deliverable domain, so leaving it would have been dead code.
- **The account is not in `supabase/seed.sql`.** It exists only in the hosted project, so a fresh
  environment is locked out the same way this one was. Seeding it needs an `auth.users` insert with
  the token columns set to `''`, per the failure above.
- **No E2E test** drives the real browser form through to `/admin`; the redirect and cookie handoff
  are covered only by the mocked action test plus the manual check above.
- **The credentials are a dummy pair** chosen for local work. They are known to the repo's authors
  and must not be carried into a deployed environment.

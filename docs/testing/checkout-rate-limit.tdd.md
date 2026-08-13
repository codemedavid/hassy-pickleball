# TDD evidence — "Too many requests" on a first-time checkout

## Source plan

No `*.plan.md`. Journeys were derived during this TDD run from a reported
defect: a guest reaching `/checkout` for the first time is refused with
"Too many requests. Please wait a few minutes and try again."

## User journeys

1. As a first-time guest, I want to confirm my reservation, so that I get the
   court I picked — without being told I have made too many requests.
2. As an operator, I want a refused call to say why in the server log, so that
   a broken counter is distinguishable from a genuinely exhausted one.

## Root cause

`callPendingRpc` extracted `client.rpc` into a bare variable and invoked it
detached:

```ts
const rpc = client.rpc as unknown as (n: string, a: unknown) => Promise<RpcResult<T>>
return rpc(name, args)
```

In supabase-js `rpc` is a prototype method that reads `this.rest`, so every
call threw `TypeError: Cannot read properties of undefined (reading 'rest')`
before a request left the process. `consumeRateLimit` fails closed by design
and swallowed the error, so the guest saw `RATE_LIMITED_MESSAGE`.

Blast radius — every `callPendingRpc` caller was dead the same way:
`record_lookup_attempt` (all rate limiting), `cancel_booking`,
`reschedule_booking`, `report_club_totals`, `report_court_revenue`,
`report_product_sales`.

Why the existing suite missed it: `rate-limit.test.ts` mocks the admin client
as a plain object literal `({ rpc })`, whose method has no `this` dependency.
The new `rpc.test.ts` uses a class so the receiver matters.

Field evidence before the fix — `booking_lookup_attempts` held zero rows from
real attempts, proving the RPC was never executing rather than the limit being
spent.

## Task report

### 1. Bind the receiver in `callPendingRpc`

Added a reproducer, then bound the method to its client.

- Command: `pnpm vitest run src/lib/supabase/rpc.test.ts`
- RED:
  ```
  FAIL src/lib/supabase/rpc.test.ts > callPendingRpc > does not throw when the
  client method depends on instance state
  Caused by: TypeError: Cannot read properties of undefined (reading 'rest')
   ❯ callPendingRpc src/lib/supabase/rpc.ts:44:10
  Tests  2 failed (2)
  ```
  The reproducer fails with the identical error seen in production.
- GREEN: `Test Files 2 passed (2) / Tests 15 passed (15)`
  (with `src/lib/security/rate-limit.test.ts`)
- Guaranteed: `callPendingRpc` invokes `rpc` with the client still bound, so a
  client whose method depends on instance state works.

### 2. Report why a refused call was refused

- Command: `pnpm vitest run src/lib/security/rate-limit.test.ts`
- RED:
  ```
  × reports the reason when the counter errors
  × reports the reason when the counter throws
  AssertionError: expected "error" to be called with arguments: [...]
  Tests  2 failed | 11 passed (13)
  ```
- GREEN: `Tests 15 passed (15)`
- Guaranteed: an errored or thrown counter logs bucket and reason, and still
  fails closed. The identity is never logged — it is the one personal field in
  scope.

### 3. Apply the pending `court_capacity` migration

`20260105000000_court_capacity.sql` was present in the repo but absent from the
remote database, which was therefore a migration behind.

- Applied via `mcp__supabase__apply_migration` (name: `court_capacity`).
- Verified the app's existing 9-argument `create_booking` call still resolves
  against the new 10-argument signature, using an empty `p_courts` probe that
  raises before any write:
  ```
  {"code":"P0001","message":"a booking needs at least one court segment"}
  HTTP 400
  ```
  Reaching the function body proves signature resolution; the raise guarantees
  no booking was created.

## Test specification

| #   | What is guaranteed                                                               | Test file or command                                                                           | Test type          | Result | Evidence                                                                           |
| --- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------ | ------ | ---------------------------------------------------------------------------------- |
| 1   | `callPendingRpc` calls `rpc` with the client still bound as its receiver         | `src/lib/supabase/rpc.test.ts:calls rpc with the client still bound as its receiver`           | unit               | PASS   | `pnpm vitest run src/lib/supabase/rpc.test.ts`                                     |
| 2   | `callPendingRpc` does not throw when the client method depends on instance state | `src/lib/supabase/rpc.test.ts:does not throw when the client method depends on instance state` | unit               | PASS   | same                                                                               |
| 3   | An errored counter is refused _and_ the reason is logged                         | `src/lib/security/rate-limit.test.ts:reports the reason when the counter errors`               | unit               | PASS   | `pnpm vitest run src/lib/security/rate-limit.test.ts`                              |
| 4   | A thrown counter is refused _and_ the reason is logged                           | `src/lib/security/rate-limit.test.ts:reports the reason when the counter throws`               | unit               | PASS   | same                                                                               |
| 5   | The limiter still fails closed on error, empty result, and throw                 | `src/lib/security/rate-limit.test.ts:fails closed when the counter …` (3 cases)                | unit               | PASS   | same                                                                               |
| 6   | The rate limiter records an attempt end-to-end against the live database         | `curl localhost:3000/api/diag-rate-limit` (temporary route, since removed)                     | manual integration | PASS   | `{"ok":true,...,"data":true,"status":200}` and a new `booking_lookup_attempts` row |

## Coverage and known gaps

- `pnpm vitest run --coverage src/lib/supabase/rpc.test.ts src/lib/security/rate-limit.test.ts`
  → `rate-limit.ts` 100% stmts / 83.33% branch / 100% funcs / 100% lines.
- Regression scope: `pnpm vitest run src/lib src/features/checkout src/features/booking src/app/checkout`
  → `Test Files 45 passed (45) / Tests 483 passed (483)`.
- `pnpm lint` clean; `tsc --noEmit` clean across the files in this change.

Known gaps, deliberate:

- **No automated E2E for the confirm-reservation click.** Proving it end to end
  writes a real booking to the shared project, so it was left to a human. The
  failure point itself is covered by row 6.
- **A temporary diagnostic route was used and removed.** `src/app/api/diag-rate-limit/route.ts`
  was an unauthenticated endpoint that wrote to the limiter table; it produced
  the decisive `TypeError` and was deleted before commit. It must not return.
- **Unrelated failing files, not touched by this work:** `src/app/loading-states.test.tsx`
  and `src/components/ui/skeleton.test.tsx` are untracked and import modules
  that do not exist (`./loading`, `./skeleton`). The `court-*` suites are a
  concurrent RED stage from commit `dc853e0`.

## Merge evidence

Checkpoint commits on `feat/admin-management`, in order:

- `0648d92` `test: add reproducer for detached rpc receiver in callPendingRpc` — RED
- `d47ba10` `fix: keep the supabase client bound when calling a pending RPC` — GREEN
- `638505a` `fix: report why the rate limit counter refused a call` — RED then GREEN

If these are squashed, the RED/GREEN summary above must be copied into the PR
body.

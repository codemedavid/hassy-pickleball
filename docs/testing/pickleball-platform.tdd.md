# TDD Evidence — Pickleball Court Booking Platform

**Source plan**: no `*.plan.md` artifact. The plan was produced inline by `/ecc:plan`
in this session and approved with "proceed". Journeys below were derived from that
plan plus the Claude Design project
`Pickleball court booking platform` (`c37c618e-e596-42d6-b3e8-02bab625d7f2`),
files `Pickleball Platform.dc.html` and `Pickleball Admin.dc.html`.

**Scope of this run**: scaffold, Supabase schema, and the domain + validation
layers. UI is explicitly out of scope — it is imported from the design project
in a later phase.

---

## User journeys

1. As a guest, I want to see which courts are free on a given day for a given
   session length, so that I can pick a time that actually exists.
2. As a guest, I want the price I am quoted to reflect the club's pricing rules
   (off-peak, prime time, weekend, membership tier), so that checkout holds no
   surprises.
3. As a guest, I want to hold several courts and add-ons in one cart, so that I
   can book a group session in a single transaction.
4. As a guest, I want to retrieve my booking with a reference and my email, so
   that I can manage it without creating an account.
5. As the club, I want two people to never be able to book the same court for
   overlapping times, no matter how simultaneous the requests are.
6. As the club, I want to block a court for maintenance and have the system
   refuse to sell that window.
7. As an operator, I want a misconfigured deployment to fail at startup rather
   than at the first customer request.

---

## Task report

### Task 1 — Scaffold

Next.js 16.3.0 (App Router, TypeScript, Turbopack, `src/`), Tailwind v4 with the
design project's tokens, Vitest + Playwright, Supabase JS/SSR, Zod.

- Command: `pnpm dlx create-next-app@latest`, then `pnpm install`
- Result: build toolchain in place; commit `43ae6ec`.
- Note: `create-next-app` rejects the directory name `Pickleball` (npm forbids
  capitals), so the app was generated as `pickleball-booking` in a temp dir and
  rsynced into the repo root.

### Task 2 — Supabase schema

Six migrations plus a seed, applied against a real Postgres 17 instance.

- Command: `pnpm exec supabase start`
- Output excerpt:
  ```
  Applying migration 20260101000000_extensions.sql...
  Applying migration 20260101000100_enums.sql...
  Applying migration 20260101000200_core_tables.sql...
  Applying migration 20260101000300_booking_tables.sql...
  Applying migration 20260101000400_functions.sql...
  Applying migration 20260101000500_rls.sql...
  Seeding data from supabase/seed.sql...
  ```
- Guarantee: the schema applies cleanly from empty and the seed loads
  (1 club, 6 courts, 8 products, 4 pricing rules — verified by query).

### Task 3 — Schema behaviour verified against live Postgres

Ad-hoc verification via `psql`, covering journeys 5, 6, and 4.

| Check | Result |
|---|---|
| Booking created, totals computed (court 600.00 + 2 paddles 400.00 = 1000.00) | PASS — `PB-4G6JVH`, `total_cents 100000` |
| Overlapping booking on the same court | PASS — rejected by `booking_courts_no_double_booking` exclusion constraint |
| Same window on a different court | PASS — accepted |
| Maintenance block over a live booking | PASS — rejected by `reject_block_over_booking()` |
| Booking over an existing maintenance block | PASS — rejected by `reject_booking_over_block()` |
| Guest lookup with correct reference + email | PASS — returns the booking |
| Cancelling a booking frees the slot for rebooking | PASS |

**Two defects found and fixed** (migration `20260101000600_harden_rpc.sql`):

1. `find_booking_by_reference` was declared `returns bookings`. A composite
   return yields **one all-null row** when nothing matches, so a lookup with the
   *wrong* email returned `rows_returned = 1` — a caller checking "did I get a
   row?" would read that as a hit. Changed to `returns setof bookings`.
2. `create_booking` is `SECURITY DEFINER` and accepts per-segment `price_cents`.
   It had been granted to `anon`, so any client could call it through PostgREST
   and name its own price. Execute is now `service_role` only, reachable solely
   through a server action that prices segments with the tested engine.

**Not yet re-verified**: the fix migration was written and committed, but
`pnpm db:reset` did not complete — the Docker daemon became unresponsive
mid-reset and has not recovered in this session. Re-running `pnpm db:reset`
followed by the checks above is an outstanding step.

### Task 4 — Domain layer (RED → GREEN)

- RED: `pnpm test` → `Test Files 4 failed (4)`, `Failed to resolve import "./time"`
  (and `./availability`, `./pricing`, `./cart`). Compile-time RED — the specs
  reference modules that did not exist. Commit `2ad6ff0`.
- GREEN: `pnpm test` → `Test Files 4 passed (4)`, `Tests 61 passed (61)`.
  Commit `12d0583`.
- One spec was corrected rather than the implementation: a 02:00–03:00 session
  *does* overlap a 02:30–03:30 booking, so the original expectation was
  arithmetically wrong. Rewritten against busy 03:00–04:00.

### Task 5 — Validation and quoting (RED → GREEN)

- RED: `pnpm test` → `Test Files 2 failed | 4 passed`, `Failed to resolve import`
  for `./schemas` and `./quote`. Commit `64315d6`.
- GREEN: `pnpm test` → `Test Files 6 passed (6)`, `Tests 81 passed (81)`.
  Commit `6afc31a`.

### Task 6 — Env guard (defect found by test)

- `pnpm test` → `FAIL src/lib/env.test.ts > throws when the URL is not a URL`.
- Cause: `new URL('localhost:54321')` parses with protocol `localhost:`, so
  `z.string().url()` accepted a host no HTTP client can reach — journey 7 was
  not actually guaranteed.
- Fix: require an `http:`/`https:` scheme. Commit `e1d389b`.
- GREEN: `Tests 95 passed (95)`.

---

## Test specification

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 1 | Time ranges are half-open, so touching sessions do not conflict | `src/lib/domain/time.test.ts:rangesOverlap` | unit | PASS |
| 2 | Club-local day/time is derived in the club's zone, not UTC | `src/lib/domain/time.test.ts:getZonedParts` | unit | PASS |
| 3 | Zoned time math stays correct across a DST transition | `src/lib/domain/time.test.ts:respects daylight saving in zones that observe it` | unit | PASS |
| 4 | Start times are only offered when the full session fits before closing | `src/lib/domain/time.test.ts:enumerateStartTimes` | unit | PASS |
| 5 | A zero slot size raises instead of looping forever | `src/lib/domain/time.test.ts:rejects a non-positive slot size` | unit | PASS |
| 6 | Overlapping busy intervals collapse into one | `src/lib/domain/availability.test.ts:mergeBusyRanges` | unit | PASS |
| 7 | Candidate starts whose session hits a booking are dropped | `src/lib/domain/availability.test.ts:findOpenStartTimes` | unit | PASS |
| 8 | Pricing rules match on court, tier, duration, local day, and local window | `src/lib/domain/pricing.test.ts:ruleApplies` | unit | PASS |
| 9 | Rules stack in priority order; fixed / amount / percent all behave | `src/lib/domain/pricing.test.ts:quoteCourtSegment` | unit | PASS |
| 10 | A quote is never negative and is always whole cents | `src/lib/domain/pricing.test.ts:never quotes a negative price` | unit | PASS |
| 11 | Cart operations return new arrays and never mutate | `src/lib/domain/cart.test.ts` | unit | PASS |
| 12 | Adding an overlapping segment for the same court is refused client-side | `src/lib/domain/cart.test.ts:rejects a segment that overlaps` | unit | PASS |
| 13 | Cart totals split courts and items and report the session window | `src/lib/domain/cart.test.ts:summariseCart` | unit | PASS |
| 14 | Booking input rejects bad email, empty name, no courts, inverted windows | `src/lib/api/schemas.test.ts:createBookingSchema` | unit | PASS |
| 15 | A client-supplied `priceCents` is stripped, never trusted | `src/lib/api/schemas.test.ts:never accepts a client-supplied price` | unit | PASS |
| 16 | Guest lookup requires a well-formed reference and an email | `src/lib/api/schemas.test.ts:bookingLookupSchema` | unit | PASS |
| 17 | Each segment is priced from its own court's base rate plus matching rules | `src/lib/api/quote.test.ts:quoteSelections` | unit | PASS |
| 18 | An unknown court id raises rather than pricing at zero | `src/lib/api/quote.test.ts:throws when a selection names a court that does not exist` | unit | PASS |
| 19 | Missing or malformed Supabase config throws at startup, naming the variable | `src/lib/env.test.ts` | unit | PASS |
| 20 | The public env reader never exposes the service-role key | `src/lib/env.test.ts:does not expose the service-role key` | unit | PASS |
| 21 | Two live bookings cannot hold one court at overlapping times | `psql` against local Postgres (see Task 3) | integration | PASS |
| 22 | A maintenance block and a live booking cannot coexist on a court | `psql` against local Postgres (see Task 3) | integration | PASS |

---

## Coverage

```
$ pnpm test:coverage
 Test Files  8 passed (8)
      Tests  95 passed (95)

Statements   : 98%    (147/150)
Branches     : 88.5%  (77/87)
Functions    : 100%   (52/52)
Lines        : 97.82% (135/138)
```

Threshold is 80% on all four axes (`vitest.config.ts`); all four clear it.
`src/lib/supabase/**` is excluded — those modules are thin client factories with
no branching logic, exercised by integration tests rather than unit tests.

## Known gaps

- **Fix migration not re-verified.** `20260101000600_harden_rpc.sql` is written
  and committed but has not been applied to a live database, because the Docker
  daemon hung during `pnpm db:reset`. Run `pnpm db:reset` and re-run the Task 3
  checks before trusting it.
- **Integration tests are ad-hoc SQL, not automated.** The Task 3 checks were run
  by hand through `psql`. They should become a Vitest integration suite against
  the local stack so they run in CI.
- **RLS not conclusively proven.** The first `anon` check ran outside a
  transaction (`SET LOCAL` warned and had no effect) and psql connects as a
  superuser, which bypasses RLS regardless. The policies are written but
  untested; the redone check is blocked on the same Docker outage.
- **No E2E tests yet.** Playwright is configured but `e2e/` is empty — the flows
  it would cover do not have UI yet.
- **Repositories and server actions not built.** Availability query, the
  create-booking action, guest lookup, cancel/reschedule, and admin mutations
  remain. `create_booking` is currently reachable only by `service_role`, so a
  server action is required before the flow works end to end.
- **Staff auth not built.** `/admin` route protection and magic-link sign-in
  remain.
- **Rate limiting.** `find_booking_by_reference` is enumerable given a valid
  reference; the server action wrapping it needs a rate limit.

## Merge evidence

RED/GREEN checkpoints, all on `main` and reachable from `HEAD`:

| Commit | Stage |
|---|---|
| `43ae6ec` | scaffold |
| `2ad6ff0` | RED — domain specs fail to resolve |
| `12d0583` | GREEN — 61/61 domain tests pass |
| `64315d6` | RED — schema/quote specs fail to resolve |
| `6afc31a` | GREEN — 81/81 tests pass |
| `e1d389b` | GREEN — 95/95 tests, env URL defect fixed, coverage 98%/88.5%/100%/97.82% |

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

| Check                                                                        | Result                                                                     |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Booking created, totals computed (court 600.00 + 2 paddles 400.00 = 1000.00) | PASS — `PB-4G6JVH`, `total_cents 100000`                                   |
| Overlapping booking on the same court                                        | PASS — rejected by `booking_courts_no_double_booking` exclusion constraint |
| Same window on a different court                                             | PASS — accepted                                                            |
| Maintenance block over a live booking                                        | PASS — rejected by `reject_block_over_booking()`                           |
| Booking over an existing maintenance block                                   | PASS — rejected by `reject_booking_over_block()`                           |
| Guest lookup with correct reference + email                                  | PASS — returns the booking                                                 |
| Cancelling a booking frees the slot for rebooking                            | PASS                                                                       |

**Two defects found and fixed** (migration `20260101000600_harden_rpc.sql`):

1. `find_booking_by_reference` was declared `returns bookings`. A composite
   return yields **one all-null row** when nothing matches, so a lookup with the
   _wrong_ email returned `rows_returned = 1` — a caller checking "did I get a
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
  _does_ overlap a 02:30–03:30 booking, so the original expectation was
  arithmetically wrong. Rewritten against busy 03:00–04:00.

### Task 5 — Validation and quoting (RED → GREEN)

- RED: `pnpm test` → `Test Files 2 failed | 4 passed`, `Failed to resolve import`
  for `./schemas` and `./quote`. Commit `64315d6`.
- GREEN: `pnpm test` → `Test Files 6 passed (6)`, `Tests 81 passed (81)`.
  Commit `6afc31a`.

### Task 6 — Row mappers and availability read model (RED → GREEN)

- RED: `pnpm test` → `Test Files 2 failed | 8 passed`, `Failed to resolve import`
  for `./mappers` and `./availability`.
- GREEN: `pnpm test` → `Test Files 10 passed (10)`, `Tests 114 passed (114)`.
- Guarantee: snake_case never escapes the repository layer; null array columns
  become `[]`; Postgres numeric-as-string becomes a number; the slot grid prices
  every start and flags availability per court.

### Task 7 — Queries, booking actions, staff auth

- `pnpm typecheck` clean, `pnpm lint` clean, `pnpm build` compiled successfully.
- Adding `queries.ts` dropped coverage to 63.95%, under the gate. Rather than
  excluding the module it was given tests using a thenable fake of the PostgREST
  builder, which asserts the query that was actually built.
- GREEN: `pnpm test` → `Test Files 11 passed (11)`, `Tests 131 passed (131)`.
- `server-only` throws outside an RSC and blocked unit-testing server modules;
  it is aliased to a stub in `vitest.config.ts`. `next build` still resolves the
  real package, so the client-import guard remains effective.
- `src/middleware.ts` → `src/proxy.ts` for the Next.js 16 rename.

### Task 8 — Env guard (defect found by test)

- `pnpm test` → `FAIL src/lib/env.test.ts > throws when the URL is not a URL`.
- Cause: `new URL('localhost:54321')` parses with protocol `localhost:`, so
  `z.string().url()` accepted a host no HTTP client can reach — journey 7 was
  not actually guaranteed.
- Fix: require an `http:`/`https:` scheme. Commit `e1d389b`.
- GREEN: `Tests 95 passed (95)`.

---

## Test specification

| #   | What is guaranteed                                                          | Test file                                                                             | Type        | Result |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------- | ------ |
| 1   | Time ranges are half-open, so touching sessions do not conflict             | `src/lib/domain/time.test.ts:rangesOverlap`                                           | unit        | PASS   |
| 2   | Club-local day/time is derived in the club's zone, not UTC                  | `src/lib/domain/time.test.ts:getZonedParts`                                           | unit        | PASS   |
| 3   | Zoned time math stays correct across a DST transition                       | `src/lib/domain/time.test.ts:respects daylight saving in zones that observe it`       | unit        | PASS   |
| 4   | Start times are only offered when the full session fits before closing      | `src/lib/domain/time.test.ts:enumerateStartTimes`                                     | unit        | PASS   |
| 5   | A zero slot size raises instead of looping forever                          | `src/lib/domain/time.test.ts:rejects a non-positive slot size`                        | unit        | PASS   |
| 6   | Overlapping busy intervals collapse into one                                | `src/lib/domain/availability.test.ts:mergeBusyRanges`                                 | unit        | PASS   |
| 7   | Candidate starts whose session hits a booking are dropped                   | `src/lib/domain/availability.test.ts:findOpenStartTimes`                              | unit        | PASS   |
| 8   | Pricing rules match on court, tier, duration, local day, and local window   | `src/lib/domain/pricing.test.ts:ruleApplies`                                          | unit        | PASS   |
| 9   | Rules stack in priority order; fixed / amount / percent all behave          | `src/lib/domain/pricing.test.ts:quoteCourtSegment`                                    | unit        | PASS   |
| 10  | A quote is never negative and is always whole cents                         | `src/lib/domain/pricing.test.ts:never quotes a negative price`                        | unit        | PASS   |
| 11  | Cart operations return new arrays and never mutate                          | `src/lib/domain/cart.test.ts`                                                         | unit        | PASS   |
| 12  | Adding an overlapping segment for the same court is refused client-side     | `src/lib/domain/cart.test.ts:rejects a segment that overlaps`                         | unit        | PASS   |
| 13  | Cart totals split courts and items and report the session window            | `src/lib/domain/cart.test.ts:summariseCart`                                           | unit        | PASS   |
| 14  | Booking input rejects bad email, empty name, no courts, inverted windows    | `src/lib/api/schemas.test.ts:createBookingSchema`                                     | unit        | PASS   |
| 15  | A client-supplied `priceCents` is stripped, never trusted                   | `src/lib/api/schemas.test.ts:never accepts a client-supplied price`                   | unit        | PASS   |
| 16  | Guest lookup requires a well-formed reference and an email                  | `src/lib/api/schemas.test.ts:bookingLookupSchema`                                     | unit        | PASS   |
| 17  | Each segment is priced from its own court's base rate plus matching rules   | `src/lib/api/quote.test.ts:quoteSelections`                                           | unit        | PASS   |
| 18  | An unknown court id raises rather than pricing at zero                      | `src/lib/api/quote.test.ts:throws when a selection names a court that does not exist` | unit        | PASS   |
| 19  | Missing or malformed Supabase config throws at startup, naming the variable | `src/lib/env.test.ts`                                                                 | unit        | PASS   |
| 20  | The public env reader never exposes the service-role key                    | `src/lib/env.test.ts:does not expose the service-role key`                            | unit        | PASS   |
| 21  | Two live bookings cannot hold one court at overlapping times                | `psql` against local Postgres (see Task 3)                                            | integration | PASS   |
| 22  | A maintenance block and a live booking cannot coexist on a court            | `psql` against local Postgres (see Task 3)                                            | integration | PASS   |
| 23  | Null array columns map to `[]`, not null, so callers need no guard          | `src/lib/repositories/mappers.test.ts:substitutes empty arrays`                       | unit        | PASS   |
| 24  | Postgres numeric-as-string becomes a number for the pricing engine          | `src/lib/repositories/mappers.test.ts:coerces a numeric-string percent`               | unit        | PASS   |
| 25  | Every slot in the day grid is priced, including unavailable ones            | `src/lib/services/availability.test.ts:prices every slot`                             | unit        | PASS   |
| 26  | Pricing rules are evaluated per slot, not once per court                    | `src/lib/services/availability.test.ts:applies pricing rules per slot`                | unit        | PASS   |
| 27  | A fully blocked court reports zero open slots rather than erroring          | `src/lib/services/availability.test.ts:reports a court with no open slots`            | unit        | PASS   |
| 28  | Cancelled bookings are excluded from busy ranges by status filter           | `src/lib/repositories/queries.test.ts:excludes cancelled bookings`                    | unit        | PASS   |
| 29  | The busy window is half-open, so a booking ending at `from` is free         | `src/lib/repositories/queries.test.ts:uses a half-open window`                        | unit        | PASS   |
| 30  | Bookings and maintenance blocks union under one court id                    | `src/lib/repositories/queries.test.ts:unions bookings and maintenance blocks`         | unit        | PASS   |
| 31  | A failed read raises with context instead of returning empty                | `src/lib/repositories/queries.test.ts:throws with context`                            | unit        | PASS   |

---

## Coverage

```
$ pnpm test:coverage
 Test Files  11 passed (11)
      Tests  131 passed (131)

Statements   : 92.75% (192/207)
Branches     : 82.17% (106/129)
Functions    : 95.89% (70/73)
Lines        : 92.26% (179/194)
```

Threshold is 80% on all four axes (`vitest.config.ts`); all four clear it.

Excluded from the coverage denominator, with reasons:

- `src/lib/supabase/**` — thin factories over the Supabase SDK, no branching of
  our own.
- `src/lib/repositories/rows.ts`, `src/lib/domain/types.ts` — type-only aliases,
  nothing to execute.

`src/lib/auth/staff.ts` is **included and sits at 0%** — it needs a real auth
session, so it is honestly reported as uncovered rather than excluded to flatter
the number.

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
- **Server actions have no tests.** `createBookingAction`, `findBookingAction`,
  and the auth actions are written and typecheck, but nothing executes them.
  Their happy paths and the SLOT_TAKEN branch need integration tests against the
  local stack — blocked on the same Docker outage.
- **`getCurrentStaff` is untested (0% coverage).** It needs a real auth session.
- **Cancel and reschedule are not implemented.** The design has both; only
  create and lookup exist.
- **Admin mutations are not implemented.** Mark-paid, refund, block time, and
  the products/pricing editors from `Pickleball Admin.dc.html` remain.
- **Rate limiting.** `find_booking_by_reference` is enumerable given a valid
  reference. The action returns an identical message for a wrong reference and a
  wrong email, which prevents confirmation, but it still needs a rate limit.
- **Customer tier is hardcoded to `standard` when quoting.** The schema and the
  pricing engine both support tiers, but `createBookingAction` does not yet look
  up the customer's tier, so tier discounts never apply.

## Merge evidence

RED/GREEN checkpoints, all on `main` and reachable from `HEAD`:

| Commit    | Stage                                                   |
| --------- | ------------------------------------------------------- |
| `43ae6ec` | scaffold                                                |
| `2ad6ff0` | RED — domain specs fail to resolve                      |
| `12d0583` | GREEN — 61/61 domain tests pass                         |
| `64315d6` | RED — schema/quote specs fail to resolve                |
| `6afc31a` | GREEN — 81/81 tests pass                                |
| `e1d389b` | GREEN — 95/95 tests, env URL defect fixed               |
| `71ccb25` | chore — lint scoped to source, evidence report added    |
| (RED)     | mapper/availability specs fail to resolve               |
| (GREEN)   | 114/114 tests pass                                      |
| (feat)    | queries, booking actions, staff auth gate, proxy rename |
| (test)    | 131/131 tests, coverage 92.75%/82.17%/95.89%/92.26%     |

---

# Run 2 — Full-platform build (hosted Supabase)

**Source plan**: inline plan produced by `/ecc:plan` in this session, approved
with "proceed"; target changed mid-run from the local Docker stack to a hosted
Supabase project at the user's direction.

## Task report

### Task 9 — Hosted Supabase tooling

`.env.example` documents the hosted project's three keys plus
`SUPABASE_PROJECT_REF`; `db:link`, `db:push`, `db:types:remote` added. The env
contract itself was already correct for a remote project — only the values change.

### Task 10 — Booking/payment/customer/block repositories (RED → GREEN)

- RED: `pnpm test` → `Test Files 5 failed | 11 passed (16)`, `Failed to resolve
import` for `./booking-mappers`, `./bookings`, `./customers`, `./payments`,
  `./blocks`. Commit `6840d1b`.
- GREEN: `pnpm test` → `Test Files 16 passed (16)`, `Tests 183 passed (183)`.
  Commit `b8737e9`.
- `support.ts` adds `RepositoryError`, which carries the Postgres SQLSTATE so a
  23P01 slot conflict is distinguishable without matching on message text.

### Task 11 — Repository split (RED → GREEN → refactor)

- RED: `pnpm test` → `Test Files 5 failed | 15 passed (20)`. Commit `2626c49`.
- GREEN: `pnpm test` → `Test Files 20 passed (20)`, `Tests 203 passed (203)`.
  Commit `db64c97`.
- `queries.ts` became `clubs` / `courts` / `products` / `pricing-rules` /
  `availability`, each with its own spec, plus the admin catalog writes.
- **Defect caught by typecheck**: the patch builders returned
  `Record<string, unknown>`, which the generated `Update` types reject. Retyped
  to `Tables['x']['Update']`, so a misspelled column is now a compile error.

### Task 12 — Migrations (written, NOT applied)

`20260102000000_booking_lifecycle`, `…0100_customer_rollups`,
`…0200_reporting`, `…0300_lookup_rate_limit`. Commit `a810bfd`.

No database was reachable in this session, so **none of these have been
executed**. They are unverified SQL until `pnpm db:push` runs.

### Task 13 — Availability, lookup, cancellation (RED → GREEN)

- RED: `pnpm test` → `Test Files 2 failed | 20 passed (22)`. Commit `3df7ff1`.
- GREEN: `pnpm test` → `Test Files 22 passed (22)`, `Tests 222 passed (222)`.
  Commit `393099d`.

### Task 14 — Coverage honesty (defect found by widening the denominator)

Coverage `include` was `src/lib/**` only, so `src/features/**` — all the new
action code — was outside the denominator. Widening it dropped branches to
**74.53%**, below the gate, revealing that `createBooking` had no tests at all,
including the tier fix. Tests added; commit `f4d998f`.

## Test specification (additions)

| #   | What is guaranteed                                                           | Test file                                                                 | Type | Result |
| --- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---- | ------ |
| 32  | Booking timestamps become Dates; an unset cancellation stays null, not epoch | `booking-mappers.test.ts`                                                 | unit | PASS   |
| 33  | A deleted product still resolves via its name snapshot                       | `booking-mappers.test.ts:survives a product that has since been deleted`  | unit | PASS   |
| 34  | Booking detail joins segments, items and payments in one query, not N+1      | `bookings.test.ts:joins segments, items and payments`                     | unit | PASS   |
| 35  | The bookings window is half-open and always club-scoped                      | `bookings.test.ts`                                                        | unit | PASS   |
| 36  | Confirming stamps confirmed_at; cancelling stamps cancelled_at               | `bookings.test.ts:updateBookingStatus`                                    | unit | PASS   |
| 37  | A pending payment carries no paid_at; only a settled one does                | `payments.test.ts`                                                        | unit | PASS   |
| 38  | A block clash surfaces SQLSTATE 23P01 to the caller                          | `blocks.test.ts:surfaces the Postgres conflict code`                      | unit | PASS   |
| 39  | Customer lookup is club-scoped, because email is unique per club only        | `customers.test.ts`                                                       | unit | PASS   |
| 40  | Admin catalog lists include archived rows; customer lists do not             | `products.test.ts`, `pricing-rules.test.ts`                               | unit | PASS   |
| 41  | An empty patch is refused instead of issuing a no-op write                   | `products.test.ts:rejects an empty patch`                                 | unit | PASS   |
| 42  | Availability windows the club-LOCAL day, not a UTC day                       | `availability.test.ts:asks for busy ranges over the whole club-local day` | unit | PASS   |
| 43  | A duration outside the club's bounds is refused                              | `availability.test.ts`                                                    | unit | PASS   |
| 44  | Guest lookup is rate limited, and the attempt is counted before deciding     | `lifecycle.test.ts`                                                       | unit | PASS   |
| 45  | Wrong reference and wrong email are indistinguishable to the caller          | `lifecycle.test.ts:gives the same message`                                | unit | PASS   |
| 46  | Database error text never reaches the customer                               | `lifecycle.test.ts`, `create-booking.test.ts`                             | unit | PASS   |
| 47  | A finished booking cannot be cancelled                                       | `lifecycle.test.ts:explains that an already-finished booking`             | unit | PASS   |
| 48  | A client-sent price is ignored; the server prices every segment              | `create-booking.test.ts:prices every segment on the server`               | unit | PASS   |
| 49  | A returning member is charged their tier rate; a guest is not                | `create-booking.test.ts:applies the tier discount`                        | unit | PASS   |
| 50  | A lost race for a slot is reported as SLOT_TAKEN, not a generic failure      | `create-booking.test.ts`                                                  | unit | PASS   |

## Coverage

```
$ pnpm test:coverage
 Test Files  23 passed (23)
      Tests  233 passed (233)

Statements   : 91.95% (377/410)
Branches     : 80.81% (219/271)
Functions    : 96.55% (112/116)
Lines        : 95.75% (361/377)
```

Denominator now covers `src/lib/**` and `src/features/**`. Excluded:
`src/lib/supabase/**` (SDK factories), type-only alias modules, and
`src/features/**/actions.ts` ('use server' one-line delegations whose targets
are the modules under test).

## Known gaps carried into the next run

- **No migration has been applied.** Everything under `supabase/migrations/`
  from `20260101000600` onward is unexecuted SQL. `pnpm db:push` against the
  hosted project is the first thing that should happen next.
- **`database.types.ts` is stale.** `src/lib/supabase/rpc.ts` bridges the RPCs
  the generated types do not know about yet, and is deleted once
  `pnpm db:types:remote` runs.
- **No UI.** All 15 screens from the design project remain unbuilt; the app
  still renders the placeholder home page.
- **No E2E tests.** `e2e/` is still empty — the flows have no UI to drive.
- **Reschedule has a migration but no action or test.**
- **Admin mutations** (mark paid, refund, block time, catalog editors) have
  repositories but no actions or UI.
- **RLS still unproven**, unchanged from run 1.
- `getCurrentStaff` still untested (needs a real auth session).

---

# Run 3 — Hosted project wiring

### Task 15 — New-style Supabase key names (RED → GREEN)

- RED: `pnpm test src/lib/env.test.ts` → `Tests 2 failed | 10 passed (12)`.
  The hosted project issues `sb_publishable_…` / `sb_secret_…` keys; the env
  contract recognised only the legacy JWT names, so the app could not start
  against it. Commit `f0b3cc8`.
- GREEN: `pnpm test` → `Test Files 23 passed (23)`, `Tests 237 passed (237)`.
  Commit `1ec6885`. Legacy names still win when both are set.

### Task 16 — Hosted project reachability (verified)

```
$ curl -s -o /dev/null -w "%{http_code}" -H "apikey: <publishable>" \
    "https://qgfpaoweqpyxuqzsatdc.supabase.co/rest/v1/clubs?select=id&limit=1"
404
{"code":"PGRST205","message":"Could not find the table 'public.clubs' in the schema cache"}
```

The project and key are valid; the **schema is empty**. No migration has ever
been applied to it.

`pnpm exec supabase projects list` → `{"message":"User is banned"}`, i.e. the
CLI holds no usable access token, so `db push` cannot run unattended.

### Task 17 — Money formatting and cart persistence (RED → GREEN)

- RED: `pnpm test` → `Test Files 2 failed | 23 passed (25)`. Commit `936596b`.
- GREEN: `pnpm test` → `Test Files 25 passed (25)`, `Tests 254 passed (254)`.
  Commit `04c30f4`.
- Guarantee: whole amounts render without decimals and centavos survive;
  a cart restored from localStorage revalidates every field, dropping a segment
  with unparseable timestamps rather than passing `Invalid Date` to pricing.

### Task 18 — UI primitives (RED → GREEN)

- RED: `pnpm test` → `Test Files 3 failed | 25 passed (28)`; `./button`,
  `./quantity-stepper`, `./status-badge` fail to resolve. Commit `69ebb46`.
- GREEN: `pnpm test` → `Test Files 28 passed (28)`, `Tests 272 passed (272)`.
  Commit `58b5ff2`.

| #   | What is guaranteed                                                                  | Test file                                                     | Type | Result |
| --- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---- | ------ |
| 51  | A pending button is disabled, not merely restyled, so checkout cannot double-submit | `button.test.tsx:is disabled while pending`                   | unit | PASS   |
| 52  | Buttons default to type="button" and cannot accidentally submit a form              | `button.test.tsx:defaults to type="button"`                   | unit | PASS   |
| 53  | Quantity cannot go below zero or above the schema's ceiling                         | `quantity-stepper.test.tsx`                                   | unit | PASS   |
| 54  | Each row's stepper controls are individually named for assistive tech               | `quantity-stepper.test.tsx:names the product in each control` | unit | PASS   |
| 55  | Database enums are never shown raw; an unknown status still renders                 | `status-badge.test.tsx`                                       | unit | PASS   |

### Task 19 — CartProvider (RED → GREEN → refactor)

- RED: `pnpm test` → `Test Files 1 failed | 28 passed (29)`; `./cart-provider`
  fails to resolve. Commit `85296fa`.
- GREEN: `pnpm test` → `Test Files 29 passed (29)`, `Tests 282 passed (282)`.
  Commit `a021609`.
- REFACTOR: `pnpm lint` failed with `react-hooks/set-state-in-effect` — the
  cart was hydrated into `useState` from an effect, which renders one frame
  with an empty cart before correcting itself. Rebuilt on
  `useSyncExternalStore`; tests stayed green. Commit `00acc2a`.
- The persistence test was also strengthened: with a module-level snapshot
  cache it would have passed off the cache even if the localStorage write were
  broken. It now drops the cache first, as a real reload does.

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 56 | A cart survives a reload | `cart-provider.test.tsx:persists across a remount` | unit | PASS |
| 57 | An overlapping segment on the same court is refused | `cart-provider.test.tsx:refuses a second segment that overlaps` | unit | PASS |
| 58 | The same window on a different court is allowed (group booking) | `cart-provider.test.tsx:allows the same window on a different court` | unit | PASS |
| 59 | useCart outside a provider throws a named error, not undefined | `cart-provider.test.tsx` | unit | PASS |

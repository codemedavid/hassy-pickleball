# TDD evidence — court management and player capacity

**Source plan**: inline plan produced by `/ecc:plan` in the same session (not written to a
`.plan.md` file). Phase 1 of six: "Courts CRUD + pax".

**Scope of this record**: the backend slice only — schema, mapper, repository, validation, and
the staff-gated save entry point. The admin courts screen, the shared `AdminForm` primitive, and
threading party size through the guest booking path are Phase 1 work that has not started.

## User journeys

1. As a club admin, I want to add a court and edit its details, so the catalog reflects what the
   club actually rents out.
2. As a club admin, I want to record how many players a court seats, so guests cannot book a
   court for a group it cannot hold.
3. As a club admin, I want to take a court offline for resurfacing without erasing it, so past
   bookings still resolve and I can bring it back later.
4. As a guest, I want to say how many of us are playing, so the desk knows what to set up.
   _(Recorded in the schema by this slice; the picker itself is not built yet.)_

## Task report

### Migration: `20260105000000_court_capacity.sql`

Adds `courts.min_players` / `courts.max_players` (default 2–4, `max >= min`, `min > 0`), adds
nullable `bookings.party_size`, and recreates `create_booking` with a `p_party_size` argument.

The function is dropped and recreated rather than overloaded, matching the precedent set by
`20260102000000_booking_lifecycle.sql`: two live signatures would leave the older, weaker one
callable. Party size is validated inside the function against the widest band the chosen courts
allow, so a party that does not fit rolls the whole booking back. `party_size` is nullable
because bookings taken before this migration have no recorded size and inventing one would be a
lie the desk might act on.

Not exercised by the test suite — there is no local database in this environment. The check
constraints and the in-function validation are the enforcement; the Zod schema mirrors them so
the editor gets a field error instead of a 23514.

### Mapper, repository, validation, save entry point

| Validation command                       | Result                                      |
| ---------------------------------------- | ------------------------------------------- |
| `pnpm test` (RED, before implementation) | 9 failed, 756 passed                        |
| `pnpm test` (GREEN)                      | **782 passed**, 0 failed among tested files |
| `pnpm lint`                              | clean, no output                            |
| `pnpm typecheck`                         | no errors in any file in this change        |
| `pnpm test:coverage`                     | **BLOCKED** — see Known gaps                |

RED excerpt:

```
FAIL  src/lib/repositories/mappers.test.ts > toCourt > carries the player capacity through
AssertionError: expected undefined to be 2

FAIL  src/lib/repositories/courts.test.ts > updateCourt > throws with context when the update errors
TypeError: updateCourt is not a function

Test Files  3 failed | 75 passed (78)
     Tests  9 failed | 756 passed (765)
```

GREEN excerpt:

```
Test Files  79 passed (79)
     Tests  782 passed (782)
```

## Test specification

| #   | What is guaranteed                                                                             | Test                                                                                                                                     | Type | Result |
| --- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------ |
| 1   | A court row's `min_players`/`max_players` reach the domain object as `minPlayers`/`maxPlayers` | `src/lib/repositories/mappers.test.ts:toCourt carries the player capacity through`                                                       | unit | PASS   |
| 2   | The admin list includes deactivated courts; the storefront list does not                       | `src/lib/repositories/courts.test.ts:listAllCourts includes deactivated courts`                                                          | unit | PASS   |
| 3   | Creating a court writes snake_case columns scoped to the club, capacity included               | `src/lib/repositories/courts.test.ts:createCourt writes the court against the club`                                                      | unit | PASS   |
| 4   | A patch sends only the fields that changed                                                     | `src/lib/repositories/courts.test.ts:updateCourt sends only the fields that changed`                                                     | unit | PASS   |
| 5   | Courts deactivate rather than delete, so historical bookings still resolve                     | `src/lib/repositories/courts.test.ts:updateCourt deactivates rather than deletes`                                                        | unit | PASS   |
| 6   | An empty patch is refused rather than issuing a no-op update                                   | `src/lib/repositories/courts.test.ts:updateCourt refuses an empty patch`                                                                 | unit | PASS   |
| 7   | Every failing query throws with context rather than returning null                             | `courts.test.ts` — four `throws with context` cases                                                                                      | unit | PASS   |
| 8   | A caller with no staff session cannot save a court                                             | `src/features/admin/server/courts.test.ts:saveCourt refuses a caller with no staff session`                                              | unit | PASS   |
| 9   | `clubId` comes from the session, so staff cannot write into another club                       | `courts.test.ts:saveCourt ignores a clubId in the request`                                                                               | unit | PASS   |
| 10  | Supplying an id patches the existing court instead of creating a duplicate                     | `courts.test.ts:saveCourt patches an existing court when an id is supplied`                                                              | unit | PASS   |
| 11  | A capacity band whose maximum is below its minimum is rejected, on create and on patch         | `courts.test.ts:saveCourt rejects a capacity whose maximum is below its minimum` + `rejects a patch that would invert the capacity band` | unit | PASS   |
| 12  | A capacity of zero players is rejected, since it would make the court unbookable               | `courts.test.ts:saveCourt rejects a capacity of zero players`                                                                            | unit | PASS   |
| 13  | A negative base price is rejected                                                              | `courts.test.ts:saveCourt rejects a negative base price`                                                                                 | unit | PASS   |
| 14  | An environment outside the database enum is rejected                                           | `courts.test.ts:saveCourt rejects an environment the database does not define`                                                           | unit | PASS   |
| 15  | A slug that would not survive a URL is rejected                                                | `courts.test.ts:saveCourt rejects a slug with characters that would not survive a URL`                                                   | unit | PASS   |

## Coverage and known gaps

**Coverage is blocked, not passing.** `pnpm test:coverage` exits non-zero and prints no report,
because two test files unrelated to this change fail to resolve their imports:

- `src/app/loading-states.test.tsx` → imports `./loading`, `./courts/[slug]/loading`,
  `./checkout/loading`, `./admin/loading`, none of which exist
- `src/components/ui/skeleton.test.tsx` → imports `./skeleton`, which does not exist

These files are untracked and were created by a different workstream during the same session;
they are RED-state tests awaiting their implementation. They contribute zero tests to the run, so
the 782 passing tests above are unaffected, but the coverage gate cannot report until they
resolve. No coverage percentage is claimed here.

Other gaps, all intentional at this point in the phase:

- The migration itself is unexercised — no local database in this environment.
- `src/features/admin/server/courts.ts` has no screen calling it yet; `saveCourtAction` is not
  wired into `src/features/admin/actions.ts`.
- `bookings.party_size` is written by `create_booking` but nothing reads it yet, and no UI
  collects it.
- Court test fixtures gained a default 2–4 capacity so the widened `Court` type still typechecks.

## Merge evidence

Checkpoint commits on `feat/admin-management`:

- `0177dde` — `test: add reproducers for court capacity and court CRUD` (RED, 9 failures)
- `b65666b` — `feat: manage courts and their player capacity from the admin console` (GREEN, 782 pass)

A third commit, `91b40c4` (`test: cover the checkout route's paused and form branches`), sits
between them on the same branch but is **not** part of this work — it was made by a concurrent
process writing to the same checkout. If these commits are squashed, this file is the surviving
RED/GREEN record.

# TDD evidence — court availability and time blocking

Source plan: none. The journeys below were written during this TDD run from the
request "add availability of all the courts and be able to block some time".

## Starting point

The database already had everything needed to hold court time — the
`availability_blocks` table, its exclusion constraint, the symmetric
booking/block triggers, RLS staff-write policies, the repository
(`src/lib/repositories/blocks.ts`), the Zod schemas, and the
`blockCourtTime` / `removeCourtBlock` server actions. None of it was reachable:
the schedule screen was read-only and showed today only. This work connected
that surface and added the availability totals the desk reads off it. No
migration was needed.

## User journeys

1. As a desk manager, I want to see every court's schedule for any date, so I
   can answer "is Saturday morning free?" without querying the database.
2. As a desk manager, I want each court to state how much of the day is still
   open, so availability is a number rather than something I count off a grid.
3. As a desk manager, I want to hold a window on a court (maintenance, league,
   private hire, closure), so it stops being bookable.
4. As a desk manager, I want to release a hold I created, so the time goes back
   on sale.

## Task report

### 1. Day arithmetic — `shiftDayString`

Added `shiftDayString` to `src/lib/domain/time.ts` so the schedule's
previous/next controls can name a calendar day. Arithmetic is done in UTC
deliberately: a calendar day here is a label, not an instant, so no timezone can
shorten the step.

- RED: `npx vitest run src/lib/domain/time.test.ts` — failed to resolve the
  export (`shiftDayString is not a function`), 6 cases.
- GREEN: same command, 41 passed.
- Guaranteed: month, year, and leap-day rollovers in both directions, and a
  throw rather than `"NaN-NaN-NaN"` for an unparseable day.

### 2. Availability totals and releasable entries — `view/schedule.ts`

`ScheduleColumn` gained `openMinutes` / `openLabel`, and `ScheduleEntry` gained
`blockId`. Held minutes are unioned, not summed — a block laid over a booking is
two entries covering one stretch of time, and summing them reported more held
minutes than the day contains.

- RED: `npx vitest run src/features/admin/view/schedule.test.ts` — 7 failures
  (`openMinutes` undefined, `blockId` undefined).
- GREEN: same command, all passed.
- Guaranteed: full-day open total, booked and blocked time deducted,
  overlapping holds counted once, "Fully booked" instead of "0 hrs open",
  cancelled bookings not counted, blocks carrying their id and bookings not.

### 3. Block form view model — `view/block-form.ts` (new)

Holds the form as the strings a time input carries and converts once, on
submit, through the club's timezone.

- RED: `npx vitest run src/features/admin/view/block-form.test.ts` — module did
  not exist.
- GREEN: same command, 13 passed.
- Guaranteed: a one-hour maintenance default at the club's opening time; local
  rejection of a missing court, a missing time, and an inverted or zero-length
  window; club-timezone conversion; a blank reason sent as `null` and a typed
  one trimmed.

### 4. Screen — `ui/schedule-screen.tsx`, `ui/block-time-form.tsx` (new)

The screen became a client component with day navigation (links, so `?day=` is
what actually loads the data and the date can be bookmarked), a block form
under the grid, and a Release control on every block entry.

- RED: `npx vitest run src/features/admin/ui/schedule-screen.test.tsx` — 12
  failed, 6 passed.
- GREEN: same command, 18 passed.
- Guaranteed: the six pre-existing rendering behaviours still hold, plus the
  rows in the table below.

### 5. Page wiring — `app/admin/page.tsx`, `app/admin/console-data.ts`

`todayWindow` now delegates to a new `dayWindow(club, day)`, and the page
normalises `?day=` through the existing `parseDayString` before it reaches the
window arithmetic. Covered indirectly: `src/app/**` is outside the coverage
config, and the two behaviours that could go wrong (day parsing, window
arithmetic) are unit-tested in `format/time` and exercised by the screen tests.

## Test specification

| #   | What is guaranteed                                                                            | Test file                                                                                             | Type | Result |
| --- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---- | ------ |
| 1   | The next/previous calendar day is named correctly across month, year, and leap-day boundaries | `src/lib/domain/time.test.ts:shiftDayString`                                                          | unit | PASS   |
| 2   | An unparseable day throws instead of producing a malformed date string                        | `src/lib/domain/time.test.ts:rejects a day it cannot parse`                                           | unit | PASS   |
| 3   | A court with nothing on it reports the club's whole opening window as open                    | `src/features/admin/view/schedule.test.ts:reports a court with nothing on it`                         | unit | PASS   |
| 4   | Booked and blocked minutes are both deducted from a court's open total                        | `src/features/admin/view/schedule.test.ts:takes booked and blocked time off`                          | unit | PASS   |
| 5   | A block overlapping a booking is counted once, so open time never goes negative               | `src/features/admin/view/schedule.test.ts:counts overlapping holds once`                              | unit | PASS   |
| 6   | A fully held court reads "Fully booked" rather than "0 hrs open"                              | `src/features/admin/view/schedule.test.ts:says a fully held court is fully booked`                    | unit | PASS   |
| 7   | A cancelled booking does not consume availability                                             | `src/features/admin/view/schedule.test.ts:ignores a cancelled booking`                                | unit | PASS   |
| 8   | Blocks carry their id for release; bookings do not                                            | `src/features/admin/view/schedule.test.ts:releasable entries`                                         | unit | PASS   |
| 9   | Typed wall-clock times are resolved through the club's timezone, not the browser's            | `src/features/admin/view/block-form.test.ts:reads the typed times through the club’s timezone`        | unit | PASS   |
| 10  | An inverted or zero-length block is rejected locally, with no round trip                      | `src/features/admin/view/block-form.test.ts:rejects a block that ends before it starts`               | unit | PASS   |
| 11  | A blank reason is sent as null; a typed one is trimmed                                        | `src/features/admin/view/block-form.test.ts:toBlockPayload`                                           | unit | PASS   |
| 12  | Each court column states how much of the day is open                                          | `src/features/admin/ui/schedule-screen.test.tsx:states how much of the day each court still has open` | unit | PASS   |
| 13  | Previous/next/today links reach any date via `?day=`                                          | `src/features/admin/ui/schedule-screen.test.tsx:links to the day before and the day after`            | unit | PASS   |
| 14  | Blocking sends the chosen court, kind, reason, and UTC window                                 | `src/features/admin/ui/schedule-screen.test.tsx:holds the chosen window on the chosen court`          | unit | PASS   |
| 15  | The block lands on the day being viewed, not on today                                         | `src/features/admin/ui/schedule-screen.test.tsx:blocks the day being viewed, not today`               | unit | PASS   |
| 16  | An inverted window is refused in the browser and never reaches the action                     | `src/features/admin/ui/schedule-screen.test.tsx:refuses an inverted window`                           | unit | PASS   |
| 17  | A database conflict is shown to the staff member rather than swallowed                        | `src/features/admin/ui/schedule-screen.test.tsx:shows the clash the database reported`                | unit | PASS   |
| 18  | A saved block reloads the schedule so the grid shows it                                       | `src/features/admin/ui/schedule-screen.test.tsx:reloads the schedule once the block is saved`         | unit | PASS   |
| 19  | Release sends the block id and reloads; a failed release is reported                          | `src/features/admin/ui/schedule-screen.test.tsx:releasing time`                                       | unit | PASS   |
| 20  | Bookings offer no Release — those are cancelled, not released                                 | `src/features/admin/ui/schedule-screen.test.tsx:offers no release on a booking`                       | unit | PASS   |

## Coverage

`npx vitest run --coverage src/features/admin src/lib/domain`

```
 features/admin/ui  |   99.14 |    95.57 |   99.03 |   99.11
 ...res/admin/view  |   99.41 |     92.5 |     100 |   99.35
  schedule.ts       |   97.67 |    88.88 |     100 |   97.61
  time.ts           |   98.14 |       80 |     100 |   98.03
```

Both touched areas are above the 80% threshold.

`npx vitest run src/features/admin src/lib/domain src/features/booking` — 40
files, 449 tests, all passing.

## Known gaps

- No E2E test. The block/release path is exercised at the component level with
  the server action stubbed; the exclusion constraint that actually decides a
  conflict is enforced in Postgres and is not run in this suite.
- `src/app/admin/page.tsx` and `console-data.ts` have no direct test — `src/app`
  is excluded from the coverage config, matching every other admin page.
- Blocks can only be created for the day on screen. A multi-day closure is four
  visits to four dates; a date-range form was not in scope.
- Whole-repo test runs during this work also reported failures in
  `courts-screen.test.tsx`, `skeleton.test.tsx`, and `loading-states.test.tsx`.
  Those belong to concurrent work in this repository, not to this change.

## Merge evidence

Checkpoint commits on `feat/admin-management`, in order:

- `2965982` test: add reproducers for court availability totals and time blocking (RED)
- `66d8704` feat: total each court's open time and identify releasable blocks (GREEN)
- `0f1b4e5` test: add reproducers for day navigation, blocking, and releasing court time (RED)
- `16875e0` feat: block and release court time from any day's schedule (GREEN)

# TDD evidence: managing bookings, courts and the schedule on a phone

**Source plan**: derived during this TDD run from a free-form request — "make the management of
bookings, courts and schedule more responsive and UI/UX friendly on mobile". No `*.plan.md` was
supplied, so the journeys below were written in step 1 of the cycle.
**Branch**: `feat/admin-mobile`

## What was wrong

The console was already technically responsive: tables reflowed into stacked cards below `sm`,
nothing scrolled sideways except the schedule. It was not usable.

1. **The stacked cards had no design.** Every column printed as one more `LABEL  value` line in
   the same small grey type, so a nine-column booking read as nine identical rows and nothing
   led the card. Rows were separated by an 8px rule, not by being cards.
2. **The schedule could not be read on a phone at all.** The grid declares
   `min-w-[680px]` with a `minmax(150px, 1fr)` column per court — a sideways scroll on every
   device the desk actually carries.
3. **The bookings ledger had no way to find anything.** Thirty days back and seven forward, and
   the only way to reach a booking was to scroll to it.
4. **The detail panel opened on whatever booking was newest**, which on a phone pushed the whole
   ledger below the fold before the desk had read anything.
5. **Controls were sized for a mouse** — 32px buttons in the corner of a card, 40px form fields.

## User journeys

1. As a staff member on a phone, I want each booking to read as a card led by its reference and
   amount, so that I can scan the ledger instead of parsing nine label-and-value lines.
2. As a staff member on a phone, I want to search the ledger by name, reference, phone or court,
   and to filter it down to the money I still have to chase.
3. As a staff member on a phone, I want to open Bookings and see the ledger, not a booking I did
   not ask for — and when I do open one, I want a way back.
4. As a staff member on a phone, I want the day's schedule as a list per court, so that I can
   read it without scrolling sideways.
5. As a staff member on a phone, I want to know what each schedule entry is without a legend in
   view, and to release a staff hold from the list.
6. As a staff member on a phone, I want the block-time form out of the way until I ask for it.
7. As a staff member on a phone, I want each court to show its name, price and whether it is
   bookable at a glance, with actions I can hit with a thumb.

## Task report

Each phase ran RED → GREEN with its own checkpoint commits, listed in "Merge evidence".

### Phase A — a designed card layout for every admin table

`Cell` now says what part it plays in the phone card (`title`, `trailing`, `lead`, `badge`,
`actions`, or the default labelled pair), rows are cards with their own border and shadow, and
the table frame is dropped underneath them. Stat cards sit two to a row instead of four stacked.

One DOM still serves both widths — a phone-only card list beside a desktop table would double
every value in the accessibility tree and drift the first time a column changed — so the card is
built with flex `order` over the same cells the desktop table uses.

```
RED   npx vitest run src/features/admin/ui/primitives.test.tsx
      Tests  7 failed | 6 passed (13)
GREEN Tests  13 passed (13)
```

### Phase B — a searchable, readable bookings ledger

New pure module `src/features/admin/view/booking-filters.ts`: free-text search over reference,
name, contact and court, plus four counted tabs. A cancelled booking is deliberately excluded
from "awaiting payment" — it owes the club nothing even though its payment never landed.

The panel takes a new `isSelectionExplicit` prop. The page sets it only when the `?booking=` id
actually matched, so the fallback-to-newest selection stays closed on a phone and the ledger is
what loads.

```
RED   npx vitest run src/features/admin/view/booking-filters.test.ts
      Failed to resolve import "./booking-filters"      (compile-time RED)
GREEN Tests  13 passed (13)

RED   npx vitest run src/features/admin/ui/bookings-screen.test.tsx
      Tests  9 failed | 9 passed (18)
GREEN Tests  18 passed (18)
```

One defect was found by the tests rather than designed around: the filter buttons announced as
`"Awaiting payment1"`, because the count sat in an adjacent element with no whitespace between.
Fixed in the component, not the assertion.

### Phase C — courts that read as courts

Name, price and bookable-or-not lead the card; the two actions share the card's full width at
44px tall.

```
RED   npx vitest run src/features/admin/ui/courts-screen.test.tsx
      Tests  2 failed | 20 passed (22)
GREEN Tests  22 passed (22)
```

### Phase D — the schedule as a day agenda

New pure module `src/features/admin/view/schedule-agenda.ts` turns the grid's geometry into a
sequence: one section per court, entries in the order the day runs, each carrying its tone **in
words** (`SCHEDULE_TONE_LABELS`) because a list scrolls away from the legend the grid relies on.
Sections summarise as `"1 booking · 1 hold"` — a staff hold is not a booking — or
`"Nothing booked"`.

This is the one screen where the two layouts are different DOM rather than one restyled, so it
chooses between them through `useIsDesktop()`. The media-query plumbing was extracted out of
`admin-nav.tsx` into `desktop-viewport.ts` so the nav and the schedule cannot disagree about
what a desktop is. The server snapshot stays `false`: whichever width the server picks is the
one the other sees flash on hydration, and the club's staff are on phones.

The block-time form now waits behind a control on a phone, and the date rides in the day
navigation, where the page subtitle would have scrolled away.

```
RED   npx vitest run src/features/admin/view/schedule-agenda.test.ts
      Failed to resolve import "./schedule-agenda"      (compile-time RED)
GREEN Tests  9 passed (9)

RED   npx vitest run src/features/admin/ui/schedule-screen.test.tsx
      Tests  6 failed | 24 passed (30)
GREEN Tests  30 passed (30)
```

### Phase E — touch targets

Form controls across the block form, the court editor and the booking detail panel are 44px on a
phone and unchanged at 40px from `sm` up. 44px is the smallest target a thumb hits reliably
(WCAG 2.5.5).

```
RED   npx vitest run src/features/admin/ui/booking-detail-panel.test.tsx \
        src/features/admin/ui/schedule-screen.test.tsx
      Tests  2 failed | 46 passed (48)
GREEN Tests  48 passed (48)
```

## Test specification

| #   | What is guaranteed                                                                     | Test                                                                   | Type | Result |
| --- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---- | ------ |
| 1   | A row becomes a separated card on a phone, not a hairline rule                         | `primitives.test.tsx:separates each row into its own card`             | unit | PASS   |
| 2   | The leading cell heads its card without repeating the column name                      | `primitives.test.tsx:lets the leading cell head its card`              | unit | PASS   |
| 3   | Cells that stay label-and-value pairs still name their column                          | `primitives.test.tsx:still names the column on the cells`              | unit | PASS   |
| 4   | The action cell takes the card's full width                                            | `primitives.test.tsx:gives the action cell the full width`             | unit | PASS   |
| 5   | Two stat cards fit a phone row                                                         | `primitives.test.tsx:fits two stats to a row on a phone`               | unit | PASS   |
| 6   | Page-header actions stretch full width on a phone                                      | `primitives.test.tsx:stretches its actions across the card`            | unit | PASS   |
| 7   | Bookings are found by reference, name, contact or court, case- and space-insensitively | `booking-filters.test.ts` (6 cases)                                    | unit | PASS   |
| 8   | "Awaiting" excludes cancelled bookings, which owe nothing                              | `booking-filters.test.ts:lists only live bookings`                     | unit | PASS   |
| 9   | Search applies inside the chosen tab, not instead of it                                | `booking-filters.test.ts:applies the search inside the chosen tab`     | unit | PASS   |
| 10  | Each tab reports how many bookings sit behind it                                       | `booking-filters.test.ts:counts what sits behind each tab`             | unit | PASS   |
| 11  | Typing narrows the ledger, and a miss says so                                          | `bookings-screen.test.tsx:narrows the ledger` / `says nothing matched` | unit | PASS   |
| 12  | The tab in force is marked, and narrows the ledger                                     | `bookings-screen.test.tsx:marks the tab in force`                      | unit | PASS   |
| 13  | Each booking card is led by reference, amount, customer and badges                     | `bookings-screen.test.tsx:leads each card with the reference`          | unit | PASS   |
| 14  | Every card has a tappable way into the booking                                         | `bookings-screen.test.tsx:gives every card a tappable way in`          | unit | PASS   |
| 15  | The panel stays closed on a phone until a booking is opened                            | `bookings-screen.test.tsx:keeps the panel out of the way`              | unit | PASS   |
| 16  | An opened booking sits above the ledger with a way back                                | `bookings-screen.test.tsx:puts an opened booking above the ledger`     | unit | PASS   |
| 17  | Court cards are led by court, price and bookable state                                 | `courts-screen.test.tsx:leads each card with the court`                | unit | PASS   |
| 18  | The two court actions share the card's full width                                      | `courts-screen.test.tsx:gives the row's two actions the full width`    | unit | PASS   |
| 19  | The agenda heads each court with its rate, load and free time                          | `schedule-agenda.test.ts` (3 cases)                                    | unit | PASS   |
| 20  | Entries run in the order the day runs, with their time ranges                          | `schedule-agenda.test.ts:lists a court's entries in the order`         | unit | PASS   |
| 21  | Every entry names its tone in words                                                    | `schedule-agenda.test.ts:names the tone in words`                      | unit | PASS   |
| 22  | Bookings and staff holds are counted separately and pluralised                         | `schedule-agenda.test.ts` (3 cases)                                    | unit | PASS   |
| 23  | Only staff holds carry a release handle                                                | `schedule-agenda.test.ts:keeps the release handle on a staff hold`     | unit | PASS   |
| 24  | A phone gets the list; the grid is not rendered                                        | `schedule-screen.test.tsx:reads the day as a list per court`           | unit | PASS   |
| 25  | A desktop still gets the grid, the legend and the open hours                           | `schedule-screen.test.tsx` (existing suite, viewport pinned desktop)   | unit | PASS   |
| 26  | A hold can be released from the list, and a booking cannot                             | `schedule-screen.test.tsx:releases a staff hold from the list`         | unit | PASS   |
| 27  | The block form waits behind a control on a phone                                       | `schedule-screen.test.tsx:keeps the block form behind a control`       | unit | PASS   |
| 28  | The day being viewed is inside the day navigation on a phone                           | `schedule-screen.test.tsx:shows the day being viewed inside the nav`   | unit | PASS   |
| 29  | Form controls are 44px on a phone                                                      | `schedule-screen.test.tsx` / `booking-detail-panel.test.tsx`           | unit | PASS   |

## Coverage

```
npx vitest run --coverage
Test Files  101 passed (101)
     Tests  1157 passed (1157)
All files   95.58 stmts | 89.46 branch | 96.72 funcs | 97.19 lines
```

Threshold is 80% on all four and is enforced in `vitest.config.ts`; the run passes it. The new
modules — `booking-filters.ts`, `schedule-agenda.ts`, `schedule-agenda.tsx`, `schedule-tones.ts`
— are at 100% and so are omitted from the per-file table. `desktop-viewport.ts` is at 86.36%:
the uncovered lines are the legacy `addListener` fallback for browsers without
`MediaQueryList.addEventListener`, which was equally uncovered while it lived in `admin-nav.tsx`.

```
npx tsc --noEmit                                    clean
npx eslint src --ignore-pattern .../database.types.ts   clean
npx next build                                      14/14 routes, clean
```

## Known gaps

- **No E2E.** `e2e/` holds only storefront specs and no admin spec; nothing there needed
  updating, and none was added. A Playwright run at a 375px viewport would be the honest way to
  prove the layouts, since jsdom applies no CSS.
- **The layout assertions are class-name assertions.** `max-sm:*` classes are checked as
  strings, following the convention already set by `test/responsive-table.ts`. They prove intent,
  not rendering.
- **`useIsDesktop` flashes on desktop.** The server renders the phone layout, so a desktop
  swaps to the grid after hydration. This is the same trade the nav already makes, chosen the
  same way and for the same reason.
- **Screens outside the brief** — products, customers, payment methods — inherited the new card
  primitives and were switched to the matching table shell, but their cells were not given
  mobile roles, so they still read as labelled pairs.

## Merge evidence

If these commits are squashed, this section is the record.

```
754c7ed test: add phone card layout reproducer for admin primitives   (RED, 7 failing)
e9c12e2 feat: give admin tables a designed phone card layout          (GREEN, 13 passing)
2008d98 test: add reproducer for booking search and status tabs       (RED, compile-time)
94fae38 feat: filter and count the bookings ledger by search and status (GREEN, 13 passing)
        test: add reproducer for the bookings ledger on a phone       (RED, 9 failing)
db5bf82 feat: make the bookings ledger searchable and readable on a phone (GREEN, 18 passing)
        test: add reproducer for the courts list on a phone           (RED, 2 failing)
c54e0cc feat: make the courts list readable and tappable on a phone   (GREEN, 22 passing)
        test: add reproducer for the schedule read as a day agenda    (RED, compile-time)
b9c7c03 feat: read the court schedule as a day agenda                 (GREEN, 9 passing)
        test: add reproducer for the court schedule on a phone        (RED, 6 failing)
4b897a4 feat: read the court schedule as an agenda on a phone         (GREEN, 30 passing)
        test: add reproducer for admin form touch targets on a phone  (RED, 2 failing)
        feat: size admin form controls for thumbs on a phone          (GREEN, 48 passing)
```

Suite moved from 1105 passing (99 files) to 1157 passing (101 files). No test was deleted or
skipped; the existing schedule suite was pinned to a desktop viewport, because that screen now
chooses its layout by width.

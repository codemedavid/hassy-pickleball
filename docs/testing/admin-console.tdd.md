# Admin console — TDD evidence

## Source

No `*.plan.md`. Journeys were derived during this TDD run from the Claude Design
project `Pickleball Platform.dc.html` (project `c37c618e-e596-42d6-b3e8-02bab625d7f2`,
read via the design MCP), which defines seven admin screens.

Scope for this pass, agreed with the user before any code was written:

- Console shell plus all seven screens, rendering real Supabase data read-only.
- Mutations (mark paid, refund, block time, product/pricing editors) are **not**
  wired into the UI. The server actions for them already exist and remain tested
  in `src/features/admin/server/`; nothing on these screens calls them yet.
- The `/staff/sign-in` route the admin layout redirects to was added, since
  without it `/admin` redirected to a 404.

## User journeys

1. As desk staff, I want today's court schedule with bookings and blocked time
   laid out per court, so that I can see at a glance what is free.
2. As desk staff, I want the day's counts — bookings, utilization, unpaid,
   revenue — so that I know where the day stands without running a report.
3. As desk staff, I want every booking in a searchable ledger with the customer's
   contact details, so that I can reach someone when plans change.
4. As a manager, I want court bookings and café orders in one payments ledger
   with a breakdown of the selected order, so that I can reconcile takings.
5. As a manager, I want to see the product catalog including hidden items, so
   that I know what is and is not on sale.
6. As a manager, I want pricing rules shown in evaluation order, so that I can
   see which rule will actually set a rate.
7. As a manager, I want customers ranked by lifetime spend with their tier, so
   that I can recognise regulars.
8. As an owner, I want utilization by hour and revenue by court over 30 days, so
   that I can plan pricing and staffing.
9. As staff, I want a sign-in link emailed to me, so that I can reach the console
   without a password.

## Task report

### 1. View models (`src/features/admin/view/`, `src/features/admin/ui/nav-items.ts`)

Pure projections from repository types to what each screen renders: schedule
geometry, schedule stats, booking rows, orders ledger and detail, pricing rule
descriptions, reports aggregates, and nav current-state.

- RED: `npx vitest run src/features/admin`
  → `Test Files 7 failed | 4 passed (11)`; each new spec failed to resolve its
  module under test, the intended missing-implementation signal.
- GREEN: `npx vitest run src/features/admin/view src/features/admin/ui`
  → `Test Files 7 passed (7)`, `Tests 60 passed (60)`.
- Commits: `7631ad5` (RED), `b299700` (GREEN).

Guaranteed: instants are read through the club's timezone, never the runtime's;
cancelled bookings are excluded from every count, total, and grid position;
entries outside the opening window are clipped or dropped rather than
overflowing; division by zero courts, zero revenue, or zero bookings yields 0
rather than `NaN`; a rule whose court was removed still renders.

### 2. Console screens (`src/features/admin/ui/`)

Presentational components for the shell and the six management screens.

- RED: `npx vitest run src/features/admin/ui`
  → `Test Files 6 failed | 1 passed (7)`; every new component spec failed to
  resolve its component.
- GREEN: `npx vitest run src/features/admin/ui`
  → `Test Files 7 passed (7)`, `Tests 39 passed (39)`.
- Commits: `d14a821` (RED), `101cd95` (GREEN).

Guaranteed: the current nav section carries `aria-current="page"`, not colour
alone; every status is stated in words; the schedule legend names each tone; the
reports bar chart exposes each hour's percentage as text; every table has an
explicit empty state instead of bare column headings.

### 3. Pages and staff sign-in (`src/app/admin/`, `src/app/staff/sign-in/`)

Server Components that load the data and hand it to the screens, plus the
magic-link sign-in form.

- RED: `npx vitest run src/features/admin/ui/staff-sign-in-form.test.tsx`
  → `Test Files 1 failed (1)`, module unresolved.
- GREEN: `npx vitest run src/features/admin` → `Tests 135 passed (135)`.
- Commit: `101cd95`.

Guaranteed: the sign-in confirmation is identical whether or not the address
belongs to staff, so the form cannot be used to enumerate staff; a failure is
surfaced in an `alert` region rather than swallowed.

## Test specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|--------------------|----------------------|-----------|--------|----------|
| 1 | Schedule entries are positioned as a percentage of the club's opening window | `src/features/admin/view/schedule.test.ts:positions a booking as a percentage of the opening window` | unit | PASS | `npx vitest run src/features/admin` |
| 2 | An entry starting before opening or ending after close is clipped to the grid | `schedule.test.ts:clips an entry that starts before opening…` / `…runs past closing` | unit | PASS | same |
| 3 | Work entirely outside opening hours is dropped, not drawn as a sliver | `schedule.test.ts:drops anything that falls entirely outside the opening window` | unit | PASS | same |
| 4 | A cancelled booking leaves its court reading as free | `schedule.test.ts:leaves a cancelled booking off the grid…` | unit | PASS | same |
| 5 | Utilization is 0% for a club with no courts rather than `NaN` | `schedule-stats.test.ts:reports zero utilization rather than dividing by no courts` | unit | PASS | same |
| 6 | Cancelled bookings earn no revenue in the day's totals | `schedule-stats.test.ts:totals the day’s revenue…` | unit | PASS | same |
| 7 | A booking row shows a phone number when there is one, else the email | `bookings.test.ts:falls back to the email when no phone number was given` | unit | PASS | same |
| 8 | A multi-court booking lists each court once | `bookings.test.ts:lists every court a multi-court booking holds…` | unit | PASS | same |
| 9 | An order reads as refunded even when an earlier charge succeeded | `orders.test.ts:reports a refund even when an earlier payment…succeeded` | unit | PASS | same |
| 10 | An order with no recorded payment reads as awaiting, not paid | `orders.test.ts:reads as unpaid when no payment has been recorded at all` | unit | PASS | same |
| 11 | Pricing rules are numbered in evaluation order, highest priority first | `pricing.test.ts:numbers rules by the order they are evaluated in…` | unit | PASS | same |
| 12 | A discount renders with a minus sign, so it cannot read as a surcharge | `pricing.test.ts:renders an amount adjustment with its sign…` | unit | PASS | same |
| 13 | A rule whose court was removed still renders a row | `pricing.test.ts:still renders a rule whose court has since been removed` | unit | PASS | same |
| 14 | Hourly utilization counts only the minutes inside each hour | `reports.test.ts:counts only the minutes that fall inside the hour being measured` | unit | PASS | same |
| 15 | Cancelled bookings are excluded from every reported figure | `reports.test.ts:excludes cancelled bookings from every figure on the page` | unit | PASS | same |
| 16 | The current nav section is announced with `aria-current`, not colour alone | `admin-nav.test.tsx:marks the section being viewed as current…` | component | PASS | same |
| 17 | Schedule only lights up at the console root, not on every admin page | `nav-items.test.ts:only marks Schedule active at the console root…` | unit | PASS | same |
| 18 | The schedule legend names every tone used on the grid | `schedule-screen.test.tsx:explains what each colour on the grid means` | component | PASS | same |
| 19 | Each screen states its empty case in words | `schedule-screen.test.tsx`, `bookings-screen.test.tsx`, `orders-screen.test.tsx`, `catalog-screens.test.tsx` | component | PASS | same |
| 20 | Each order row links to its own order, so the panel is shareable | `orders-screen.test.tsx:links each row to its own order…` | component | PASS | same |
| 21 | A hidden product is labelled, not silently shown like a live one | `catalog-screens.test.tsx:marks a product that is not on sale…` | component | PASS | same |
| 22 | A customer who has never visited shows "Never", not an empty cell | `catalog-screens.test.tsx:says a customer has not visited…` | component | PASS | same |
| 23 | Each hour's utilization is available as text, not only as bar height | `reports-screen.test.tsx:states each hour’s utilization as text…` | component | PASS | same |
| 24 | Sign-in confirms identically for staff and non-staff addresses | `staff-sign-in-form.test.tsx:confirms the link was sent without saying whether the address is staff` | component | PASS | same |
| 25 | A sign-in failure is surfaced rather than silently doing nothing | `staff-sign-in-form.test.tsx:surfaces the failure instead of silently doing nothing` | component | PASS | same |

## Coverage

`npx vitest run --coverage` (run into an isolated reports directory, because a
concurrent session was writing to `coverage/` at the same time):

```
All files            |   95.08 |    88.00 |   97.85 |   96.41
 features/admin/ui   |  100.00 |    93.75 |  100.00 |  100.00
 features/admin/view |   99.36 |    90.47 |  100.00 |   99.29
```

Above the project's 80% threshold on every metric.

## Known gaps

- **No mutations from the UI.** Mark paid, refund, block time, new booking, and
  the product/pricing editors are not wired up. The design shows buttons for
  these; they were left out of this pass by agreement, and no non-functional
  buttons were added in their place.
- **Pages are not unit-tested.** `src/app/**` is excluded from coverage by the
  existing project config; the data-loading in the page files is covered only by
  the repository tests underneath it. E2E coverage of `/admin` is not yet added.
- **No pagination.** Every list is bounded by the repositories' `MAX_ROWS` (500);
  a club exceeding that in a window would see a truncated list with no notice.
- **Unrelated failures at the time of writing.** `src/lib/repositories/mappers.test.ts`
  had 3 failing tests from a concurrent session's in-flight work on the `Club`
  type. They fail without these changes and are outside this scope.

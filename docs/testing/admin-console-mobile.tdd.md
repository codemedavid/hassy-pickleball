# Admin console on a phone — TDD evidence

## Source

No `*.plan.md`. Journeys were derived during this TDD run from the user's request:
"can you make the admin dashboard mobile friendly. Make it easier to navigate the
admin".

Scope was confirmed with the user before any test was written. Of three options
offered, they chose **navigation + tables**:

- The console header (`admin-nav.tsx`), which collapses below `lg`.
- Every wide table: Bookings, Courts, Products, Payment methods, Customers.

Out of scope, deliberately, and stated at the time: the schedule grid and the
Reports charts (both stay horizontally scrollable, which is the right affordance
for a time grid and a bar chart), and the editor forms and booking detail panel.
See "Known gaps".

This closes the admin half of the gap `docs/testing/mobile-responsiveness.tdd.md`
left open — that pass fixed the root layout for every page but explicitly deferred
auditing the admin screens at a phone viewport.

## What was wrong

- The header packed the club name, an "Admin" badge, seven tabs, a "Customer site"
  link and the staff name into one 64px row. The tab strip was the flex item that
  gave way, so at 375px it was a few characters wide.
- Every table carried an unconditional `min-w-[...]` between 720px and 1040px
  inside an `overflow-x-auto`, so all five screens were read by dragging sideways.

## User journeys

1. As desk staff on a phone, I want to reach any console section in one tap, so
   that I am not dragging a few-character-wide tab strip.
2. As desk staff on a phone, I want to know which section I am in without opening
   the menu.
3. As desk staff on a phone, I want the menu to close when I pick a section, so it
   does not cover the page I just asked for.
4. As desk staff on a phone, I want each booking, court, product, customer and
   payment method to stack into a card whose values are labelled, so that I can
   read a whole record without scrolling sideways.
5. As a screen-reader user, I want the tables to stay tables, even though the phone
   layout re-flows them.

## Task report

### 1. Navigation collapses behind a toggle

One list of sections, revealed rather than duplicated. A phone-only copy of the
links would double every one of them in the accessibility tree and drift from the
desktop strip the day a section was added, so `data-open` reveals the single list
and `lg:contents` drops the wrapper's box on desktop, letting its children rejoin
the bar's flex row. The mobile and desktop rules are written in disjoint `max-lg:`
and `lg:` variants, so which layout applies never depends on the order Tailwind
emits the classes in.

`currentNavLabel` was added to `nav-items.ts` so the closed toggle names the
section you are in, with a `'Sections'` fallback — a blank there would read as a
rendering fault rather than as an unknown route.

- RED: `npx vitest run src/features/admin/ui/admin-nav.test.tsx src/features/admin/ui/nav-items.test.ts`
  → `currentNavLabel` not exported; no toggle, no `aria-expanded`, no `data-open`.
- GREEN: same command → `Test Files 2 passed (2) / Tests 24 passed (24)`.

### 2. Tables stack into labelled cards below `sm`

`DataTable` / `Row` / `Cell` / `FullWidthRow` were added to `primitives.tsx` and the
five screens migrated onto them. Three things make the stacked layout hold up:

- Overriding `display` on a table drops its implicit ARIA roles in most browsers,
  so `table`, `row`, `columnheader` and `cell` are spelled out.
- The header row goes `sr-only`, not `hidden`, so column names still announce.
- Each cell prints its own column name from `data-label` via a `::before`, because
  a bare value in a card is unattributable.
- `wideClassName` may only carry an `sm:`-prefixed minimum width; the unconditional
  one was the thing forcing the sideways scroll.

- RED: `npx vitest run src/features/admin/ui` → 19 failing, including
  `expected [ null, null, null, null, null ] to deeply equal [ 'Product', 'Type', 'Price', …(2) ]`
  and `Element type is invalid ... got: undefined` for the missing `DataTable`.
- GREEN: `npm test` → `Test Files 97 passed (97) / Tests 1083 passed (1083)`.

### 3. CSS verified in a real build, not in jsdom

jsdom computes no CSS, so the assertions above prove the contract (labels, roles,
breakpoint-scoped widths) but not the layout. `npm run build` was run and the
emitted stylesheet inspected directly:

| Checked | Result |
|---|---|
| `max-sm:before:content-[attr(data-label)]` | emitted as `--tw-content:attr(data-label)` inside `@media not all and (min-width:40rem)` |
| `lg:contents` | emitted as `display:contents` inside `@media (min-width:64rem)` |
| `max-lg:data-[open=true]:flex` | emitted inside the `max-lg` query, at byte 36121 vs `max-lg:hidden` at 35146 — the reveal is later in source order, so it wins |

## Test specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|---|---|---|---|---|
| 1 | The closed phone toggle names the section being viewed | `admin-nav.test.tsx:names the section being viewed on the phone menu button` | unit | PASS | `npx vitest run src/features/admin/ui/admin-nav.test.tsx` |
| 2 | The section menu starts closed | `admin-nav.test.tsx:starts with the phone section menu closed` | unit | PASS | same |
| 3 | Pressing the toggle opens the section list and reflects it in `aria-expanded` | `admin-nav.test.tsx:opens the section list when the phone menu button is pressed` | unit | PASS | same |
| 4 | Choosing a section closes the menu | `admin-nav.test.tsx:closes the menu once a section is chosen` | unit | PASS | same |
| 5 | The toggle controls the one list of sections; no link is duplicated | `admin-nav.test.tsx:points the phone menu button at the one list of sections` | unit | PASS | same |
| 6 | The customer-site link stays reachable inside the phone menu | `admin-nav.test.tsx:keeps the way back to the customer site inside the phone menu` | unit | PASS | same |
| 7 | `currentNavLabel` names the section, incl. nested routes, with a non-blank fallback | `nav-items.test.ts:currentNavLabel` (4 cases) | unit | PASS | `npx vitest run src/features/admin/ui/nav-items.test.ts` |
| 8 | `DataTable` labels every cell by its column, spells out table roles, and scopes its minimum width to `sm` and up | `primitives.test.tsx` (5 cases) | unit | PASS | `npx vitest run src/features/admin/ui/primitives.test.tsx` |
| 9 | Bookings rows stack into labelled cards with table roles intact | `bookings-screen.test.tsx:stacks each row into a labelled card instead of scrolling sideways` | unit | PASS | `npm test` |
| 10 | Courts rows likewise | `courts-screen.test.tsx:stacks each row into a labelled card instead of scrolling sideways` | unit | PASS | `npm test` |
| 11 | Products rows likewise | `products-screen.test.tsx:stacks each row into a labelled card instead of scrolling sideways` | unit | PASS | `npm test` |
| 12 | Payment methods rows likewise | `payment-methods-screen.test.tsx:stacks each row into a labelled card instead of scrolling sideways` | unit | PASS | `npm test` |
| 13 | Customers rows likewise | `customers-screen.test.tsx:stacks each row into a labelled card instead of scrolling sideways` | unit | PASS | `npm test` |
| 14 | Every pre-existing admin behaviour still holds after the migration | `npm test` | regression | PASS | 97 files, 1083 tests |

The shared assertions behind 8–13 live in `test/responsive-table.ts`:
`expectCellsLabelledByColumn`, `expectExplicitTableRoles`, `expectNoPhoneMinimumWidth`.

## Coverage

`npm run test:coverage` → `All files 95.68% statements / 89.48% branches / 96.60%
functions / 97.22% lines`, against the repo's 80% threshold.
`features/admin/ui` sits at 96.52% statements.

`npm run typecheck` and `npm run lint` are both clean.

## Known gaps

- **No measured viewport test.** jsdom computes no CSS, so nothing here proves a
  pixel width. The guarantees are the DOM contract (labels, roles, breakpoint-scoped
  widths) plus the emitted-CSS checks above. A Playwright run at 375px would be the
  real proof; the existing `e2e/` suite needs a running Supabase stack, so it was
  not added in this pass.
- **Untouched by choice**: the schedule grid, the Reports charts, the editor forms
  (court, product, payment method, block time) and the booking detail panel. The
  panel already stacks below `lg` via the Bookings grid, but its internals have not
  been audited at phone width.
- `TABLE_HEAD` and `CELL` stopped being exported from `primitives.tsx` — after the
  migration nothing outside that file used them. Screens compose
  `DataTable`/`Row`/`Cell` instead.

## Merge evidence

Three checkpoint commits on `feat/admin-mobile`, branched from `main`:

1. `4aec20e test: add reproducers for the admin console on a phone` — RED, 19 failing.
2. `3807ac1 feat: run the admin console from a phone` — GREEN, 1083 passing.
3. `refactor: keep the table internals private to primitives` — still green.

If these are squashed, this file is the surviving record of what was verified.

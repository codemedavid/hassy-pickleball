# TDD evidence — one bookings ledger, fully manageable

**Source plan**: inline plan produced by `/ecc:plan` in the same session (not written to a
`.plan.md` file). The three scope decisions were taken by the user before implementation:
delete Orders outright rather than redirect, ship the full action set (confirm / cancel /
complete / record payment / refund), and keep booking details read-only in this slice.

**Scope of this record**: merging the admin console's two ledgers into one, and making the
surviving screen actually manage a booking. No migration, no schema change.

## What was already there

The database has always been bookings-only — there is no orders table, and there never was.
"Orders" was a second reading of the same `bookings` rows, through their `payments`. Three
things were built, tested, and unreachable:

| Built | Where | State before this slice |
|---|---|---|
| `markBookingPaid` / `refundBookingPayment` | `src/features/admin/server/payments.ts` | Exported as server actions, **no UI called them** |
| `updateBookingStatus` | `src/lib/repositories/bookings.ts:113` | Only reachable as a side effect of recording a payment |
| `signPaymentProofUrl` — "a time-boxed link for staff reviewing a payment in the admin console" | `src/features/checkout/server/proof-storage.ts:49` | **Zero callers** |

So the desk could see that a guest had uploaded a GCash screenshot, but could not open it; and
could not confirm the booking it belonged to without recording a payment first. That is the gap
this slice closes.

One real data-layer gap existed: `payments.proof_url` has been a column since
`20260104000000_checkout.sql:65` but was absent from the `Payment` mapper, so nothing read it
back.

## User journeys

1. As club staff, I want every booking and its payment state on one screen, so I stop
   reconciling a transfer on one tab and confirming the booking on another.
2. As club staff, I want to see a confirmed booking whose bank transfer has not cleared, so I
   know who still owes the club.
3. As club staff, I want to open the guest's uploaded proof of payment, so I can confirm a
   transfer without leaving the console.
4. As club staff, I want to confirm, cancel, or complete a booking, so the calendar reflects
   what actually happened.
5. As club staff, I want to record a payment against a booking with the balance already filled
   in, so I do not retype what the screen already knows.
6. As club staff, I want to refund a settled payment, so a cancellation can be made good.
7. As club staff, I want to be offered only the moves that will be accepted, so I never click a
   button that comes back refused.
8. As club staff, I want to link a colleague to the exact booking I am looking at.

## Task report

### Validation commands

| Validation command | Result |
|---|---|
| `pnpm test` (baseline, before any change) | 957 passed / 89 files |
| `pnpm test` (final) | **1001 passed / 90 files**, 0 failed |
| `pnpm lint` | clean, no output |
| `pnpm typecheck` | no errors |
| `pnpm test:coverage` | **96.55%** statements, 89.95% branches, 98.31% functions, 97.56% lines |

Per-directory coverage for the code this slice touched: `features/admin/ui` 98.78% stmts /
96.62% branch, `features/admin/view` 99.45% / 94.50%, `features/admin/server` 98.44% / 91.39%.

### Phase 1 — carry the proof path through the read

Added `proofUrl` to the `Payment` mapper and `proof_url` to the booking detail query.

RED (`pnpm vitest run src/lib/repositories/booking-mappers.test.ts src/lib/repositories/bookings.test.ts`):

```
FAIL  src/lib/repositories/bookings.test.ts > loadBookingDetail > selects the payment proof path
AssertionError: expected '\n  *,\n  booking_courts (id, court_i…' to contain 'proof_url'

 Test Files  2 failed (2)
      Tests  3 failed | 30 passed (33)
```

GREEN: `Test Files 12 passed (12) / Tests 119 passed (119)` across `src/lib/repositories`.

Checkpoint: `096a4a6`.

### Phase 2 — status transitions, judged server-side

New `setBookingStatusSchema` and `src/features/admin/server/bookings.ts`, exposed as
`setBookingStatusAction`.

RED was compile-time — the new test newly referenced a module that did not exist:

```
Error: Failed to resolve import "./bookings" from
"src/features/admin/server/bookings.test.ts". Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```

GREEN: `Tests 12 passed (12)` in `server/bookings.test.ts`; 80 passed across
`src/features/admin/server`.

Checkpoint: `aa696c8`.

### Phase 3 — fold the money columns into the bookings view

`toBookingRows` gained `method` and `paymentStatus`; `toBookingDetailView` replaced
`toOrderDetail` and added the payments list, the outstanding balance, and the legal next moves.
The transition table moved to `src/lib/domain/booking-status.ts` so the console and the server
guard read the same one.

RED (`pnpm vitest run src/features/admin/view/bookings.test.ts src/lib/domain/booking-status.test.ts`):

```
 Test Files  2 failed (2)
      Tests  17 failed | 7 passed (24)
```

GREEN: `Tests 31 passed (31)`. After repointing `server/bookings.ts` at the shared table
(refactor step), `Test Files 36 passed / Tests 429 passed` across `src/features/admin` and
`src/lib/domain`.

Checkpoint: `618d4b4`.

### Phase 4 — the merged screen

`BookingsScreen` became a client component with a detail panel; `BookingDetailPanel` and
`PaymentBadge` are new; `/admin/orders`, `orders-screen.tsx`, `view/orders.ts`, and their tests
were deleted, along with the Orders nav tab.

RED (`pnpm vitest run src/features/admin/ui/bookings-screen.test.tsx src/features/admin/ui/booking-detail-panel.test.tsx`):

```
FAIL  src/features/admin/ui/booking-detail-panel.test.tsx
Error: Failed to resolve import "./booking-detail-panel". Does the file exist?

FAIL  bookings-screen.test.tsx > shows how each booking was paid and whether the money has landed
FAIL  bookings-screen.test.tsx > links each row to itself
FAIL  bookings-screen.test.tsx > opens the selected booking in the panel beside the table

 Test Files  2 failed (2)
      Tests  3 failed | 5 passed (8)
```

GREEN: `Tests 23 passed (23)` across the two files; full suite `1001 passed / 90 files`.

One test was corrected rather than the implementation: "names the booking it is showing"
asserted `getByText('₱600')` on a court-only booking, where the court line and the total are
both ₱600. The assertion was ambiguous, not the code; it now asserts both occurrences.

Checkpoint: `3034741`.

## Test specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|---|---|---|---|---|
| 1 | A payment carries its stored proof path, and cash with no upload reads as having none | `src/lib/repositories/booking-mappers.test.ts:toPayment` | unit | PASS | `pnpm vitest run src/lib/repositories` |
| 2 | The booking detail query asks for `proof_url` | `src/lib/repositories/bookings.test.ts:loadBookingDetail` | integration | PASS | same |
| 3 | A caller with no staff session cannot change a booking's status | `src/features/admin/server/bookings.test.ts` | integration | PASS | `pnpm vitest run src/features/admin/server` |
| 4 | A malformed id, or a status outside the settable set, is refused before any write | same | integration | PASS | same |
| 5 | The transition is judged against the stored row, never the caller's claim | same: "reads the current status from the database" | integration | PASS | same |
| 6 | A cancelled or completed booking cannot be revived | same | integration | PASS | same |
| 7 | Completing a booking that was never confirmed is refused | same | integration | PASS | same |
| 8 | Setting the status a booking already holds is refused | same | integration | PASS | same |
| 9 | One transition table drives both the console's buttons and the server's guard | `src/lib/domain/booking-status.test.ts` | unit | PASS | `pnpm vitest run src/lib/domain` |
| 10 | Payment status is reported separately from booking status | `src/features/admin/view/bookings.test.ts` | unit | PASS | `pnpm vitest run src/features/admin/view` |
| 11 | A refund outranks the charge it reversed when reading the money | same | unit | PASS | same |
| 12 | The outstanding balance ignores failed charges, reopens on a refund, and never goes negative | same | unit | PASS | same |
| 13 | A proof that could not be signed is rendered without a link, not a broken one | same, and `booking-detail-panel.test.tsx` | unit | PASS | same |
| 14 | Both status columns and the payment method appear on every row | `src/features/admin/ui/bookings-screen.test.tsx` | unit | PASS | `pnpm vitest run src/features/admin/ui` |
| 15 | Each row links to itself, so a colleague can be sent the exact booking | same | unit | PASS | same |
| 16 | Only the moves the server would accept are rendered as buttons | `src/features/admin/ui/booking-detail-panel.test.tsx` | unit | PASS | same |
| 17 | A closed booking offers no actions and says why | same | unit | PASS | same |
| 18 | A refused transition surfaces its reason and does not refresh the screen | same | unit | PASS | same |
| 19 | Recording a payment defaults to the outstanding balance and sends cents | same | unit | PASS | same |
| 20 | A blank reference is sent as null; a typed one is sent trimmed | same | unit | PASS | same |
| 21 | A payment of zero is refused before a round trip | same | unit | PASS | same |
| 22 | The proof link opens in a new tab with `rel="noopener"` | same | unit | PASS | same |
| 23 | Refund is offered only on a payment that actually settled | same | unit | PASS | same |
| 24 | The console has no Orders tab, and Bookings claims its nested routes | `src/features/admin/ui/nav-items.test.ts` | unit | PASS | same |

## Coverage and known gaps

`pnpm test:coverage` — 96.55% statements, 89.95% branches, 98.31% functions, 97.56% lines
across the project; thresholds pass.

Deliberate gaps, all of them scope decisions rather than oversights:

- **Booking details are read-only.** Contact info, notes, times, and add-ons cannot be edited
  from the console. Rescheduling in particular needs a staff-side RPC that re-runs the
  exclusion constraint; that is a separate slice.
- **`/admin/orders` now 404s.** Deletion over redirect was chosen explicitly. A one-line
  redirect remains available if bookmarks turn out to matter.
- **Cancelling does not refund.** The two are separate buttons on purpose — refunding a deposit
  for a reschedule is not the same decision as cancelling — and this matches the reasoning
  already recorded in `server/payments.ts`.
- **No E2E coverage of the admin console.** The Playwright suite covers the storefront only
  (`e2e/storefront.spec.ts`, `e2e/court-detail.mobile.spec.ts`); admin has never been in it, and
  this slice did not change that.
- **Concurrent transitions are serialised by the database, not by a version check.** Two staff
  confirming at once both read the stored status, so the second gets a refusal only if the first
  has already committed. The exclusion constraint remains the backstop for the case that
  matters — the slot.

## Merge evidence

Four checkpoint commits on `feat/admin-management`, RED and GREEN recorded in each message:

- `096a4a6` — proof path through the booking detail read (RED 3 failed → GREEN 119 passed)
- `aa696c8` — staff-gated status transitions (RED compile failure → GREEN 12 / 80 passed)
- `618d4b4` — merged view layer + shared transition table (RED 17 failed → GREEN 31 / 429 passed)
- `3034741` — the merged screen, Orders deleted (RED 3 failed → GREEN 23 passed, suite 1001)

If these are squashed, this file is the surviving record.

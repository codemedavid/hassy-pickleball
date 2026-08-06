# TDD evidence — cart drawer

**Reported symptom:** "the cart isnt working, i tried clicking it but nothing happens"

**Source plan:** none. Journeys were derived during this TDD run from the reported
defect and one scope decision confirmed with the user (slide-over drawer, no
checkout button).

## Diagnosis

The cart state machinery was never broken. `src/features/cart/cart-store.ts` and
`src/lib/domain/cart.ts` were correct and covered, and adding a court did update
the header count.

The defect was that the header cart had nothing behind it. In
`src/components/site-header.tsx` the cart was a `<p role="status">` — text, not a
control — and no cart view existed anywhere in the app. Clicking it did nothing
because there was nothing to click. The code documented the choice: _"The count is
a `status` region rather than a link: there is no checkout page yet."_

## User journeys

1. As a customer, I want to click the cart in the header, so that I can see what I
   have picked without leaving the court I am browsing.
2. As a customer, I want each court line to name the court and show its window in
   the club's local time, so that I can tell two bookings apart.
3. As a customer, I want to remove a court or change an add-on quantity from the
   cart, so that I can correct a mistake where I noticed it.
4. As a customer, I want a running total, so that I know what the session costs.
5. As a keyboard or screen-reader user, I want the cart to behave like a modal —
   focus moves in, Escape closes it, focus returns — so that it is usable without
   a mouse.

## Design decision recorded

The drawer renders from the site header, which has no club in scope. Rather than
put a club database read in the root layout — a query on every route, including
`/admin` — each cart line now carries its own `courtName`, `timeZone` and
`currency`, captured at the moment of adding, where the club is already known.
This mirrors how `CartItem` already stored `name` for display.

Consequence: a line persisted in `localStorage` before those fields existed cannot
be rendered honestly, so `readStoredCart` drops it, the same way it already drops
a line with an unparseable date. The cart domain helpers became generic over the
line type (`<T extends CourtSelection>`), so the server-side quote path in
`src/lib/api/quote.ts` keeps using the bare `CourtSelection`.

Per the user's decision, the drawer ends at the total. No checkout control is
rendered while no checkout route exists; a test locks that in so it is a decision
rather than an omission.

## Task report

### 1. RED — reproduce the defect as failing specs

Commit `4256d5c` — `test: add reproducer for the unclickable header cart`

```
npx vitest run src/features/cart src/components/site-header.test.tsx
  Test Files  3 failed | 1 passed (4)
       Tests  11 failed | 21 passed (32)

npx tsc --noEmit
  src/features/cart/ui/cart-drawer.test.tsx(4,28): error TS2307:
    Cannot find module './cart-drawer' or its corresponding type declarations.
  src/components/site-header.test.tsx(7,15): error TS2305:
    Module '"@/lib/domain/cart"' has no exported member 'CartCourtLine'.
```

Both RED forms are present and intended: runtime failures for the header specs
(the cart is not a button, carries no `aria-expanded`, opens no dialog) and
compile-time failure for the drawer module and the line types that did not exist
yet. No failure came from broken setup or an unrelated regression.

### 2. GREEN — implement the drawer

Commit `72f7265` — `fix: open a cart drawer when the header cart is pressed`

```
npx vitest run src/features/cart src/components/site-header.test.tsx \
  src/lib/domain/cart.test.ts src/features/booking
  Test Files  11 passed (11)
       Tests  129 passed (129)

npx tsc --noEmit   → 0 errors under src/
npm run lint       → clean
```

Three drawer specs failed on the first GREEN run because a single-line cart makes
the row price and the cart total the same string, so `getByText` matched twice.
That was a defect in the assertions, not the drawer; they were scoped with
`within(getByRole('listitem'))`. The implementation was not changed to suit them.

### 3. Refactor — `aria-controls` correctness

Commit `68f75b0` — `refactor: point the cart button's aria-controls at the drawer`

`aria-controls` named the `<h2>` inside the dialog rather than the dialog itself.
The id is now exported as `CART_DRAWER_ID` from the drawer so the two cannot
drift. RED on the new assertion, then GREEN: 8 files, 110 tests passed.

## Test specification

| #   | What is guaranteed                                                           | Test                                                                     | Type | Result |
| --- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---- | ------ |
| 1   | The header cart is a button that opens the drawer                            | `site-header.test.tsx:opens the cart drawer when the cart is pressed`    | unit | PASS   |
| 2   | The drawer stays closed until pressed, and reports `aria-expanded`           | `site-header.test.tsx:keeps the drawer closed until the cart is pressed` | unit | PASS   |
| 3   | `aria-controls` resolves to the dialog, not the heading inside it            | `site-header.test.tsx:points aria-controls at the drawer it opens`       | unit | PASS   |
| 4   | Closing returns focus to the cart button                                     | `site-header.test.tsx:returns focus to the cart button`                  | unit | PASS   |
| 5   | The cart button's accessible name carries the count in every state           | `site-header.test.tsx:describes an empty cart in words` (+2)             | unit | PASS   |
| 6   | A closed drawer renders nothing, leaving the page focus order intact         | `cart-drawer.test.tsx:renders nothing while closed`                      | unit | PASS   |
| 7   | The open panel is a modal dialog named "Your cart"                           | `cart-drawer.test.tsx:exposes the open panel as a modal dialog`          | unit | PASS   |
| 8   | An empty cart says so rather than showing a bare panel                       | `cart-drawer.test.tsx:says the cart is empty`                            | unit | PASS   |
| 9   | Court windows render in the club timezone, not the viewer's wall clock       | `cart-drawer.test.tsx:shows a court window in the club timezone`         | unit | PASS   |
| 10  | Court and add-on lines price in the club currency                            | `cart-drawer.test.tsx:prices a court line in the club currency` (+1)     | unit | PASS   |
| 11  | Remove drops only the pressed court, not a sibling on the same court         | `cart-drawer.test.tsx:removes only the pressed court`                    | unit | PASS   |
| 12  | Add-on quantity can be raised, and hits zero by removing the line            | `cart-drawer.test.tsx:raises an add-on quantity` (+1)                    | unit | PASS   |
| 13  | The total sums court time and add-ons                                        | `cart-drawer.test.tsx:totals court time and add-ons together`            | unit | PASS   |
| 14  | Escape and the close button both close the drawer                            | `cart-drawer.test.tsx:closes on Escape` (+1)                             | unit | PASS   |
| 15  | Focus moves into the panel on open                                           | `cart-drawer.test.tsx:moves focus into the panel on open`                | unit | PASS   |
| 16  | No checkout control is offered while no checkout flow exists                 | `cart-drawer.test.tsx:offers no checkout`                                | unit | PASS   |
| 17  | Stored display context round-trips                                           | `cart-store.test.ts:restores the display context`                        | unit | PASS   |
| 18  | A line stored before names were kept is dropped, not rendered nameless       | `cart-store.test.ts:drops a court line stored before names were kept`    | unit | PASS   |
| 19  | An add-on with no currency is dropped rather than priced in the wrong symbol | `cart-store.test.ts:drops an add-on line with no currency`               | unit | PASS   |

## Coverage

```
npx vitest run --coverage src/features/cart src/components/site-header.test.tsx \
  src/lib/domain/cart.test.ts src/components/ui/quantity-stepper.test.tsx

 features/cart      |   94.52 |    90.69 |   95.23 |   94.36 |
  cart-provider.tsx |     100 |    83.33 |     100 |     100 |
  cart-store.ts     |   91.11 |    91.89 |    92.3 |   91.11 |
 features/cart/ui   |     100 |    93.33 |     100 |     100 |
  cart-drawer.tsx   |     100 |    93.33 |     100 |     100 |
```

All above the project's 80% threshold. The repo-wide `npm run test:coverage` could
not be read at the same commit: another branch of in-flight work had landed
`src/features/booking/view/booking-quote.test.ts` importing a module that does not
exist yet, which aborts the coverage report before it prints. That failure is
unrelated to the cart — 605 tests passed alongside it.

## Known gaps

- **No focus trap.** The drawer claims `aria-modal="true"`, focus moves in on open
  and returns on close, and Escape closes it — but Tab can still walk out of the
  panel into the page behind. Worth closing before the cart ships to real users.
- **No scroll lock.** The page behind the drawer still scrolls.
- **No E2E coverage.** `e2e/storefront.spec.ts` does not exercise add-court →
  open-cart → remove. That path needs a running dev server and a seeded database,
  which was not available in this session. The unit specs cover the same journey
  against the real store, so the gap is integration confidence, not behaviour.
- **Add-ons have no UI that creates them.** Item lines are exercised through the
  store in tests; no shop screen exists yet to add one in the product.

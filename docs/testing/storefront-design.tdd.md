# Storefront design pass — TDD evidence

## Source

No `*.plan.md`. Journeys were derived during this TDD run from the Claude Design
project `Pickleball Platform.dc.html` (project `c37c618e-e596-42d6-b3e8-02bab625d7f2`),
read via the `claude_design` MCP. The design's `image-slot.js` / `support.js` are the
preview harness for that HTML and have no production counterpart here — Next.js
`<Image>` and real Supabase data take their place.

Scope: the **customer browse screen** (`<!-- CUSTOMER: BROWSE COURTS -->`) and the
sticky site chrome above it. Later design screens (cart, checkout, café, manage by
reference, mobile) were out of scope for this pass.

## User journeys

1. As a visitor, I want the storefront to read as one branded product from the first
   screen, so that I trust it enough to book.
2. As a visitor comparing courts, I want to switch between a photo-led gallery and a
   dense list, so that I can scan six courts without scrolling past six hero images.
3. As a visitor, I want to see how much of today is still free on each court, so that
   I do not open a court detail page only to find nothing left.
4. As a visitor, I want the filter and layout I picked to survive changing the other
   one, and to be linkable, so that I can share the exact view I am looking at.

## Task report

### 1. Layout as a linkable search param (`court-layout.ts`)

`parseCourtLayout` and `buildCatalogHref` centralise the `filter` + `layout` URL so
switching one control never drops the other, and defaults stay off the URL (one
canonical `/`).

- Validation: `npx vitest run src/features/courts`
- RED: `Failed to resolve import "./court-layout"` — module did not exist.
- GREEN: 13 assertions across `court-layout.test.ts` pass.
- Guarantees: unknown/absent layout degrades to gallery rather than blanking the grid;
  `/?filter=outdoor&layout=compact` round-trips both params.

### 2. Gallery and compact court cards (`court-card.tsx`)

`CourtCard` gained a `layout` prop. Gallery matches the design's 220px hero, badge
overlay, right-aligned Bricolage price with "per hour", rectangular tag chips, and a
bottom action row. Compact is the design's 132×88 thumbnail row with a lime "Book".

- Validation: `npx vitest run src/features/courts`
- RED: `Unable to find an accessible element with the role "link" and name "Book"`,
  `Unable to find an element with the text: per hour`.
- GREEN: all `CourtCard` and `CourtCard, compact layout` specs pass.

### 3. Open-slot counts (`court-card.tsx`, `page.tsx`)

`openSlotCount` is optional on purpose: availability is a service-role read that can
fail independently of the public catalog, and a wrong "Fully booked" costs a booking.
`HomePage` counts today's free start times at `club.minDurationMinutes` via the
existing `getAvailability`, and passes nothing when that read fails.

- Validation: `npx vitest run src/features/courts`
- RED: `Unable to find an element with the text: 7 slots open today`.
- GREEN: counts render, `1 slot` is singular, `0` renders "Fully booked today", and an
  uncovered court claims nothing.

### 4. Navy site chrome (`site-header.tsx`)

Restyled to the design's sticky navy bar with the lime "P" mark and a bordered cart
pill. Behaviour is unchanged, so this is covered by the pre-existing `SiteHeader`
specs (banner landmark, brand href, "Cart empty" / "Cart 3 items") rather than new
ones.

### 5. Cascade defect: invisible call-to-action labels

Rendering the page in Chrome showed every navy button and active chip with no visible
label. Cause: `src/app/globals.css` declared `a { color: var(--color-ink) }` **outside**
any cascade layer, and unlayered rules outrank Tailwind v4's layered `utilities`, so
`text-white` on a link lost. This predated the design pass; the navy chrome made it
visible everywhere.

- Validation: `npx playwright test`
- RED: 3 failed — `Expected "rgb(255, 255, 255)" / Received: "rgb(11, 37, 69)"` on the
  "View & book" link, the active "All courts" chip, and the brand wordmark.
- Fix: moved the element defaults into `@layer base`.
- GREEN: `4 passed (3.9s)`.

## Test specification

| #   | What is guaranteed                                                                     | Test file or command                                                                                                     | Test type | Result | Evidence                             |
| --- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------- | ------ | ------------------------------------ |
| 1   | An unknown `layout` param falls back to gallery instead of an empty grid               | `src/features/courts/court-layout.test.ts:falls back to the gallery layout for an unrecognised value`                    | unit      | PASS   | `npx vitest run src/features/courts` |
| 2   | The default filter and layout produce a bare `/`, so the catalog has one canonical URL | `court-layout.test.ts:is the bare storefront root at the default filter and layout`                                      | unit      | PASS   | `npx vitest run src/features/courts` |
| 3   | Changing layout preserves the active filter and vice versa                             | `courts-browse.test.tsx:keeps the active filter when switching layout`, `:keeps the active layout when switching filter` | unit      | PASS   | `npx vitest run src/features/courts` |
| 4   | The layout toggle marks the active view with `aria-current="page"`                     | `courts-browse.test.tsx:marks the active layout as the current page for assistive tech`                                  | unit      | PASS   | `npx vitest run src/features/courts` |
| 5   | Compact renders rows ("Book"), not gallery cards ("View & book")                       | `courts-browse.test.tsx:renders the compact row rather than the gallery card in the compact layout`                      | unit      | PASS   | `npx vitest run src/features/courts` |
| 6   | A fully booked court says so rather than showing "0 slots open"                        | `court-card.test.tsx:says a fully booked court is fully booked instead of showing "0 slots"`                             | unit      | PASS   | `npx vitest run src/features/courts` |
| 7   | "1 slot" is singular                                                                   | `court-card.test.tsx:says "1 slot" rather than "1 slots" for the last opening`                                           | unit      | PASS   | `npx vitest run src/features/courts` |
| 8   | With no availability data the card claims nothing about openings                       | `court-card.test.tsx:claims nothing about availability when the count could not be loaded`                               | unit      | PASS   | `npx vitest run src/features/courts` |
| 9   | Tournament grade stays visible in the denser compact row                               | `court-card.test.tsx:marks a tournament-grade court here too — density must not hide the grade`                          | unit      | PASS   | `npx vitest run src/features/courts` |
| 10  | Both layouts give the court photo alt text naming the court                            | `court-card.test.tsx:gives the thumbnail alt text naming the court`                                                      | unit      | PASS   | `npx vitest run src/features/courts` |
| 11  | The rate is qualified "per hour", not read as a session total                          | `court-card.test.tsx:qualifies the rate as per hour…`                                                                    | unit      | PASS   | `npx vitest run src/features/courts` |
| 12  | Navy call-to-action labels compute to white in a real browser                          | `e2e/storefront.spec.ts:the "View & book" call to action is legible on its navy button`                                  | e2e       | PASS   | `npx playwright test`                |
| 13  | The active filter chip and brand wordmark are legible on navy                          | `e2e/storefront.spec.ts:the active filter chip is legible on navy`, `:the brand wordmark is legible on the navy header`  | e2e       | PASS   | `npx playwright test`                |
| 14  | Clicking Compact keeps `?filter=indoor` and renders compact rows                       | `e2e/storefront.spec.ts:switching to the compact layout keeps the active filter`                                         | e2e       | PASS   | `npx playwright test`                |

## Coverage

`npx vitest run --coverage` → 43 files, **424 tests passed**.

```
All files          |   93.12 |    84.66 |   96.13 |   95.32 |
```

Above the configured 80% threshold on statements, branches, functions, and lines.
`npm run typecheck` and `npm run lint` are both clean.

## Known gaps

- `src/app/page.tsx` has no test. App Router page components are outside the coverage
  `include` globs project-wide; the logic it adds (`countOpenSlotsToday`) is a thin
  compose over `getAvailability`, which is tested at
  `src/features/booking/server/availability.test.ts`. The failure path (availability
  errors → no counts) is exercised at the component level by test #8, not end to end.
- Open-slot counts are computed at the club's shortest bookable session, which is the
  most openings a court can offer. A visitor who then picks a 120-minute session will
  see fewer usable starts on the detail page. This is deliberate — the card is a
  "worth a look" signal, not a booking guarantee — but it is a known imprecision.
- Design screens beyond browse (cart, checkout, café, manage by reference, mobile)
  are not implemented and were not in scope for this pass.

## Merge evidence

Checkpoint commits on `main`, in order:

- `aa0a122` `test:` — RED, 13 failing specs for the layouts and open-slot counts.
- `97a8a14` `feat:` — GREEN, 422 tests passing, typecheck and lint clean.
- `4339852` `fix:` — RED→GREEN on the cascade defect, 4 e2e tests passing.

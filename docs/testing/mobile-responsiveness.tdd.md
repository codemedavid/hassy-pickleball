# Mobile responsiveness, court detail page — TDD evidence

## Source

No `*.plan.md`. Journeys were derived during this TDD run from the user's
request: "fix the responsiveness of the pages, especially on mobile — let's
start on the court detailed page".

Scope for this pass:

- The court detail page (`/courts/[slug]`) and the components it renders:
  `court-booking-experience.tsx`, `slot-picker.tsx`.
- The root layout, because the root cause of the horizontal overflow lives
  there and affected **every** page, not just this one.
- The site header, because it overflowed at 320px and sits on every page.

Out of scope, deliberately: the catalog, checkout, and admin pages. They
benefit from the root-layout fix but have not been audited or measured at a
phone viewport yet. See "Known gaps".

## User journeys

1. As a customer on a phone, I want the court detail page to fit my screen, so
   that I can read prices and slots without pinch-zooming or scrolling sideways.
2. As a customer on a phone, I want the court name and price readable rather
   than squeezed into a narrow column, so that I can scan the court at a glance.
3. As a customer on a phone, I want the date, duration, and slot controls to be
   comfortably tappable, so that I do not mis-tap while booking.
4. As a customer on a small phone (320px), I want the site header to fit, so
   that the cart stays reachable.

## Task report

### 1. The page rendered wider than the viewport

**Summary.** At a 393px viewport the page laid out 568px wide, so the whole
storefront scrolled sideways and rendered zoomed out.

**Root cause.** `body` is a column flex container (`flex min-h-full flex-col`).
Its children stretch in the cross axis, but Chrome floors that stretch at the
child's *min-content* width. The booking day strip is a `flex` row of
`flex-none` chips, giving it a 462px min-content width, which propagated up
through `main` to the document. `overflow-x-auto` on the strip did not stop the
propagation. Confirmed by direct measurement in the browser: setting
`main { width: 100% }` dropped `document.documentElement.scrollWidth` from 568
to 390.

**Fix.** A `w-full min-w-0 flex-1` wrapper around `{children}` in
`src/app/layout.tsx`. This pins every page to the viewport and lets the scroll
strips inside do the scrolling.

**Validation.**

```
npx playwright test --project=mobile-chrome
```

RED, before the fix:

```
Expected: <= 394
Received:    568
```

and

```
- Array []
+ Array [
+   "MAIN.mx-auto max-w-[1280px] px-7 pb-20 pt-7",
+   "DIV.mt-4 flex flex-col gap-5",
+   "ARTICLE.overflow-hidden rounded-[18px] border border-line bg-surface",
+   ... 12 elements total
+ ]
```

GREEN, after: both tests pass.

### 2. Title and price squeezed; padding and hero too heavy for a phone

**Summary.** The `flex ... justify-between` title/price row gave the court name
under half the screen. Card padding was a flat `p-6`/`px-7`, and the hero was a
fixed `h-[300px]`.

**Fix.** Stack the title above the price below `sm`; `px-4 sm:px-7` on `main`,
`p-5 sm:p-6` on the cards, `h-[200px] sm:h-[300px]` on the hero, and `min-w-0`
on the flex children that hold text.

**Validation.** `the court name is not squeezed into a narrow column by the
price` asserts the `h1` occupies more than 70% of the viewport width. GREEN.

Note: this test passed at RED for the wrong reason — while the page was
overflowing to 568px the heading was already 341px wide. It became a real
guarantee only once task 1 was fixed, and it holds now.

### 3. Tap targets below the WCAG 2.2 minimum

**Summary.** The duration chips measured 38.25px tall; slot rows and grid chips
were comparable.

**Fix.** `min-h-[44px]` on the duration chips and timeline rows, `min-h-[46px]`
on the grid chips, `py-3` on the date chips, `py-2` on the layout toggle.

**Validation.**

RED: `Expected: >= 44 / Received: 38.25`. GREEN after the fix.

### 4. Site header overflowed at 320px

**Summary.** At 320px the cart button's right edge landed at 365px — 45px off
screen.

**Fix.** `gap-2 px-4` below `sm` in the header bar, tighter chip padding, and
the redundant "empty" word hidden below `sm` (the absent count badge already
says it).

**Validation.**

RED: `Expected: <= 321 / Received: 365`. GREEN after the fix.

## Test specification

| # | What is guaranteed | Test file | Test type | Result | Evidence |
|---|--------------------|-----------|-----------|--------|----------|
| 1 | The court detail page does not scroll horizontally at a 393px viewport | `e2e/court-detail.mobile.spec.ts:the page fits the viewport instead of scrolling sideways` | e2e | PASS | `npx playwright test --project=mobile-chrome` |
| 2 | No element outside the marked date strip is pushed past the right edge | `e2e/court-detail.mobile.spec.ts:no element is pushed past the right edge of the viewport` | e2e | PASS | same |
| 3 | The page also fits at 320px, the narrowest viewport in common use | `e2e/court-detail.mobile.spec.ts:the page still fits on the narrowest phones` | e2e | PASS | same |
| 4 | The court name gets more than 70% of the screen width on a phone | `e2e/court-detail.mobile.spec.ts:the court name is not squeezed into a narrow column by the price` | e2e | PASS | same |
| 5 | Date and duration controls are at least 44px tall | `e2e/court-detail.mobile.spec.ts:the date and duration controls are comfortably tappable` | e2e | PASS | same |
| 6 | The add-to-cart button is at least 44px tall | `e2e/court-detail.mobile.spec.ts:the add-to-cart button is comfortably tappable` | e2e | PASS | same |

The desktop suite guards against regression at the other end:

```
npx playwright test --project=chromium
4 passed (1.8s)
```

## Coverage

The unit suite is unchanged by this work — these are layout guarantees that
jsdom cannot measure, so they live in Playwright.

```
npx vitest run --coverage --exclude 'src/components/ui/skeleton.test.tsx' --exclude 'src/app/loading-states.test.tsx'
 Test Files  79 passed (79)
      Tests  782 passed (782)
All files    |   95.44 |    87.24 |   98.51 |   97.28 |
```

Above the 80% threshold on all four metrics.

The two exclusions are **pre-existing untracked WIP files** unrelated to this
change (`skeleton.test.tsx` imports a `./skeleton` module that does not exist;
`loading-states.test.tsx` imports four `loading` modules that do not exist).
They break `pnpm test:coverage` and `pnpm typecheck` today, on `main` as much as
here. They were left untouched rather than folded into this change.

## Known gaps

- Only `/courts/[slug]` has been measured at a phone viewport. The catalog,
  checkout, and admin pages inherit the root-layout fix — which was the shared
  root cause — but their own padding, tap targets, and table layouts have not
  been audited. Each needs its own `*.mobile.spec.ts` pass.
- Tap-target assertions cover the date, duration, and add-to-cart controls. The
  individual slot rows are set to `min-h-[44px]` in CSS but are not asserted.
- Tested on `devices['Pixel 5']` (Chromium) only. No Safari/WebKit run, so
  iOS-specific issues (safe-area insets, `100vh`) are unverified.

## Merge evidence

Three checkpoint commits on `feat/admin-management`:

| Commit | Stage |
|--------|-------|
| `9a44bca` | RED — mobile reproducers added, 3 failing for the intended reasons |
| `9dd9730` | GREEN — court detail page fits phone viewports |
| `8949e8b` | GREEN — site header fits 320px |

If squashed, the RED/GREEN summary above should be copied into the PR body.

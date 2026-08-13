# TDD evidence — route loading states

## Source plan

No `*.plan.md`. This run closes a gap that was recorded, not invented: the
"Coverage" section of [`mobile-responsiveness.tdd.md`](./mobile-responsiveness.tdd.md)
documented two untracked WIP test files that broke `test:coverage` and
`typecheck`, and left them untouched rather than folding them into that change.

## Starting position

Two test files existed in the working tree with no implementation behind them:

| File                                  | Imported module                                                                 | Existed? |
| ------------------------------------- | ------------------------------------------------------------------------------- | -------- |
| `src/components/ui/skeleton.test.tsx` | `./skeleton`                                                                    | No       |
| `src/app/loading-states.test.tsx`     | `./loading`, `./courts/[slug]/loading`, `./checkout/loading`, `./admin/loading` | No       |

`find src/app -name "loading.tsx"` returned nothing, so no route segment had a
Suspense boundary. Every page in this app awaits a database read in a Server
Component, which means the browser held the previous page until the slowest
query returned.

## User journeys

1. As a visitor on a slow connection, I want the page shell to appear
   immediately, so a tap does not feel like a dropped click.
2. As a screen reader user, I want to hear what is loading, so the wait is
   announced rather than silent.
3. As a screen reader user, I do not want to hear each placeholder box, so the
   announcement is one message rather than a wall of empty boxes.

## Task report

### 1. RED — confirm the reproducers fail for the intended reason

Both files were run as-is before any production code was written.

```
npm test
 FAIL  src/app/loading-states.test.tsx
Error: Failed to resolve import "./loading" from "src/app/loading-states.test.tsx". Does the file exist?
 FAIL  src/components/ui/skeleton.test.tsx
Error: Failed to resolve import "./skeleton" from "src/components/ui/skeleton.test.tsx". Does the file exist?

 Test Files  2 failed | 87 passed (89)
      Tests  940 passed (940)
```

This is compile-time RED: the failure is the missing implementation the tests
describe, not broken setup or an unrelated regression. `npm run typecheck`
agreed, with five `TS2307: Cannot find module` errors across the same imports.
`npm run lint` was already clean, confirming the failure was not stylistic.

### 2. GREEN — the primitive

`src/components/ui/skeleton.tsx` adds two exports:

- `Skeleton` — `aria-hidden="true"`, with sizing supplied by the caller via
  `className`, so one primitive covers headings, cards, and rows. Uses
  `animate-pulse` paired with `motion-reduce:animate-none`.
- `LoadingScreen` — `role="status"`, `aria-label={label}`, `aria-busy="true"`,
  rendering the placeholders it is given.

The split is what makes journeys 2 and 3 hold together: the placeholders are
silent, and the one wrapper carries the message.

### 3. GREEN — the four route boundaries

One `loading.tsx` per segment that awaits a read, each naming its own wait
rather than a generic "Loading":

| Route                               | Label            |
| ----------------------------------- | ---------------- |
| `src/app/loading.tsx`               | Loading courts   |
| `src/app/courts/[slug]/loading.tsx` | Loading court    |
| `src/app/checkout/loading.tsx`      | Loading checkout |
| `src/app/admin/loading.tsx`         | Loading console  |

Verified GREEN on the two previously-failing files first:

```
npx vitest run src/components/ui/skeleton.test.tsx src/app/loading-states.test.tsx
 Test Files  2 passed (2)
      Tests  13 passed (13)
```

Then the full suite, with no exclusions:

```
npm test
 Test Files  89 passed (89)
      Tests  953 passed (953)
```

`npm run typecheck` and `npm run lint` both pass with no output.

### 4. Build verification

`loading.tsx` is a Next.js file convention, so jsdom tests alone do not prove
the boundaries are wired into the router. The production build confirms all four
segments resolve:

```
npm run build
✓ Compiled successfully in 2.5s
✓ Generating static pages using 9 workers (14/14) in 182ms
Route (app)
┌ ƒ /
├ ƒ /admin
├ ƒ /checkout
├ ƒ /courts/[slug]
```

## Test specification

| #     | What is guaranteed                                                                                                                 | Test file or command                                                                            | Test type | Result | Evidence                                 |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------- | ------ | ---------------------------------------- |
| 1     | A skeleton is hidden from assistive tech, so a screen reader hears one message rather than a wall of empty boxes                   | `src/components/ui/skeleton.test.tsx:is hidden from assistive tech`                             | unit      | PASS   | `npx vitest run skeleton.test.tsx`       |
| 2     | A skeleton takes its size from the caller, so one primitive covers headings, cards, and rows                                       | `src/components/ui/skeleton.test.tsx:takes its size from the caller`                            | unit      | PASS   | same                                     |
| 3     | The loading region names what is loading, so the wait is announced rather than silent                                              | `src/components/ui/skeleton.test.tsx:names what is loading`                                     | unit      | PASS   | same                                     |
| 4     | The loading region is marked busy while placeholders stand in for real content                                                     | `src/components/ui/skeleton.test.tsx:marks the region busy`                                     | unit      | PASS   | same                                     |
| 5     | The loading region renders the placeholders it was given                                                                           | `src/components/ui/skeleton.test.tsx:renders the placeholders it was given`                     | unit      | PASS   | same                                     |
| 6–9   | Each of the four segments — catalog, court detail, checkout, admin — has a `loading.tsx` that announces its wait to assistive tech | `src/app/loading-states.test.tsx:announces the wait to assistive tech` (×4 via `describe.each`) | unit      | PASS   | `npx vitest run loading-states.test.tsx` |
| 10–13 | Each of the four segments marks itself busy so placeholders are not mistaken for real content                                      | `src/app/loading-states.test.tsx:marks itself busy` (×4 via `describe.each`)                    | unit      | PASS   | same                                     |
| 14    | All four route segments compile and register as routes                                                                             | `npm run build`                                                                                 | build     | PASS   | build output above                       |

## Coverage

`test:coverage` now runs clean with **no exclusions** — the two `--exclude`
flags that `mobile-responsiveness.tdd.md` had to pass are no longer needed.

```
npm run test:coverage
Statements   : 96.52% ( 1637/1696 )
Branches     : 89.52% ( 949/1060 )
Functions    : 98.58% ( 557/565 )
Lines        : 97.57% ( 1569/1608 )
```

Above the 80% threshold on all four metrics. `src/components/ui/skeleton.tsx`
does not appear in the coverage table because the reporter lists only files with
uncovered lines — it is at 100% on all four.

## Known gaps

- The `loading.tsx` files themselves are not measured by the coverage report:
  `vitest.config.ts` limits `coverage.include` to `src/lib`, `src/features`, and
  `src/components`, so `src/app/**` is out of scope by existing project
  convention. They are still executed and asserted by `loading-states.test.tsx`.
- The skeleton shapes are not asserted against the real page layouts. A skeleton
  that no longer resembles what loads underneath it will not fail any test; that
  is a visual-regression concern, not a unit one.
- No test asserts the boundary actually streams — jsdom renders the component
  directly. Proving Suspense behaviour end to end would need a Playwright run
  against a throttled network.
- Only segments that await a read got a boundary. `src/app/staff` and
  `src/app/courts` (the index) were not given one and were not audited.

## Merge evidence

Two checkpoint commits on `feat/admin-management`:

| Commit                                                                      | Stage | Evidence captured                                                                                                      |
| --------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------- |
| `test: add reproducers for the shared skeleton and route loading states`    | RED   | 2 suites fail to resolve `./skeleton` and four `loading` modules; 5 matching `TS2307` errors; 940 other tests pass     |
| `feat: announce and stream the wait on every route that reads the database` | GREEN | 13 previously-failing tests pass; 953/953 suite; typecheck and lint clean; `npm run build` registers all four segments |

No refactor commit: the implementation was small enough that the GREEN shape was
the final shape.

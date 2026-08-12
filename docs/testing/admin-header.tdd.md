# TDD Evidence — Hide the storefront header on admin routes

## Source plan

No `*.plan.md` was supplied. The journey below was derived during this TDD run
from the request "remove the header of the storefront when on the admin".

## User journeys

- As a staff member working in the admin console, I want the storefront header
  gone, so that the console's own nav is the only chrome and the customer cart
  is not offered to me while I administer the club.
- As a customer browsing the storefront, I want the header to keep working
  exactly as before, so that nothing about booking changes.

## Task report

**Summary.** `SiteHeader` is rendered by the root layout, which also wraps
`/admin`, so the console showed both the storefront bar and `AdminNav`. The
header is already a Client Component, so it reads `usePathname()` and returns
`null` on the console. The early return sits after every hook call so hook order
stays stable when navigating between the storefront and the console.

**RED** — `npx vitest run src/components/site-header.test.tsx`

```
 Test Files  1 failed (1)
      Tests  3 failed | 13 passed (16)
expected document not to contain element, found <button aria-controls="cart-drawer" ...>Cart empty</button> instead
 ❯ src/components/site-header.test.tsx:212
```

The three failures were the three admin cases, each failing because the header
was still rendered. The prefix-boundary case (`/administration-guide`) passed in
RED, as expected — it asserts the pre-existing behaviour is preserved.

**GREEN** — same command after the fix:

```
 Test Files  1 passed (1)
      Tests  16 passed (16)
```

**Regression** — `npx vitest run`

```
 Test Files  89 passed (89)
      Tests  957 passed (957)
```

`npx tsc --noEmit` exited 0. `npm run lint` reported no findings.

**Guaranteed by the passing tests.** The storefront header — banner landmark and
cart control alike — is absent on `/admin` and every nested console section, is
present on storefront routes, and the match is on a path boundary rather than a
bare string prefix.

## Test specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|--------------------|----------------------|-----------|--------|----------|
| 1 | No banner landmark renders on the console root `/admin` | `src/components/site-header.test.tsx:renders no storefront chrome on the console root` | unit | PASS | `npx vitest run src/components/site-header.test.tsx` |
| 2 | No banner landmark renders on a nested section such as `/admin/courts` | `src/components/site-header.test.tsx:renders no storefront chrome on a nested console section` | unit | PASS | same |
| 3 | The customer cart control is not offered anywhere in the console | `src/components/site-header.test.tsx:hides the cart control along with the rest of the header` | unit | PASS | same |
| 4 | A storefront path that merely starts with the same letters (`/administration-guide`) keeps its header | `src/components/site-header.test.tsx:keeps the header on a storefront route that merely starts with the same letters` | unit | PASS | same |
| 5 | Every pre-existing storefront header behaviour (brand link, cart count, drawer open/close, focus return) is unchanged | `src/components/site-header.test.tsx` (13 existing cases) | unit | PASS | same |

## Coverage and known gaps

`npx vitest run --coverage.enabled --coverage.include='src/components/site-header.tsx' src/components/site-header.test.tsx`

```
Statements   : 100% ( 15/15 )
Branches     : 100% ( 8/8 )
```

Known gaps:

- `/staff/sign-in` still renders the storefront header. It was left alone
  deliberately — the request named the admin console only.
- No E2E test was added; the behaviour is a pure render decision from the
  pathname and is fully covered at the unit level.

## Merge evidence

RED: 3 admin cases failed on `site-header.test.tsx` because the header rendered
on `/admin`. GREEN: 16/16 in that file, 957/957 across the suite, `tsc --noEmit`
clean, `npm run lint` clean. No separate refactor step was needed — the fix is a
guard clause plus a named `isAdminRoute` helper.

Checkpoint commits on `feat/admin-management`:

- `dfd63fb test: add reproducer for hiding the storefront header on admin routes` (RED)
- `5f80ddb feat: hide the storefront header on admin console routes` (GREEN)

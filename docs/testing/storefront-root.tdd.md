# TDD Evidence — Storefront at the root

**Source plan**: no `*.plan.md` artifact. The request was a screenshot of
`localhost` showing the placeholder home page with "we want to be able to see
here the storefront". Two routing/scope decisions were confirmed with the user
before any code was written:

1. `/` becomes the storefront (the catalog itself), `/courts` redirects to `/`,
   court detail stays at `/courts/[slug]`.
2. A shared site header with a cart indicator ships as part of this change.

---

## User journeys

1. As a visitor, I want the courts catalog on the page I land on, so that I can
   start booking without hunting for a link.
2. As a visitor following an old `/courts` link or bookmark, I want to land on
   the same catalog with my filter intact, so that the move does not break what
   I saved.
3. As a visitor anywhere in the site, I want a persistent header, so that I can
   get back to the catalog and see what is already in my cart.

---

## Task report

### Task 1 — Extract the catalog into a shared component rendered at `/`

`CourtsBrowse` holds the header, filter chips, and grid that previously lived
inline in `src/app/courts/page.tsx`. `src/app/page.tsx` now fetches the club and
courts and renders it. Filter links point at `/` and `/?filter=<id>` so there is
one canonical catalog URL.

- Validation command: `pnpm vitest run src/features/courts/courts-browse.test.tsx`
- RED output excerpt:
  ```
  FAIL  src/features/courts/courts-browse.test.tsx
  Error: Failed to resolve import "./courts-browse" from
  "src/features/courts/courts-browse.test.tsx". Does the file exist?
  ```
- GREEN output excerpt:
  ```
  Test Files  3 passed (3)
       Tests  14 passed (14)
  ```
- Guaranteed: the headline reports the court count and club hours; filter chips
  link at the root; the active chip is `aria-current="page"`; only matching
  courts render; an empty result is explained rather than blank; prices use the
  club currency.

### Task 2 — Redirect the legacy `/courts` catalog route

`src/app/courts/page.tsx` is now a `permanentRedirect` (308) to `/`, carrying an
active filter across. `/courts/[slug]` is a separate route and is unaffected.

- Validation command: `pnpm vitest run src/app/courts/page.test.ts`
- RED output excerpt (the route still ran the old catalog fetch):
  ```
  FAIL  src/app/courts/page.test.ts > permanently redirects to the storefront root
  Error: Invalid public environment: NEXT_PUBLIC_SUPABASE_URL: ...
   ❯ createSupabaseServerClient src/lib/supabase/server.ts:13:15
   ❯ CourtsPage src/app/courts/page.tsx:25:24
  ```
- GREEN: both cases pass; verified over HTTP against the running dev server:
  ```
  /courts               -> 308 -> http://localhost:3000/
  /courts?filter=indoor -> 308 -> http://localhost:3000/?filter=indoor
  ```
- Guaranteed: old links resolve to the storefront, with the filter preserved.

### Task 3 — Site header with a cart indicator

`SiteHeader` is a Client Component in the root layout, reading `summary` from
the existing cart store. The count is a `status` region, not a link: there is no
cart/checkout route yet, and linking to a 404 is worse than a summary.

- Validation command: `pnpm vitest run src/components/site-header.test.tsx`
- RED output excerpt:
  ```
  Error: Failed to resolve import "./site-header" from
  "src/components/site-header.test.tsx". Does the file exist?
  ```
- One test then failed for a real test-isolation reason — the cart store caches
  its snapshot module-side, so one test's cart leaked into the next
  (`Expected "Cart 1 item" / Received "Cart 3 items"`). Fixed in the test by
  calling the store's existing `resetCartSnapshot()` seam in `afterEach`; no
  production behaviour was changed to make the test pass.
- Guaranteed: the header is a `banner` landmark; the brand and Courts links
  point at `/`; an empty cart reads "Cart empty"; courts and add-on quantities
  are summed; the noun is singular for one item.

---

## Test specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|--------------------|----------------------|-----------|--------|----------|
| 1 | The catalog headline reports the court count and club opening hours | `src/features/courts/courts-browse.test.tsx:headlines the catalog…` | unit | PASS | `pnpm vitest run src/features/courts/courts-browse.test.tsx` |
| 2 | Filter chips link at `/` and `/?filter=<id>`, so the root is the canonical catalog | `courts-browse.test.tsx:links filter chips at the storefront root` | unit | PASS | same |
| 3 | The active filter is exposed as `aria-current="page"` | `courts-browse.test.tsx:marks the active filter…` | unit | PASS | same |
| 4 | Only courts matching the active filter render | `courts-browse.test.tsx:renders only the courts matching…` | unit | PASS | same |
| 5 | An empty filter result is explained instead of a blank grid | `courts-browse.test.tsx:explains an empty result…` | unit | PASS | same |
| 6 | Court prices use the club's currency | `courts-browse.test.tsx:prices courts in the club currency` | unit | PASS | same |
| 7 | `/courts` permanently redirects to the storefront root | `src/app/courts/page.test.ts:permanently redirects…` | integration | PASS | `pnpm vitest run src/app/courts/page.test.ts`; `curl -o /dev/null -w '%{http_code} %{redirect_url}' localhost:3000/courts` → `308 http://localhost:3000/` |
| 8 | An active filter survives the redirect | `page.test.ts:carries an active filter across the redirect` | integration | PASS | same; `/courts?filter=indoor` → `308 …/?filter=indoor` |
| 9 | The header is a `banner` landmark | `src/components/site-header.test.tsx:exposes the header as a banner landmark` | unit | PASS | `pnpm vitest run src/components/site-header.test.tsx` |
| 10 | The brand mark and Courts link point at the storefront root | `site-header.test.tsx:points the brand mark…` / `links the catalog…` | unit | PASS | same |
| 11 | An empty cart reads as empty rather than a zero badge | `site-header.test.tsx:describes an empty cart in words` | unit | PASS | same |
| 12 | Booked courts and add-on quantities are counted together | `site-header.test.tsx:counts booked courts and add-on quantities` | unit | PASS | same |
| 13 | A single selection reads "1 item", not "1 items" | `site-header.test.tsx:says "1 item"…` | unit | PASS | same |

Full suite after the change: `pnpm test` → **42 files, 396 tests passed**.
`pnpm typecheck` and `pnpm lint` both clean.

---

## Coverage and known gaps

- Command: `pnpm test:coverage`
- Result: **92.82% statements / 83.68% branches / 95.97% functions / 95.11%
  lines** — above the configured 80% thresholds, which pass.
- `vitest.config.ts` coverage `include` was widened to cover
  `src/components/**/*.tsx`; the directory had tests but was never counted.
- **Gap — no E2E for this change.** `playwright.config.ts` boots a real server,
  which needs a migrated database (see below). The redirect and the header were
  instead verified over HTTP against the running dev server; the catalog render
  could not be verified end to end.
- **Blocker — the storefront cannot render against the current database.** The
  linked Supabase project has no schema: `GET /` returns 500 with
  `RepositoryError: Failed to load club: Could not find the table 'public.clubs'
  in the schema cache`. This predates this change and is not caused by it — the
  migrations in `supabase/migrations/` have never been applied to that project.
  Running `pnpm db:push` (and `pnpm db:seed:remote`) against the remote database
  is left to the operator.

---

## Merge evidence

- RED checkpoint: `2c08ff8` — `test: add failing specs for the storefront root,
  site header, and legacy courts redirect`
- GREEN checkpoint: `aa9a39b` — `feat: serve the storefront at the root with a
  site header`
- Refactor checkpoint: coverage `include` widened to `src/components`, suite
  still green.

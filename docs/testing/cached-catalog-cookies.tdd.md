# TDD evidence — `cookies()` inside the cached catalog read

## Source

No plan file. The journey was derived from a production failure report: `GET /` returned 500 with

```
Route / used `cookies()` inside a function cached with `unstable_cache()`.
    at createSupabaseServerClient (src/lib/supabase/server.ts:14:36)
    at readCatalog (src/features/courts/catalog.ts:33:50)
    at HomePage (src/app/page.tsx:29:19)
```

## User journey

As a visitor, I want the storefront at `/` to load the club and its courts, so that I can browse
and book a court — even though that catalog read is cached and shared across visitors.

## Root cause

`loadCatalog` wraps `readCatalog` in `unstable_cache`. `readCatalog` built its Supabase client with
`createSupabaseServerClient()`, which awaits `cookies()`. Next.js forbids reading request state
inside a cache scope, because the cached value is shared across visitors and must not capture one
visitor's request. Every render of `/` threw.

The catalog rows are public (`clubs_public_read`, `courts_public_read`) and identical for every
visitor, so they never needed a cookie-bound client in the first place.

## Task report

| Step | Summary |
|---|---|
| RED | Added `src/features/courts/catalog.test.ts`, which stands in an `unstable_cache` scope and makes the cookie-bound client throw the exact production error inside it. Ran the target: 3 failed for that reason. |
| GREEN | Added `createSupabasePublicClient()` (anon key, no cookies, no session) and switched `readCatalog` to it. Same target: 3 passed. |
| Refactor | None needed — the fix is a two-line swap plus one new factory. |

### RED

```
npx vitest run src/features/courts/catalog.test.ts

 FAIL  src/features/courts/catalog.test.ts > loadCatalog > reads the club and its courts without touching request state
Error: Route / used `cookies()` inside a function cached with `unstable_cache()`.
 ❯ readCatalog src/features/courts/catalog.ts:33:24
 ❯ loadCatalog src/features/courts/catalog.ts:51:5

 Test Files  1 failed (1)
      Tests  3 failed (3)
```

Checkpoint commit: `6f2e6d6 test: add reproducer for cookies() inside the cached catalog read`

### GREEN

```
npx vitest run src/features/courts/catalog.test.ts
 Test Files  1 passed (1)
      Tests  3 passed (3)

npm test
 Test Files  65 passed (65)
      Tests  627 passed (627)

npm run typecheck   # clean
npm run lint        # clean
```

Checkpoint commit: `c8c5bb7 fix: read the cached catalog with a cookie-free anon client`

### Live verification

```
npm run dev
curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/   → 200
```

The dev log contains no `unstable_cache` / `cookies()` error, and the rendered page includes the
storefront `<h1>`.

## Test specification

| # | What is guaranteed | Test | Type | Result | Evidence |
|---|---|---|---|---|---|
| 1 | The cached catalog read never touches per-request state, so `/` renders instead of throwing | `src/features/courts/catalog.test.ts:reads the club and its courts without touching request state` | unit | PASS | `npx vitest run src/features/courts/catalog.test.ts` |
| 2 | An unknown club slug yields `null` and skips the court query | `src/features/courts/catalog.test.ts:returns null when the club slug does not exist` | unit | PASS | same |
| 3 | Club and courts are read through one client, not two | `src/features/courts/catalog.test.ts:reads courts with the same client used for the club` | unit | PASS | same |
| 4 | The storefront root responds 200 with the fix applied | manual dev-server check | smoke | PASS | `curl http://localhost:3000/` → 200 |

## Coverage

```
npm run test:coverage
Statements   : 95.72% ( 1098/1147 )
Branches     : 88.1%  ( 674/765 )
Functions    : 98.22% ( 388/395 )
Lines        : 97.03% ( 1046/1078 )
```

Above the 80% threshold on every metric.

## Known gaps

- `src/lib/supabase/**` is excluded from coverage by `vitest.config.ts` (thin SDK factories with no
  branching), so `createSupabasePublicClient` itself is covered only indirectly — the dev-server
  200 is what proves it constructs a working client against a real project.
- The tests assert the *absence* of request-state access by simulating the cache scope. They do not
  exercise the real `unstable_cache`; the live `GET /` check covers that.
- Anon RLS is what keeps this client safe for shared caching. If the catalog ever needs a row that
  is not public, it must move out of the cached path rather than switch clients here.

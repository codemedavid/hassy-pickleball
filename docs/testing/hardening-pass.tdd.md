# TDD evidence — audit hardening pass

Scope: bug/vulnerability/over-engineering audit, plus rendering, caching, and
rate limits. Journeys were derived during this TDD run; there was no plan file.

## User journeys

1. As an operator, I want a rate limit that still holds when its own counter is
   broken, so a caller who can break the counter does not get unlimited attempts.
2. As an operator, I want every service-role server action metered, so an
   anonymous caller cannot drive privileged reads and writes without bound.
3. As a customer, I want the catalog to render even when a court has a photo,
   and even when the availability read fails.
4. As a customer, I want a bad `?day=` or `?filter=` in a shared link to degrade
   to a sensible view rather than showing "Invalid Date" or echoing itself back.
5. As a visitor, I want the storefront to load without re-reading rows that are
   identical for every visitor.

## Task report

| Task | Validation command | RED | GREEN |
|---|---|---|---|
| Fail-closed limiter (`consumeRateLimit`) | `pnpm vitest run src/lib/security` | module absent — import failure | 20 passed |
| Client-address identity | `pnpm vitest run src/lib/security` | module absent — import failure | included above |
| Rate limit on `cancelBooking` | `pnpm vitest run src/features/booking/server` | `expected {success:true} to match {code:'RATE_LIMITED'}` | passed |
| Fail-closed on lookup + reschedule | `pnpm vitest run src/features/booking/server` | same, 4 cases | passed |
| `countOpenSlots` without duplicate reads | `pnpm vitest run src/features/booking/server` | module absent — import failure | 8 passed |
| `parseCourtFilter` | `pnpm vitest run src/features/courts/court-filters.test.ts` | `parseCourtFilter is not a function` | 4 passed |
| `parseDayString` | `pnpm vitest run src/lib/format/time.test.ts` | `parseDayString is not a function` | 5 passed |

Full RED run: `Test Files 9 failed | 44 passed`, `Tests 16 failed | 465 passed`.
Full GREEN run over the touched scope: `Test Files 10 passed`, `Tests 115 passed`.

## What is guaranteed

| # | Guarantee | Test | Type |
|---|---|---|---|
| 1 | The limiter denies when its RPC errors, returns null, or throws | `src/lib/security/rate-limit.test.ts` | unit |
| 2 | Buckets are namespaced, so browsing cannot exhaust booking | `src/lib/security/rate-limit.test.ts` | unit |
| 3 | The action does not run once the limit is spent | `src/lib/security/rate-limit.test.ts` | unit |
| 4 | Callers are keyed on a hashed client address, never the raw one | `src/lib/security/request-identity.test.ts` | unit |
| 5 | `cancelBooking` refuses when limited or when the limiter breaks | `src/features/booking/server/lifecycle.test.ts` | unit |
| 6 | Email casing does not open a fresh lookup budget | `src/features/booking/server/lifecycle.test.ts` | unit |
| 7 | Open-slot counts never re-read the club, courts, or pricing rules | `src/features/booking/server/open-slots.test.ts` | unit |
| 8 | A failed availability read yields `undefined`, not a wrong count | `src/features/booking/server/open-slots.test.ts` | unit |
| 9 | Busy ranges are asked for over the club-local day, not a UTC one | `src/features/booking/server/open-slots.test.ts` | unit |
| 10 | An unrecognised `?filter=` normalises to `all` before reaching links | `src/features/courts/court-filters.test.ts` | unit |
| 11 | A malformed `?day=` falls back instead of becoming `Invalid Date` | `src/lib/format/time.test.ts` | unit |

## Known gaps

- `next.config.ts` (remote image host, security headers) and `src/proxy.ts`
  (skipping the auth round trip without a session cookie) are config and
  middleware, not covered by the unit suite. Both need an E2E or a running
  server to assert; neither has a test here.
- `src/features/courts/catalog.ts` wraps `unstable_cache`, which needs a Next
  request scope. Untested here — the cached functions it calls are covered.
- Coverage was not re-measured: the repository's full suite is red from work in
  progress in another session (see below), so a coverage run would not be
  attributable to this change.

## Concurrency note

Three other `claude` sessions were writing to this working tree during this
pass. The failures in `src/features/cart/**` and `src/components/site-header*`
at the end of this run belong to that work, not to this one.

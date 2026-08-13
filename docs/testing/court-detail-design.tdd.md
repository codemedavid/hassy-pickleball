# TDD evidence — court detail page redesign

**Source design**: Claude Design project `c37c618e-e596-42d6-b3e8-02bab625d7f2`,
`Pickleball Platform.dc.html` — section `CUSTOMER: COURT DETAIL + SLOT PICKER`
(markup lines 147–292, view model lines 1163–1230), imported via the
`claude_design` MCP. No plan file; journeys were derived during this run from
the design itself.

## User journeys

1. As a visitor sizing up a court, I want a photo, the tags, what is included
   and what to know, so that I can judge the court before opening a calendar.
2. As a visitor, I want to move between the next seven days and four session
   lengths, so that I can find a time that fits without guessing at URLs.
3. As a visitor, I want to read a day either as a timeline with wording and
   prices or as a dense grid of start times, so that I can scan fifteen hours
   without scrolling past fifteen rows.
4. As a visitor, I want taken slots shown in place rather than hidden, so that
   I can tell a busy day from a short one.
5. As a visitor, I want a running total that reflects my slot and my extras
   before I commit, so that the cart holds no surprises.

## Schema changes

Three shape changes in `supabase/migrations/20260103000000_court_detail.sql`,
each driven by something the design renders that the schema could not supply:

| Change                                                                       | Why                                                                                                                                                               |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `courts.notes` `text` → `text[] not null default '{}'`                       | The design lists "Good to know" as separate lines. Existing scalar values convert to one-element arrays, so no copy is lost.                                      |
| `clubs.phone`, `clubs.cancellation_window_hours`, `clubs.group_booking_note` | The sidebar shows a desk number, a free-cancellation window, and a group-booking note. These are club policy, so they are editable data rather than JSX literals. |
| `clubs.min_duration_minutes` default `60` → `30`                             | The design offers a 30 minute session, which `getAvailability` would otherwise reject. `slot_minutes` was already 30, so the grid needed no change.               |

`supabase/seed.sql` was updated to match. `src/lib/supabase/database.types.ts`
was hand-synced to what `npm run db:types` would emit — **the `supabase` CLI is
not installed in this environment, so the migration has not been executed
against a live database.** See "Known gaps".

## Task report

| Task                                                       | Validation run                                                             | Result                                                                   |
| ---------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Court/club mapper carries arrays and the new policy fields | `npx vitest run src/lib/repositories/mappers.test.ts`                      | RED (`expected null to deeply equal []`, `club.phone` undefined) → GREEN |
| Date strip, duration pills, slot row states                | `npx vitest run src/features/booking/view`                                 | RED (module not found) → GREEN, 22 tests                                 |
| Sidebar price lines and total                              | `npx vitest run src/features/booking/view`                                 | RED (module not found) → GREEN, 9 tests                                  |
| Picker + sidebar behaviour                                 | `npx vitest run src/features/booking/ui/court-booking-experience.test.tsx` | RED (module not found) → GREEN, 11 tests                                 |
| Page, migration, seed, fixtures                            | `npm run lint && npx tsc --noEmit && npm run build`                        | clean                                                                    |

RED was confirmed before any implementation file existed: the first run of the
two view-model specs failed at import (`Failed to resolve ./court-detail`), and
`mappers.test.ts` failed on the assertions themselves, not on setup.

## Test specification

| #   | What is guaranteed                                                        | Test                                                                      | Type      | Result |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------- | ------ |
| 1   | Each "Good to know" note stays a separate entry so the page can list them | `mappers.test.ts:keeps each "good to know" note a separate entry…`        | unit      | PASS   |
| 2   | A null notes column becomes `[]`, never null                              | `mappers.test.ts:substitutes empty arrays when array columns are null`    | unit      | PASS   |
| 3   | Optional club contact copy stays null rather than being invented          | `mappers.test.ts:keeps the optional contact and group-booking copy null…` | unit      | PASS   |
| 4   | The date strip runs 7 days forward from the selected day                  | `court-detail.test.ts:starts at the selected day and runs…`               | unit      | PASS   |
| 5   | Crossing a month boundary produces valid days, not 32 Aug                 | `court-detail.test.ts:crosses a month boundary…`                          | unit      | PASS   |
| 6   | Durations the club will not sell are dropped, not shown and rejected      | `court-detail.test.ts:drops lengths the club will not sell…`              | unit      | PASS   |
| 7   | A taken slot reads "Booked", shows no price, and cannot be selected       | `court-detail.test.ts:describes a taken slot as booked…`                  | unit      | PASS   |
| 8   | Rows a longer booking swallows read "Included in your booking"            | `court-detail.test.ts:shows the rows a longer booking swallows…`          | unit      | PASS   |
| 9   | The day's cheapest rate is badged off-peak                                | `court-detail.test.ts:flags a slot that is cheaper than the day rate…`    | unit      | PASS   |
| 10  | Multi-quantity add-ons are labelled "× n" and charged per unit            | `booking-quote.test.ts:spells out the quantity…`                          | unit      | PASS   |
| 11  | A zero discount produces no discount line at all                          | `booking-quote.test.ts:leaves out the discount line entirely…`            | unit      | PASS   |
| 12  | With no slot picked there is no court line and no court charge            | `booking-quote.test.ts:reports no total to charge…`                       | unit      | PASS   |
| 13  | Taken slots render in place rather than being hidden                      | `court-booking-experience.test.tsx:lists every start time…`               | component | PASS   |
| 14  | A slot someone else booked cannot be clicked                              | `court-booking-experience.test.tsx:refuses to select a slot…`             | component | PASS   |
| 15  | The CTA stays disabled until a start time is chosen                       | `court-booking-experience.test.tsx:asks for a start time…`                | component | PASS   |
| 16  | Choosing and un-choosing an add-on moves the total both ways              | `…adds a chosen add-on…` / `…takes a deselected add-on back off…`         | component | PASS   |
| 17  | The timeline/grid toggle changes the row wording                          | `court-booking-experience.test.tsx:switches between the timeline…`        | component | PASS   |
| 18  | The club's own cancellation window is what the page states                | `court-booking-experience.test.tsx:tells the customer how long…`          | component | PASS   |
| 19  | Adding to the cart is announced, not silent                               | `court-booking-experience.test.tsx:confirms the court reached the cart…`  | component | PASS   |
| 20  | A day with no start times says so instead of rendering empty              | `court-booking-experience.test.tsx:says so plainly when the day…`         | component | PASS   |

## Coverage

```
npx vitest run          → 64 files, 624 tests, all passing
npx vitest run --coverage → All files 95.03% stmts, 87.84% branch, 96.28% lines
npm run lint            → clean
npx tsc --noEmit        → clean (errors under .next/ are Next's generated types, pre-existing)
npm run build           → succeeds, /courts/[slug] builds
```

Threshold is 80% on all four axes; the suite is above it.

## Known gaps

- **The migration has not been run.** The `supabase` CLI is unavailable in this
  environment, so `db:reset` and `db:types` could not execute.
  `database.types.ts` was hand-edited to match the migration. Run
  `npm run db:reset && npm run db:types` and confirm the generated file matches
  before deploying.
- **No "Member discount" line is rendered.** The design shows a flat 10%
  deduction. In this system tier pricing is already folded into the quoted slot
  price by `quoteCourtSegment`, and the detail page has no signed-in customer,
  so `resolveTier` returns `standard`. `buildBookingQuote` accepts
  `discountCents`/`discountLabel` and is tested for both, but the page passes 0
  — showing a discount an anonymous visitor did not receive would misstate the
  price. Wire it up when auth reaches this page.
- **Hero images are placeholders.** `courts.hero_image_url` is rendered when
  present and falls back to "Photo coming soon"; the seed sets no URLs, and no
  Next image loader domain is configured, so a plain `<img>` is used.
- **Off-peak detection is inferred, not authoritative.** The page never sees
  `pricing_rules`, so a slot is badged off-peak when it is priced at the day's
  floor. This matches the seeded rules but would mislabel a club whose cheapest
  slot is still peak-rated.
- **`Pickleball Admin.dc.html` was not implemented.** The request named the
  court detail page; the admin screens are a separate surface.

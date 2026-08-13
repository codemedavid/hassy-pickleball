# TDD evidence — court management in the admin console

**Source plan**: inline plan produced by `/ecc:plan` in the same session (not written to a
`.plan.md` file). Continues the Phase 1 work recorded in
[`court-capacity.tdd.md`](./court-capacity.tdd.md), which built the backend slice and explicitly
deferred "the admin courts screen".

**Scope of this record**: the UI layer that makes the existing court backend reachable, plus the
storefront cache invalidation that backend was missing.

## What was already done

Commit `b65666b` landed validation (`courtFieldsSchema`, `createCourtSchema`, `courtPatchSchema`),
the repository (`listAllCourts`, `createCourt`, `updateCourt`), and the staff-gated `saveCourt`
entry point — all tested. None of it was reachable: no server action exposed `saveCourt`, no
screen called one, and no nav tab linked one. This slice is therefore UI-only. No migration, no
schema change, and no repository change was needed.

## User journeys

1. As club staff, I want to see every court the club has — including ones taken offline — so I
   know what inventory exists.
2. As club staff, I want to add a court with its surface, environment, capacity, and price, so it
   can be booked.
3. As club staff, I want to edit an existing court's details, so listings stay accurate after a
   resurfacing or a price change.
4. As club staff, I want to take a court offline and bring it back, so it is not booked while
   unavailable — without losing its booking history.
5. As club staff, I want a saved court to appear on the storefront immediately, so customers are
   not shown stale inventory.

## Task report

### Validation commands

| Validation command                       | Result                                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| `pnpm test` (RED, before implementation) | 6 failed / 3 files unresolvable, 785 passed                                              |
| `pnpm test` (GREEN)                      | **841 passed**, 0 failed                                                                 |
| `pnpm lint`                              | clean, no output                                                                         |
| `pnpm typecheck`                         | no errors in any file in this change                                                     |
| `pnpm vitest run --coverage`             | **95.72%** statements, 87.75% branches, 98.65% functions, 97.46% lines — thresholds pass |

RED excerpt, `pnpm test`:

```
FAIL src/features/admin/view/court-form.test.ts
  Failed to resolve import "./court-form"
FAIL src/features/admin/ui/court-editor.test.tsx
  Failed to resolve import "./court-editor"
FAIL src/features/admin/ui/courts-screen.test.tsx
  Failed to resolve import "./courts-screen"
FAIL src/features/admin/server/courts.test.ts
  > drops the storefront catalog after creating a court
  > drops the storefront catalog after patching a court
  > drops the storefront catalog when a court is taken offline
  expected "vi.fn()" to be called with arguments: [ 'catalog' ]
FAIL src/features/admin/ui/nav-items.test.ts
  > lists the eight console sections in the order the design shows them
  expected [ 'Schedule', 'Bookings', ... ] to deeply equal [ ..., 'Courts', ... ]
```

Three of these are compile-time RED (the module under test does not exist yet). The other two are
runtime RED against real gaps: the cache was never invalidated, and the tab did not exist.

GREEN excerpt:

```
Test Files  83 passed (83)
     Tests  841 passed (841)
```

### The storefront cache bug

`src/features/courts/catalog.ts:46` documents that a court write must drop the tag-cached catalog,
and nothing in the codebase did. A court saved from the admin console stayed wrong for guests
until the TTL happened to lapse — including a court taken offline, which would keep selling.

`saveCourt` now invalidates on success only: if no write landed, nothing is stale, and discarding
a warm cache costs every guest a slow page for nothing.

It uses `updateTag`, not `revalidateTag`. Under Next 16 `revalidateTag` requires a cache-life
profile and does not guarantee the caller sees its own write; `updateTag` expires the entry
immediately with read-your-own-writes semantics, which is what the staff member needs when the
list reloads straight after saving. Next's own type docs name `updateTag` as the Server Action
choice.

### Design decisions worth recording

**Courts are never deleted.** `booking_courts` references them with `on delete restrict` and
historical bookings must keep resolving, so the UI offers no delete control at all — the buttons
say "Take offline" and "Bring back". A test asserts no button matching `/delete|remove/i` exists,
so the affordance cannot be reintroduced by accident.

**Hero images only when editing.** The image store files catalog images under the row's UUID
(`buildCatalogImagePath` rejects anything else), so a court that does not exist yet has nowhere to
put one. The add form says "You can add a hero image after saving this court." rather than
presenting a control that would fail.

**The slug is derived, then left alone.** A new court's slug follows the name until staff type in
it; an existing court's never does, because that slug is a live public URL and renaming a court
must not silently move its page.

**The editor is inline.** The console is tab-driven with no nested detail routes to mirror, so the
form opens beneath its row. Only one row edits at a time — two open forms writing the same list
loses an edit.

**First mutating admin screen.** Every other console screen (`bookings`, `orders`, `products`,
`pricing`, `customers`, `reports`) is a read-only server component; only `image-upload-field.tsx`
was a client component. There was no form pattern to copy, so this sets one: a plain `<form>`,
`useTransition`, and the `Result` envelope's message rendered in `role="alert"`. No form library
was introduced.

**Nav placement.** Courts sits with Products and Pricing rather than between Bookings and Orders
as the plan first sketched. Those three configure what is for sale; Schedule, Bookings, and Orders
run the day. Splitting the operational trio to insert a config tab read worse.

## Test specification

| #   | What is guaranteed                                                                                    | Test file or command                                                                                                                                                  | Test type | Result | Evidence    |
| --- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------ | ----------- |
| 1   | A saved court drops the storefront's cached catalog, so guests never see stale inventory              | `src/features/admin/server/courts.test.ts:drops the storefront catalog after creating a court`                                                                        | unit      | PASS   | `pnpm test` |
| 2   | Patching a court, including taking it offline, also drops that cache                                  | `src/features/admin/server/courts.test.ts:drops the storefront catalog after patching a court`, `:when a court is taken offline`                                      | unit      | PASS   | `pnpm test` |
| 3   | A rejected payload or a failed write leaves the warm cache alone                                      | `src/features/admin/server/courts.test.ts:leaves the cache alone when the payload was rejected`, `:when the write failed`                                             | unit      | PASS   | `pnpm test` |
| 4   | The console has a Courts tab, grouped with the other catalog sections                                 | `src/features/admin/ui/nav-items.test.ts:lists the eight console sections`                                                                                            | unit      | PASS   | `pnpm test` |
| 5   | The nav renders one link per configured section, at the right href                                    | `src/features/admin/ui/admin-nav.test.tsx:links to every console section`                                                                                             | unit      | PASS   | `pnpm test` |
| 6   | A court round-trips through the form unchanged                                                        | `src/features/admin/view/court-form.test.ts:round-trips a court through the form without changing it`                                                                 | unit      | PASS   | `pnpm test` |
| 7   | Prices show to staff in major units and convert back to centavos exactly, centavos included           | `src/features/admin/view/court-form.test.ts:shows the price in major units`, `:keeps centavos on a price that has them`, `:converts the typed price back to centavos` | unit      | PASS   | `pnpm test` |
| 8   | An unparseable price becomes NaN for the schema to reject, never 0 — which would publish a free court | `src/features/admin/view/court-form.test.ts:reports a price that is not a number as NaN`                                                                              | unit      | PASS   | `pnpm test` |
| 9   | List fields drop blank lines and stray spacing an edit session leaves behind                          | `src/features/admin/view/court-form.test.ts:drops blank lines and surrounding spaces from the lists`                                                                  | unit      | PASS   | `pnpm test` |
| 10  | A blank blurb is sent as null, matching the nullable column                                           | `src/features/admin/view/court-form.test.ts:sends a blank blurb as null`                                                                                              | unit      | PASS   | `pnpm test` |
| 11  | Derived slugs are URL-safe, with no leading or trailing hyphen the pattern would reject               | `src/features/admin/view/court-form.test.ts:toSlug` (3 cases)                                                                                                         | unit      | PASS   | `pnpm test` |
| 12  | Adding a court sends every field the staff member filled in, and no id                                | `src/features/admin/ui/court-editor.test.tsx:sends every field the staff member filled in`, `:creates rather than patches`                                            | unit      | PASS   | `pnpm test` |
| 13  | The descriptive fields — blurb, tags, includes, sort order — actually reach the payload               | `src/features/admin/ui/court-editor.test.tsx:carries the descriptive fields through to the payload`                                                                   | unit      | PASS   | `pnpm test` |
| 14  | The slug follows the name for a new court but stops once staff edit it                                | `src/features/admin/ui/court-editor.test.tsx:fills the slug in from the name`, `:stops deriving the slug once the staff member edits it`                              | unit      | PASS   | `pnpm test` |
| 15  | An existing court's slug is never re-derived, so renaming does not move its public page               | `src/features/admin/ui/court-editor.test.tsx:never re-derives the slug from the name`                                                                                 | unit      | PASS   | `pnpm test` |
| 16  | Editing opens prefilled and patches by id                                                             | `src/features/admin/ui/court-editor.test.tsx:opens with the court's current details`, `:patches the court it was opened for`                                          | unit      | PASS   | `pnpm test` |
| 17  | The image uploader is offered only for a court that exists, with an explanation when it is not        | `src/features/admin/ui/court-editor.test.tsx:says the image can be added after saving`, `:offers the image uploader`                                                  | unit      | PASS   | `pnpm test` |
| 18  | An uploaded image URL survives to the save that follows                                               | `src/features/admin/ui/court-editor.test.tsx:keeps the uploaded image URL for the save that follows`                                                                  | unit      | PASS   | `pnpm test` |
| 19  | A refused save shows the server's reason and is not reported as success                               | `src/features/admin/ui/court-editor.test.tsx:shows the reason the server refused the save`, `:does not report success when the save was refused`                      | unit      | PASS   | `pnpm test` |
| 20  | An inverted capacity band is caught before a request is spent on it                                   | `src/features/admin/ui/court-editor.test.tsx:catches an inverted capacity band before spending a request`                                                             | unit      | PASS   | `pnpm test` |
| 21  | Cancelling either the add or the edit form saves nothing                                              | `src/features/admin/ui/court-editor.test.tsx:abandons the edit without saving when cancelled`, `courts-screen.test.tsx:closes the add form when it is cancelled`      | unit      | PASS   | `pnpm test` |
| 22  | The list shows offline courts alongside bookable ones, with status in words not only colour           | `src/features/admin/ui/courts-screen.test.tsx:lists courts that are offline alongside the ones on sale`, `:says in words whether a court is bookable`                 | unit      | PASS   | `pnpm test` |
| 23  | The list shows each court's capacity band and base price                                              | `src/features/admin/ui/courts-screen.test.tsx:shows the capacity band`, `:shows the base price in the club's currency`                                                | unit      | PASS   | `pnpm test` |
| 24  | A club with no courts is invited to add one                                                           | `src/features/admin/ui/courts-screen.test.tsx:invites the first court when the club has none`                                                                         | unit      | PASS   | `pnpm test` |
| 25  | Only one court edits at a time                                                                        | `src/features/admin/ui/courts-screen.test.tsx:edits only one court at a time`                                                                                         | unit      | PASS   | `pnpm test` |
| 26  | A saved court closes the editor and reloads the list                                                  | `src/features/admin/ui/courts-screen.test.tsx:closes the editor and reloads the list after a save`                                                                    | unit      | PASS   | `pnpm test` |
| 27  | A court is taken offline and brought back by patching `isActive`, never deleted                       | `src/features/admin/ui/courts-screen.test.tsx:takes a bookable court offline without deleting it`, `:brings an offline court back`                                    | unit      | PASS   | `pnpm test` |
| 28  | The UI offers no way to delete a court                                                                | `src/features/admin/ui/courts-screen.test.tsx:never offers to delete a court`                                                                                         | unit      | PASS   | `pnpm test` |
| 29  | A failed availability change is explained and does not reload the list                                | `src/features/admin/ui/courts-screen.test.tsx:explains why a court could not be taken offline`                                                                        | unit      | PASS   | `pnpm test` |

## Coverage and known gaps

`pnpm vitest run --coverage`, excluding two pre-existing broken files (see below):

```
All files          |   95.72 |    87.75 |   98.65 |   97.46
```

`court-form.ts`, `courts-screen.tsx`, `court-editor.tsx`, and `nav-items.ts` are each at 100% of
statements, branches, functions, and lines. Global thresholds (80% on all four) pass.

### Known gaps

- **`pnpm test` and `pnpm typecheck` do not run clean on a bare checkout.** Two untracked WIP
  files predating this work — `src/app/loading-states.test.tsx` and
  `src/components/ui/skeleton.test.tsx` — import components that do not exist
  (`./loading`, `./skeleton`, `./courts/[slug]/loading`, `./checkout/loading`, `./admin/loading`).
  They fail to collect, which suppresses the coverage report, hence the `--exclude` flags above.
  They belong to an unrelated loading-skeleton feature and were left untouched. All 5 remaining
  `typecheck` errors come from these two files.
- **No E2E test for the courts screen.** `e2e/` covers storefront and booking flows; a staff
  journey through add → edit → take offline would need a seeded staff session and is not written.
- **The admin courts page itself is untested.** `src/app/admin/courts/page.tsx` is a five-line
  server component matching `products/page.tsx`; `src/app/**` is outside the coverage `include`
  list, consistent with every other admin route.
- **Resolved in a follow-up:** one-sided capacity patches are now merged with the club-scoped
  stored court and validated before the update. Invalid partial patches return the same field
  message as a full edit instead of falling through to a generic database failure.
- **`revalidateTag` is still missing for products and pricing.** `saveProduct` and
  `savePricingRule` have the same staleness bug this slice fixed for courts. Deliberately left out
  to keep the change scoped to courts; worth a follow-up.

## Merge evidence

If the checkpoint commits are squashed, this is the record:

- **RED** — `dc853e0` `test: add reproducers for court management in the admin console`.
  3 test files unresolvable (modules absent), 3 cache-invalidation assertions failing, 1 nav
  ordering assertion failing. 785 passed.
- **GREEN** — `51d8a7e` `feat: manage courts from the admin console`. 839 passed, 0 failed.
  Lint clean, no typecheck errors from the changed files.
- **Refactor** — coverage-driven: two tests added for the descriptive fields and the add form's
  cancel, both of which were live untested wiring. 841 passed, and all four new modules reached
  100%.

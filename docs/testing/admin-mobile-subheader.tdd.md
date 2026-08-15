# Admin mobile subheader — TDD evidence

## Source

The approved design is
`docs/superpowers/specs/2026-08-15-admin-mobile-subheader-design.md`. The
selected direction is Option B: a persistent, swipeable underline-tab rail
with explicit 44px previous and next controls below `lg`; the desktop
navigation is preserved.

## RED

The first mobile-subheader test checkpoint, `b604526` (`test: specify mobile
admin subheader`), established the replacement contract against the existing
collapsed-menu implementation. The strengthened checkpoint, `2d6da34`
(`test: strengthen admin subheader contract`), made the final RED evidence
explicit: 13 tests total, with 7 expected failures. `c939bc8` corrected the
test's active-tab receiver assertion without weakening the intended RED state.

Those seven failures covered the missing compact signed-in identity label; the
missing persistent arrow controls, boundary state, and resize remeasurement;
missing bidirectional 80% scrolling and reduced-motion behavior; and failure to
invoke `scrollIntoView` with the active link as its receiver. The earlier
checkpoint had 11 tests total with 5 expected failures; the 13/7 strengthened
checkpoint is the definitive RED contract.

## GREEN

`966c7bb` implemented the single persistent responsive rail. `c512f1e` hardened
its responsive ordering, sizing, motion, and active-link behavior; `43f331d`
prevented desktop hydration from centering the active tab; and `e9eae92`
removed the obsolete collapsed-menu labels and their tests.

The final focused command
`pnpm vitest run src/features/admin/ui/admin-nav.test.tsx src/features/admin/ui/nav-items.test.ts`
passed 2 test files and 29 tests. The route cleanup retained the seven configured
sections and the root, exact-route, nested-route, and shared-prefix active-route
coverage without the deleted menu-label helper.

## Verification

| Guarantee                                      | Observed evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One configured navigation                      | `renders one responsive list of admin sections` and `links to every console section` passed; the DOM contains one named navigation and one link per `ADMIN_NAV_ITEMS` entry.                                                                                                                                                                                                                                                                                                      |
| Nested routes retain the owning active section | `marks the section being viewed as current, for screen readers too`, `keeps Payment methods active on nested admin routes`, and the exact/nested/shared-prefix/root `isNavItemActive` cases passed.                                                                                                                                                                                                                                                                               |
| Boundary buttons                               | The all-fit and start/end boundary tests passed, including native disabled states for both fixed controls.                                                                                                                                                                                                                                                                                                                                                                        |
| Resize remeasurement                           | `remeasures overflow when the viewport width changes` passed for fit-to-overflow changes.                                                                                                                                                                                                                                                                                                                                                                                         |
| Bidirectional 80% scrolling                    | `scrolls the rail in both directions by a useful distance` passed with a 300px viewport and exact `scrollBy` distances of `-240` and `240` pixels.                                                                                                                                                                                                                                                                                                                                |
| Reduced motion                                 | `uses instant rail movement when reduced motion is requested` passed with `behavior: 'auto'`; the ordinary arrow path passed with `behavior: 'smooth'`.                                                                                                                                                                                                                                                                                                                           |
| Exact active-link receiver                     | `positions the active tab within the visible rail` passed, proving `scrollIntoView({ block: 'nearest', inline: 'center' })` is called with the active link as its receiver.                                                                                                                                                                                                                                                                                                       |
| Mobile and desktop DOM order                   | The mobile focus-order test passed for brand → customer site → sections, and the desktop test passed for brand → sections → customer site.                                                                                                                                                                                                                                                                                                                                        |
| Desktop behavior and hydration                 | `does not reposition the active tab on desktop` and `does not reposition the active tab while desktop server markup hydrates` passed; hydration retained one navigation and performed no centering.                                                                                                                                                                                                                                                                               |
| 44px brand and rail controls                   | The mobile brand target test passed for `min-h-11`; the fixed previous/next controls use `size-11` in the verified component, matching the 44px grid columns.                                                                                                                                                                                                                                                                                                                     |
| Identity and customer-site access              | The identity tests passed for the club name, full signed-in name, initials with the full accessible label, and the always-available `Customer site` link to `/`.                                                                                                                                                                                                                                                                                                                  |
| Long-name truncation                           | `bounds long staff names in the compact identity row` passed for `min-w-0`, `max-w-40`, and `truncate`.                                                                                                                                                                                                                                                                                                                                                                           |
| Focused navigation                             | `pnpm vitest run src/features/admin/ui/admin-nav.test.tsx src/features/admin/ui/nav-items.test.ts` exited 0: 2 files passed, 29 tests passed.                                                                                                                                                                                                                                                                                                                                     |
| Admin UI                                       | `pnpm vitest run src/features/admin/ui` exited 0: 16 files passed, 180 tests passed.                                                                                                                                                                                                                                                                                                                                                                                              |
| Type safety                                    | `pnpm typecheck` exited 0 (`tsc --noEmit`) with no TypeScript errors.                                                                                                                                                                                                                                                                                                                                                                                                             |
| Lint                                           | `pnpm lint` exited 0 (`eslint src --ignore-pattern src/lib/supabase/database.types.ts`) with no ESLint errors.                                                                                                                                                                                                                                                                                                                                                                    |
| Production compilation                         | The default `pnpm build` could not run in the restricted verification environment because Turbopack's PostCSS worker attempted to create a process by binding a local port and received `EPERM`; this is an environment limitation, not an application compilation failure. The documented supported fallback, `pnpm next build --webpack`, exited 0: compilation completed in 2.9s, TypeScript passed, and 14/14 static pages were generated with all application routes listed. |
| Complete regression suite                      | `pnpm test` exited 0: 99 files passed, 1,103 tests passed.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Whitespace                                     | `git diff --check` exited 0 after this evidence document was created.                                                                                                                                                                                                                                                                                                                                                                                                             |

The focused, admin UI, and complete Vitest runs emitted the known non-failing
Vite warning that `vitest.config.ts` uses ESM syntax while loaded as CommonJS
under the future native config loader. It did not affect any test result.

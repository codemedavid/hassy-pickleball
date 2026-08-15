# Admin Mobile Subheader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the phone/tablet admin hamburger with a persistent, horizontally scrollable subheader that has explicit previous and next controls while preserving the existing desktop navigation.

**Architecture:** Keep one `Admin sections` navigation in the DOM. A file-local `MobileAdminNavRail` owns its scroll viewport, boundary state, active-tab positioning, and arrow controls; responsive `contents` layout places the same navigation in the desktop bar at `lg+`. `AdminNav` continues to own brand/account chrome and route awareness.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Vitest 4, Testing Library

---

## File map

- Modify `src/features/admin/ui/admin-nav.tsx`: replace collapsed-menu state with the responsive two-row shell and scroll rail.
- Modify `src/features/admin/ui/admin-nav.test.tsx`: replace hamburger expectations with identity, scroll-boundary, arrow, active-tab, and single-list coverage.
- Modify `src/features/admin/ui/nav-items.ts`: remove `currentNavLabel`, which has no consumer after the hamburger is removed.
- Modify `src/features/admin/ui/nav-items.test.ts`: remove tests for the obsolete label helper while retaining route-matching coverage.
- Create `docs/testing/admin-mobile-subheader.tdd.md`: record RED/GREEN commands and final verification evidence.

### Task 1: Replace the hamburger contract with failing scroll-rail tests

**Files:**
- Modify: `src/features/admin/ui/admin-nav.test.tsx`

- [ ] **Step 1: Replace menu-only helpers and tests with scroll metric helpers**

Update the Testing Library import and add a metric installer after the pathname mock:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

function installScrollMetrics(
  viewport: HTMLElement,
  { clientWidth, scrollWidth, scrollLeft }: Record<'clientWidth' | 'scrollWidth' | 'scrollLeft', number>,
): void {
  Object.defineProperties(viewport, {
    clientWidth: { configurable: true, value: clientWidth },
    scrollWidth: { configurable: true, value: scrollWidth },
    scrollLeft: { configurable: true, writable: true, value: scrollLeft },
  })
}
```

Delete `panelFor` and the hamburger tests. Keep the club, configured-link, active-route, payment-method, and customer-site tests.

- [ ] **Step 2: Add tests for the persistent mobile identity row**

```tsx
it('keeps customer-site and staff identity in the compact header', () => {
  pathname.current = '/admin'
  render(<AdminNav clubName="Riverbend" staffName="Priya Desk" />)

  expect(screen.getByRole('link', { name: 'Customer site' })).toHaveAttribute('href', '/')
  expect(screen.getByLabelText('Signed in as Priya Desk')).toHaveTextContent('PD')
  expect(screen.queryByRole('button', { name: /Schedule/ })).not.toBeInTheDocument()
})
```

- [ ] **Step 3: Add tests for initial and updated scroll boundaries**

```tsx
it('disables both scroll controls when every section fits', async () => {
  pathname.current = '/admin'
  render(<AdminNav clubName="Riverbend" staffName="Priya" />)
  const nav = screen.getByRole('navigation', { name: 'Admin sections' })
  installScrollMetrics(nav, { clientWidth: 600, scrollWidth: 600, scrollLeft: 0 })
  fireEvent.scroll(nav)

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Scroll admin sections left' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Scroll admin sections right' })).toBeDisabled()
  })
})

it('updates scroll controls at the start and end of an overflowing rail', async () => {
  pathname.current = '/admin'
  render(<AdminNav clubName="Riverbend" staffName="Priya" />)
  const nav = screen.getByRole('navigation', { name: 'Admin sections' })
  installScrollMetrics(nav, { clientWidth: 300, scrollWidth: 900, scrollLeft: 0 })
  fireEvent.scroll(nav)

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Scroll admin sections left' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Scroll admin sections right' })).toBeEnabled()
  })

  nav.scrollLeft = 600
  fireEvent.scroll(nav)

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Scroll admin sections left' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Scroll admin sections right' })).toBeDisabled()
  })
})
```

- [ ] **Step 4: Add an arrow-distance test**

```tsx
it('scrolls by eighty percent of the visible rail when an arrow is pressed', async () => {
  pathname.current = '/admin'
  render(<AdminNav clubName="Riverbend" staffName="Priya" />)
  const nav = screen.getByRole('navigation', { name: 'Admin sections' })
  installScrollMetrics(nav, { clientWidth: 300, scrollWidth: 900, scrollLeft: 0 })
  const scrollBy = vi.fn()
  nav.scrollBy = scrollBy
  fireEvent.scroll(nav)

  const next = await screen.findByRole('button', { name: 'Scroll admin sections right' })
  await waitFor(() => expect(next).toBeEnabled())
  await userEvent.click(next)

  expect(scrollBy).toHaveBeenCalledWith({ left: 240, behavior: 'smooth' })
})
```

- [ ] **Step 5: Add active-tab positioning and single-list tests**

```tsx
it('brings the current section into view', () => {
  const scrollIntoView = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView,
  })
  pathname.current = '/admin/payment-methods'

  render(<AdminNav clubName="Riverbend" staffName="Priya" />)

  expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'center' })
})

it('renders one responsive list of admin sections', () => {
  pathname.current = '/admin'
  render(<AdminNav clubName="Riverbend" staffName="Priya" />)

  expect(screen.getAllByRole('navigation', { name: 'Admin sections' })).toHaveLength(1)
  expect(screen.getAllByRole('link', { name: 'Bookings' })).toHaveLength(1)
})
```

- [ ] **Step 6: Run the focused test to confirm RED**

Run: `pnpm vitest run src/features/admin/ui/admin-nav.test.tsx`

Expected: FAIL because the arrow buttons and signed-in accessible label do not exist, the hamburger still exists, and active links are not scrolled into view.

- [ ] **Step 7: Commit the failing tests**

```bash
git add src/features/admin/ui/admin-nav.test.tsx
git commit -m "test: specify mobile admin subheader"
```

### Task 2: Implement the single-list responsive scroll rail

**Files:**
- Modify: `src/features/admin/ui/admin-nav.tsx`

- [ ] **Step 1: Replace menu state imports and constants with scroll helpers**

Use React scroll primitives and keep the existing route helpers:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { ADMIN_NAV_ITEMS, isNavItemActive } from './nav-items'

const SCROLL_EDGE_TOLERANCE = 1
const SCROLL_PAGE_RATIO = 0.8

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}
```

Remove `MENU_ID`, `MENU_PHONE`, `MENU_DESKTOP`, `MENU_LINK`, `useState` menu state, `closeMenu`, and `currentNavLabel` usage.

- [ ] **Step 2: Add the file-local responsive rail component**

Insert before `AdminNav`:

```tsx
function MobileAdminNavRail({ pathname }: { readonly pathname: string }) {
  const viewportRef = useRef<HTMLElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateBoundaries = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const maximum = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
    setCanScrollLeft(viewport.scrollLeft > SCROLL_EDGE_TOLERANCE)
    setCanScrollRight(viewport.scrollLeft < maximum - SCROLL_EDGE_TOLERANCE)
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const current = viewport.querySelector<HTMLElement>('[aria-current="page"]')
    current?.scrollIntoView?.({ block: 'nearest', inline: 'center' })
    updateBoundaries()

    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(updateBoundaries)
    observer?.observe(viewport)
    window.addEventListener('resize', updateBoundaries)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', updateBoundaries)
    }
  }, [pathname, updateBoundaries])

  function scroll(direction: -1 | 1): void {
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.scrollBy({
      left: direction * viewport.clientWidth * SCROLL_PAGE_RATIO,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }

  return (
    <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] border-t border-white/10 bg-white text-navy lg:contents">
      <button type="button" aria-label="Scroll admin sections left" disabled={!canScrollLeft} onClick={() => scroll(-1)} className="grid size-11 place-items-center border-r border-slate-200 text-xl disabled:opacity-30 lg:hidden">‹</button>
      <nav ref={viewportRef} aria-label="Admin sections" onScroll={updateBoundaries} className="flex min-w-0 snap-x items-stretch gap-4 overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:order-3 lg:flex-1 lg:gap-1 lg:px-0">
        {ADMIN_NAV_ITEMS.map((item) => {
          const isCurrent = isNavItemActive(pathname, item.href)
          return (
            <Link key={item.href} href={item.href} aria-current={isCurrent ? 'page' : undefined} className={`flex h-11 flex-none snap-start items-center border-b-[3px] px-1 pt-[3px] text-[13.5px] font-semibold whitespace-nowrap lg:h-auto lg:rounded-lg lg:border-0 lg:px-3.5 lg:py-[7px] ${isCurrent ? 'border-navy text-navy lg:bg-white/15 lg:text-white' : 'border-transparent text-slate-500 hover:text-navy lg:text-white/65 lg:hover:text-white'}`}>
              {item.label}
            </Link>
          )
        })}
      </nav>
      <button type="button" aria-label="Scroll admin sections right" disabled={!canScrollRight} onClick={() => scroll(1)} className="grid size-11 place-items-center border-l border-slate-200 text-xl disabled:opacity-30 lg:hidden">›</button>
    </div>
  )
}
```

- [ ] **Step 3: Rebuild `AdminNav` around the two-row mobile shell**

Use one outer responsive layout. The identity row becomes `contents` on desktop so the rail's single navigation joins the existing desktop flex row:

```tsx
export function AdminNav({ clubName, staffName }: AdminNavProps) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 bg-navy text-white">
      <div className="mx-auto w-full max-w-[1440px] lg:flex lg:h-16 lg:items-center lg:gap-4 lg:px-7">
        <div className="flex h-14 min-w-0 items-center gap-3 px-4 sm:px-7 lg:contents">
          <Link href="/admin" className="order-1 flex min-w-0 items-center gap-2.5 text-white hover:text-white lg:mr-1 lg:flex-none">
            <span aria-hidden className="grid size-[30px] flex-none place-items-center rounded-[9px] bg-lime font-[family-name:var(--font-display)] text-[16px] font-extrabold text-navy">P</span>
            <span className="truncate font-[family-name:var(--font-display)] text-[17px] font-bold tracking-[-0.02em] lg:text-[18px]">{clubName}</span>
          </Link>
          <span className="order-2 hidden flex-none rounded-md bg-white/12 px-2.5 py-[5px] text-[11px] font-bold tracking-[0.1em] text-lime uppercase lg:inline">Admin</span>
          <div className="order-4 ml-auto flex flex-none items-center gap-3 text-[13px]">
            <Link href="/" aria-label="Customer site" className="flex h-11 items-center font-semibold text-white/70 hover:text-lime lg:h-auto">
              <span className="sm:hidden">Site</span><span className="hidden sm:inline">Customer site</span>
            </Link>
            <span aria-label={`Signed in as ${staffName}`} className="flex items-center gap-2">
              <span aria-hidden className="grid size-7 flex-none place-items-center rounded-full bg-navy-mid text-[12px] font-bold text-lime">{initialsOf(staffName)}</span>
              <span className="hidden text-white/80 sm:inline">{staffName}</span>
            </span>
          </div>
        </div>
        <MobileAdminNavRail pathname={pathname} />
      </div>
    </header>
  )
}
```

- [ ] **Step 4: Run the focused tests and make them GREEN**

Run: `pnpm vitest run src/features/admin/ui/admin-nav.test.tsx`

Expected: all `AdminNav` tests PASS.

- [ ] **Step 5: Run formatting on the changed source and test**

Run: `pnpm prettier --write src/features/admin/ui/admin-nav.tsx src/features/admin/ui/admin-nav.test.tsx`

Expected: both files formatted with no errors.

- [ ] **Step 6: Commit the implementation**

```bash
git add src/features/admin/ui/admin-nav.tsx src/features/admin/ui/admin-nav.test.tsx
git commit -m "feat: add scrollable admin subheader"
```

### Task 3: Remove obsolete menu-label code and verify regressions

**Files:**
- Modify: `src/features/admin/ui/nav-items.ts`
- Modify: `src/features/admin/ui/nav-items.test.ts`

- [ ] **Step 1: Delete the obsolete helper and tests**

Remove the `currentNavLabel` import and its `describe('currentNavLabel', ...)` block from `nav-items.test.ts`. Replace `nav-items.ts` with:

```ts
/** The admin console's sections, in the order the design's tab strip shows them. */

export type AdminNavItem = {
  readonly label: string
  readonly href: string
}

export const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  { label: 'Schedule', href: '/admin' },
  // Bookings and payments are one section: an order was only ever a booking
  // seen through its payments, and two tabs meant reconciling on one and
  // confirming on the other.
  { label: 'Bookings', href: '/admin/bookings' },
  { label: 'Courts', href: '/admin/courts' },
  { label: 'Products', href: '/admin/products' },
  { label: 'Payment methods', href: '/admin/payment-methods' },
  { label: 'Customers', href: '/admin/customers' },
  { label: 'Reports', href: '/admin/reports' },
]

const CONSOLE_ROOT = '/admin'

/**
 * Whether a tab should read as the current section.
 *
 * The schedule lives at the console root, so it is matched exactly — a prefix
 * match there would light up Schedule on every other page. Every other section
 * also claims its nested detail routes, so /admin/bookings/PB-4821 keeps Bookings lit.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === CONSOLE_ROOT) {
    return pathname === CONSOLE_ROOT
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}
```

- [ ] **Step 2: Run navigation tests**

Run: `pnpm vitest run src/features/admin/ui/admin-nav.test.tsx src/features/admin/ui/nav-items.test.ts`

Expected: both test files PASS.

- [ ] **Step 3: Run the full admin UI suite**

Run: `pnpm vitest run src/features/admin/ui`

Expected: all admin UI test files PASS.

- [ ] **Step 4: Commit the cleanup**

```bash
git add src/features/admin/ui/nav-items.ts src/features/admin/ui/nav-items.test.ts
git commit -m "refactor: remove collapsed admin menu labels"
```

### Task 4: Record evidence and perform release verification

**Files:**
- Create: `docs/testing/admin-mobile-subheader.tdd.md`

- [ ] **Step 1: Write the TDD evidence document**

Create `docs/testing/admin-mobile-subheader.tdd.md` with this structure, replacing command-result sentences only when the observed result differs:

```markdown
# Admin mobile subheader — TDD evidence

## Source

The approved design is `docs/superpowers/specs/2026-08-15-admin-mobile-subheader-design.md`. The selected direction is Option B: a swipeable underline-tab rail with explicit 44px previous and next controls below `lg`; desktop navigation remains unchanged.

## RED

`pnpm vitest run src/features/admin/ui/admin-nav.test.tsx` failed against the hamburger implementation because the persistent arrow controls and signed-in identity label did not exist, the menu toggle remained present, and the active link was not brought into view.

## GREEN

`pnpm vitest run src/features/admin/ui/admin-nav.test.tsx src/features/admin/ui/nav-items.test.ts` passed after the single-list responsive rail was implemented and the obsolete menu-label helper was removed.

## Verification

| Guarantee | Evidence |
|---|---|
| One configured section list | `admin-nav.test.tsx: renders one responsive list of admin sections` |
| Nested routes retain the active tab | existing active-route test plus `nav-items.test.ts` |
| Boundary buttons reflect scroll position | start/end and all-fit rail tests |
| Arrow presses scroll 80% of the viewport | arrow-distance test |
| Active tab is brought into view | active-tab positioning test |
| Customer-site and staff identity stay accessible | compact-header test |
| Focused navigation suite | `pnpm vitest run src/features/admin/ui/admin-nav.test.tsx src/features/admin/ui/nav-items.test.ts` |
| Full admin UI suite | `pnpm vitest run src/features/admin/ui` |
| Type safety | `pnpm typecheck` |
| Lint | `pnpm lint` |
| Production CSS and compilation | `pnpm build` |
| Complete regression suite | `pnpm test` |
```

- [ ] **Step 2: Run type checking**

Run: `pnpm typecheck`

Expected: exit 0 with no TypeScript errors.

- [ ] **Step 3: Run lint**

Run: `pnpm lint`

Expected: exit 0 with no ESLint errors.

- [ ] **Step 4: Run the production build**

Run: `pnpm build`

Expected: Next.js production build completes successfully.

- [ ] **Step 5: Run the complete test suite**

Run: `pnpm test`

Expected: every test file passes.

- [ ] **Step 6: Check the final diff and commit evidence**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only `docs/testing/admin-mobile-subheader.tdd.md` is uncommitted.

```bash
git add docs/testing/admin-mobile-subheader.tdd.md
git commit -m "docs: record admin subheader verification"
```

### Task 5: Deliver the verified branch to `main`

**Files:** none

- [ ] **Step 1: Confirm the worktree is clean and inspect branch ancestry**

Run: `git status --short && git branch --show-current && git log --oneline --decorate -5`

Expected: clean status on `feat/admin-mobile`; recent commits include the approved spec, RED tests, implementation, cleanup, and verification evidence.

- [ ] **Step 2: Refresh remote state**

Run: `git fetch origin main`

Expected: remote `main` fetched successfully.

- [ ] **Step 3: Rebase the feature branch if remote main advanced**

Run: `git rebase origin/main`

Expected: successful rebase or “Current branch feat/admin-mobile is up to date.” Stop for user direction if conflicts occur; do not force through them.

- [ ] **Step 4: Re-run focused verification after any rebase**

Run: `pnpm vitest run src/features/admin/ui/admin-nav.test.tsx src/features/admin/ui/nav-items.test.ts && pnpm typecheck`

Expected: navigation tests and type checking PASS.

- [ ] **Step 5: Fast-forward local main and push**

```bash
git switch main
git merge --ff-only feat/admin-mobile
git push origin main
```

Expected: local `main` fast-forwards to the verified feature tip and remote `main` accepts the push without force.

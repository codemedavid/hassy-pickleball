# Admin mobile subheader navigation design

## Goal

Make the admin console easier to navigate on phones and tablets by replacing the collapsed section menu with a persistent, horizontally scrollable subheader. Preserve the existing desktop navigation and the current information architecture.

## Scope

This change affects `AdminNav` below the existing `lg` breakpoint. It does not change admin routes, section names, page content, desktop navigation, or the responsive table layouts.

The seven existing sections remain in their current order:

1. Schedule
2. Bookings
3. Courts
4. Products
5. Payment methods
6. Customers
7. Reports

## Approved design

### Desktop

At `lg` and wider, retain the current single-row console navigation without visual or behavioral changes.

### Phones and tablets

Below `lg`, the sticky admin header uses two rows:

1. A compact identity row containing the club identity, customer-site shortcut, and staff identity.
2. A navigation subheader containing a fixed 44px previous button, one horizontally scrollable underline-tab strip, and a fixed 44px next button.

The center strip is the only copy of the admin section links. It supports direct touch swiping, trackpad or mouse-wheel horizontal scrolling, keyboard navigation through its links, and the explicit previous and next buttons. The visible scrollbar is suppressed without disabling scrolling.

The current section uses `aria-current="page"` and a visible underline. On initial render and route changes, the active link is brought into view. Nested routes continue to activate their owning section through the existing `isNavItemActive` behavior.

The previous and next buttons scroll by 80% of the visible strip width. Each button is disabled when the strip has reached its corresponding boundary. Scroll-position state is recomputed after scrolling and when the available width changes.

Smooth scrolling is used for direct arrow-button interaction unless the user requests reduced motion. Bringing the active tab into view must not create distracting page-level movement.

## Responsive details

- All interactive controls provide at least a 44px touch target.
- The club name truncates before action controls are compressed.
- Below `sm`, staff initials replace the visible full name, while an accessible label retains the full staff name.
- From `sm` through `lg`, the full staff name is displayed.
- The customer-site shortcut remains available at every supported width. It is labelled “Site” below `sm` and “Customer site” from `sm` upward, with the same full accessible name at every width.
- The layout must remain usable at 320px viewport width and in phone landscape orientation.

## Component boundaries

`AdminNav` remains responsible for console chrome and route awareness. A small file-local `MobileAdminNavRail` component owns the scroll viewport, boundary state, resize measurement, and arrow interaction; no new cross-feature abstraction is introduced.

The implementation reuses `ADMIN_NAV_ITEMS`, `isNavItemActive`, and the existing routes. The hamburger-menu state and `currentNavLabel` are removed because the persistent subheader replaces their only use.

## Accessibility

- The subheader is a named navigation landmark.
- The left and right controls have explicit accessible names and native disabled states at their boundaries.
- Current location is conveyed with `aria-current`, not color alone.
- Link focus indicators remain visible inside the clipped scroll viewport.
- DOM order matches visual order.
- The implementation does not depend on hover or swipe gestures for access.

## Edge cases

- If the strip does not overflow, both arrow buttons are disabled.
- Long labels, especially “Payment methods,” remain on one line and are reachable through scrolling.
- Direct navigation to a nested admin route scrolls its parent tab into view.
- Resizing across the `lg` breakpoint does not duplicate links or leave stale menu state visible.
- Scroll measurements tolerate small rounding differences at the end of the strip.

## Verification

Automated tests will cover:

- all seven links appear once in the navigation;
- the correct link is active on root, section, and nested routes;
- previous and next controls expose correct accessible names and disabled states;
- arrow interaction advances the strip in the correct direction;
- the active link is brought into view;
- mobile identity and customer-site access remain present;
- desktop-specific classes and behavior remain intact;
- obsolete hamburger behavior is removed without leaving dead helpers or tests.

Run the focused admin navigation tests, then the admin UI suite, type checking, linting, and a production build. Because jsdom does not calculate scroll layout, unit tests mock the scroll metrics and production-build verification confirms the responsive utility classes are emitted.

## Out of scope

- Changes to admin page content, tables, forms, schedule grids, or reports.
- Reordering, regrouping, or renaming admin sections.
- Changes to authentication, account actions, or customer-site routing.
- Redesigning the existing desktop console navigation.

# Payment Methods Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a complete staff workflow for creating, editing, ordering, hiding, and restoring checkout payment methods and instructions.

**Architecture:** Extend the existing payment-method repository and admin server-action boundaries, add an atomic PostgreSQL reorder function, and build a dedicated inline-table admin screen that reuses the catalog image uploader. Checkout remains read-only and continues filtering to active methods.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod 4, Supabase/PostgreSQL, Vitest, Testing Library, Playwright.

---

### Task 1: Validation and form model

**Files:**
- Modify: `src/lib/api/admin-schemas.ts`
- Create: `src/features/admin/view/payment-method-form.ts`
- Test: `src/lib/api/admin-schemas.test.ts`
- Test: `src/features/admin/view/payment-method-form.test.ts`

- [ ] Add failing schema tests for create, patch, move direction, useful guidance, URL validation, and empty patches.
- [ ] Run `pnpm test -- src/lib/api/admin-schemas.test.ts` and verify the new exports are missing.
- [ ] Add `paymentMethodFieldsSchema`, `createPaymentMethodSchema`, `paymentMethodPatchSchema`, and `movePaymentMethodSchema`; keep `clubId` out of all browser inputs.
- [ ] Add a pure string-based form model with `toPaymentMethodFormState` and `toPaymentMethodPayload`, normalizing blank optional fields to `null`.
- [ ] Run the two focused test files and verify they pass.

### Task 2: Persistence and atomic ordering

**Files:**
- Modify: `src/lib/repositories/payment-methods.ts`
- Modify: `src/lib/repositories/payment-methods.test.ts`
- Create: `supabase/migrations/20260813000000_payment_method_management.sql`
- Modify: `src/lib/supabase/database.types.ts`

- [ ] Add failing repository tests for list-all, club-scoped lookup, create/update mapping, empty patches, and the `move_payment_method` RPC.
- [ ] Run `pnpm test -- src/lib/repositories/payment-methods.test.ts` and verify the new methods fail.
- [ ] Implement `listAllPaymentMethods`, `findPaymentMethod`, `createPaymentMethod`, `updatePaymentMethod`, and `movePaymentMethod`, using camelCase domain inputs and snake_case rows.
- [ ] Add `move_payment_method(p_method_id uuid, p_direction text)` as an authenticated, security-invoker function. It must verify direction, locate an adjacent method within the same club ordered by `sort_order, id`, update both rows in one statement, and no-op at a boundary.
- [ ] Add the generated function signature to the checked-in database types and run the focused repository tests.

### Task 3: Authenticated admin operations

**Files:**
- Create: `src/features/admin/server/payment-methods.ts`
- Create: `src/features/admin/server/payment-methods.test.ts`
- Modify: `src/features/admin/actions.ts`

- [ ] Write failing tests for create ordering, club-scoped patching, merged guidance validation, final-active acknowledgement, restore, and move authorization.
- [ ] Run `pnpm test -- src/features/admin/server/payment-methods.test.ts` and verify failure before implementation.
- [ ] Implement `savePaymentMethod` and `movePublishedPaymentMethod` through `withStaff`. Create rows at `max(sortOrder) + 1`; for patches, load and merge the stored row before full validation.
- [ ] When changing `isActive` to false, count the club's active methods and return an invalid result unless `acknowledgeCheckoutPause` is true when the target is the last active row.
- [ ] Export `savePaymentMethodAction` and `movePaymentMethodAction`, then run the focused tests.

### Task 4: Inline editor and management table

**Files:**
- Create: `src/features/admin/ui/payment-method-editor.tsx`
- Create: `src/features/admin/ui/payment-method-editor.test.tsx`
- Create: `src/features/admin/ui/payment-methods-screen.tsx`
- Create: `src/features/admin/ui/payment-methods-screen.test.tsx`

- [ ] Write failing component tests for field hydration, payload normalization, QR gating, QR removal, one open editor, add/edit, hide/restore, final-active confirmation, move boundaries, errors, and refreshes.
- [ ] Implement the editor with channel, label, account fields, instructions, proof toggle, and the existing `ImageUploadField` using subject `payment-method`. New rows explain that QR upload follows the first save.
- [ ] Implement the responsive table with status text and accessible Move up/Move down, Edit, Hide, and Restore buttons. Disable only impossible boundary moves and in-flight controls.
- [ ] Keep the newly created row selected after refresh so QR upload is immediately available; close existing-row edits after successful save.
- [ ] Run both focused component test files and verify they pass.

### Task 5: Route, navigation, and integration verification

**Files:**
- Create: `src/app/admin/payment-methods/page.tsx`
- Modify: `src/features/admin/ui/nav-items.ts`
- Modify: `src/features/admin/ui/nav-items.test.ts`
- Modify: `src/features/admin/ui/admin-nav.test.tsx`
- Modify: `src/features/checkout/ui/checkout-experience.test.tsx`

- [ ] Add failing navigation tests for the Payment methods tab and active nested routes.
- [ ] Add the route that calls `loadConsole`, loads all payment methods, and wires save, move, and catalog-upload actions into `PaymentMethodsScreen`.
- [ ] Extend checkout tests to pin active-only configured ordering, proof behavior, and the no-active-method pause fallback.
- [ ] Run `pnpm test -- src/features/admin src/lib/repositories/payment-methods.test.ts src/features/checkout/ui/checkout-experience.test.tsx`.
- [ ] Run `pnpm typecheck`, `pnpm lint`, and `pnpm test`; fix only regressions caused by this feature.
- [ ] Review `git diff --check` and confirm no payment method deletion path or client-controlled club ID was introduced.


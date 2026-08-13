# TDD evidence — product management and ImageKit images

## Source plan

No `*.plan.md`. Journeys were derived during this TDD run from the request:
"use ImageKit for the image upload/storage for both the payment proof and courts
and products."

## Starting position

ImageKit was already the image store for this repo before this change, added in
`8e5c049`, `d9c525b`, and `cb32c12`. `grep` over `src/` finds no Supabase
Storage usage. The state on arrival:

| Surface             | ImageKit status on arrival                                                    |
| ------------------- | ----------------------------------------------------------------------------- |
| Payment proofs      | Done — `proof-storage.ts`, private files, 5-minute signed URLs for staff      |
| Courts (hero image) | Done — `court-editor.tsx` → `ImageUploadField` → `uploadCatalogImageAction`   |
| Products            | Server side complete, **no UI** — `products-screen.tsx` was a read-only table |

So no ImageKit work was required. The gap was that products had no admin editor
at all, and therefore nowhere to attach an image. `uploadCatalogImage` already
accepted `subject: 'product'`, `saveProduct` already accepted `imageUrl`, and
`products.image_url` was already mapped.

Scope was confirmed with the user: build the full product editor (not just an
image cell), and leave the `payment-method` QR surface for later.

## User journeys

1. As a staff member, I want to add a product, so that add-ons and café items
   can be sold alongside a booking.
2. As a staff member, I want to edit a product's name, type, price, description,
   quantity behaviour, and sort order, so the catalog stays correct.
3. As a staff member, I want to upload a product image, so guests see the item
   they are ordering.
4. As a staff member, I want to hide a product rather than delete it, so booking
   history that references it keeps resolving.
5. As a staff member, I want to be told why a save or upload was refused, so a
   failure is not mistaken for success.

## Task report

### 1. Product form view model (`view/product-form.ts`)

Translates a `Product` row to and from the strings a text input actually
carries. Price is held in major units and converted once, on submit.

- Validation command: `pnpm vitest run src/features/admin/view/product-form.test.ts`
- RED: `Error: Failed to resolve import "./product-form"` — compile-time RED,
  the module did not exist.
- GREEN: 15 tests pass.
- Guaranteed: price round-trips through major units without losing centavos; a
  blank description becomes `null` rather than `""`; an unparseable price stays
  `NaN` so the schema refuses it instead of publishing a free product; the
  presence of an id decides create versus patch.

### 2. Product editor (`ui/product-editor.tsx`)

The add-and-edit form, with `ImageUploadField` wired to `subject: 'product'`.

- Validation command: `pnpm vitest run src/features/admin/ui/product-editor.test.tsx`
- RED: `Error: Failed to resolve import "./product-editor"` — compile-time RED.
- GREEN: 15 tests pass.
- Guaranteed: every field reaches the payload; the upload sends
  `subject=product` and the row's own id, so an image cannot be filed under
  another row; the uploaded URL survives to the save that follows; a refused
  save or upload is shown and is not reported as success; the uploader is
  withheld until the row exists, because the image store files under the
  product's id.

### 3. Products screen (`ui/products-screen.tsx`)

Add button, inline editor per row, and hide/put-on-sale — mirroring
`courts-screen.tsx`.

- Validation command: `pnpm vitest run src/features/admin/ui/products-screen.test.tsx`
- RED: 7 failing tests (`Unable to find role="button" name=/add product/i`, etc.)
  against the read-only table that existed.
- GREEN: 11 tests pass.
- Guaranteed: hiding sends `isActive: false` rather than deleting; a refused
  change is surfaced and does not refresh the list; cancelling closes the editor
  without saving.

### 4. Page wiring (`app/admin/products/page.tsx`)

Passes `saveProductAction` and `uploadCatalogImageAction`. Covered indirectly —
see the known gaps below.

### 5. Refactor

`toCents`, `toInteger`, and `toMajorUnits` were duplicated between the court and
product forms. Extracted to `view/money-fields.ts` and both now import it, so a
price cannot render as "600" in one editor and "600.00" in the other. Tests
stayed green across the move.

## Test specification

| #   | What is guaranteed                                                  | Test file                                                                    | Type | Result |
| --- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---- | ------ |
| 1   | A price entered in major units is stored as cents, keeping centavos | `view/product-form.test.ts:converts the price to cents`                      | unit | PASS   |
| 2   | An unparseable price stays NaN so the schema refuses it             | `view/product-form.test.ts:leaves an unparseable price as NaN`               | unit | PASS   |
| 3   | A blank description is sent as null, not an empty string            | `view/product-form.test.ts:sends a blank description as null`                | unit | PASS   |
| 4   | An id present means patch; absent means create                      | `view/product-form.test.ts:creates rather than patches`                      | unit | PASS   |
| 5   | A product survives a form round trip unchanged                      | `view/product-form.test.ts:round-trips a product`                            | unit | PASS   |
| 6   | Every edited field reaches the save payload                         | `ui/product-editor.test.tsx:sends every field`                               | unit | PASS   |
| 7   | The image upload targets subject=product and the row's own id       | `ui/product-editor.test.tsx:uploads the image against the product`           | unit | PASS   |
| 8   | The uploaded ImageKit URL is kept for the following save            | `ui/product-editor.test.tsx:keeps the uploaded image URL`                    | unit | PASS   |
| 9   | A refused upload is shown, not silently swallowed                   | `ui/product-editor.test.tsx:surfaces a refused upload`                       | unit | PASS   |
| 10  | A refused save is shown and not reported as success                 | `ui/product-editor.test.tsx:does not report success`                         | unit | PASS   |
| 11  | The uploader is withheld until the product row exists               | `ui/product-editor.test.tsx:says the image can be added after saving`        | unit | PASS   |
| 12  | Hiding a product archives it rather than deleting it                | `ui/products-screen.test.tsx:hides a product rather than deleting it`        | unit | PASS   |
| 13  | A refused change does not refresh the list                          | `ui/products-screen.test.tsx:shows why a refused change did not take effect` | unit | PASS   |
| 14  | Cancelling closes the editor without saving                         | `ui/products-screen.test.tsx:closes a row's editor when cancelled`           | unit | PASS   |

## Coverage

Command: `pnpm vitest run --coverage --exclude='**/loading-states.test.tsx' --exclude='**/skeleton.test.tsx'`

```
Test Files  87 passed (87)
     Tests  933 passed (933)
Total statements 96.47%   branches 89.59%
```

Per module touched or relied on by this change:

| Module                             | Stmts | Branch | Funcs |
| ---------------------------------- | ----- | ------ | ----- |
| `view/product-form.ts`             | 100   | 100    | 100   |
| `view/money-fields.ts`             | 100   | 100    | 100   |
| `ui/product-editor.tsx`            | 100   | 100    | 100   |
| `ui/products-screen.tsx`           | 100   | 100    | 100   |
| `admin/server/media.ts`            | 100   | 100    | 100   |
| `checkout/server/proof-storage.ts` | 100   | 100    | 100   |
| `lib/imagekit/signature.ts`        | 100   | 100    | 100   |
| `lib/imagekit/client.ts`           | 91.66 | 84.61  | 100   |
| `ui/image-upload-field.tsx`        | 95.83 | 91.66  | 100   |

All well above the 80% floor.

## Known gaps and pre-existing conditions

These were verified as pre-existing, not introduced by this change.

- **Two test suites fail to load.** `src/app/loading-states.test.tsx` and
  `src/components/ui/skeleton.test.tsx` are untracked files in the working tree
  importing `./loading` and `./skeleton`, which do not exist. They fail at
  import, so they also suppress the coverage table — hence the `--exclude`
  flags above. Present before this change.
- **Ten pre-existing type errors**, in `lib/repositories/courts.test.ts`,
  `lib/repositories/mappers.test.ts`, and three `features/courts/*` test files,
  all about missing `includedPlayers` / `extraPlayerFeeCents`. Confirmed by
  comparing `pnpm typecheck` before and after: the modules added here contribute
  zero errors.
- **The suite is intermittently flaky.** One full run reported 11 failures in
  `checkout/view/checkout-view.test.ts` and others; an identical rerun reported
  all green. Unrelated to this change and not investigated here.
- **`app/admin/products/page.tsx` has no direct test**, matching
  `app/admin/courts/page.tsx`. Its wiring is exercised through the screen tests.
- **Payment-method QR images are still unreachable from the console.**
  `uploadCatalogImage` supports `subject: 'payment-method'` server-side, but no
  admin surface offers it. Deferred by explicit decision.

## Merge evidence

Checkpoint commits on `feat/admin-management`, in order:

- `e50320d` test: add reproducers for the product editor and its image upload — RED,
  2 suites failing to compile plus 7 failing screen tests.
- `4255476` feat: manage products and their images from the admin console — GREEN,
  39/39 of the new tests passing, 931 total.
- `e4e884d` refactor: share the money field helpers between the court and product
  editors — still green.
- Cancel-path tests bringing `products-screen.tsx` to 100%, 933 total.

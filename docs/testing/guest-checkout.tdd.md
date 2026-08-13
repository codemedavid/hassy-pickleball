# TDD evidence — guest checkout with payment proof

**Source plan:** none. This run continued an in-flight TDD cycle: commit `a22c9be`
("test: add reproducers for guest checkout with payment proof") had already landed
the reproducers, leaving the tree RED. The journeys below are the ones those
reproducers encode.

## RED state inherited

```
$ npx vitest run
 Test Files  2 failed | 69 passed (71)
      Tests  14 failed | 676 passed (690)

 ❯ src/features/checkout/server/submit-checkout.test.ts (12 tests | 6 failed)
 ❯ src/features/checkout/ui/checkout-experience.test.tsx (13 tests | 8 failed)
```

## User journeys

1. As a guest, I want to check out without an account, so that I can hold a court
   with only a name, an email, and a phone number.
2. As a guest, I want to see the account details for the payment method I picked —
   and only that one — so that I do not send money to the wrong number.
3. As a guest paying by transfer, I want to attach a screenshot of my payment, so
   that the desk can reconcile it against my booking.
4. As a guest, I want a reservation number on screen when it is done, so that I
   have something to quote at the desk.
5. As a guest whose slot was taken while I was typing, I want to be told why and
   keep my cart, so that I can pick another time instead of starting over.

## Diagnosis

Three distinct causes behind the 14 failures. Two were defects; one was a test that
no correct implementation could have passed.

### 1. The proof hint polluted the file input's accessible name (8 UI failures)

In `checkout-experience.tsx` the hint text _"A JPG, PNG, or phone screenshot up to
5 MB."_ sat inside the file input's `<label>`. Everything inside a `<label>`
becomes part of the control's accessible name, so the input's name was
`"Screenshot of your payment A JPG, PNG, or phone screenshot up to 5 MB."` — which
matches `/phone/i`. `getByLabelText(/phone/i)` then found two controls (the phone
field and the file input) and threw before any assertion ran.

This is a real accessibility defect, not a test artefact: a screen reader announced
the whole sentence as the field's name.

**Fix:** the hint moved out of the `<label>` and is associated with
`aria-describedby` instead, so it is announced as a description rather than a name.
The label and input are tied together with explicit `htmlFor` / `id`.

### 2. `FormData` stringifies a non-Blob value (6 server failures)

The test helper posted a plain object as the proof field:

```js
form.set('proof', proof as Blob)   // proof = { name, type, size, arrayBuffer }
```

Per the WHATWG spec, `FormData.set` converts any value that is not a `Blob` to a
`USVString`. Verified directly:

```
$ node -e "const f=new FormData(); f.set('proof',{type:'image/png',arrayBuffer:()=>{}}); console.log(typeof f.get('proof'), JSON.stringify(f.get('proof')))"
string "[object Object]"
```

So `readProof` correctly saw a string, returned `null`, and every proof-carrying
test fell through to `PROOF_REQUIRED`. No implementation could have passed this —
the helper, not the production code, was wrong.

**Fix:** the helper now builds a real `File`. The test's original intent — that
`submitCheckout` must not depend on `instanceof File`, which does not survive the
server-action boundary — is preserved: `readProof` still duck-types on
`.arrayBuffer`, and a real `File` satisfies that without the assertion changing.

### 3. `applyAccept` is a `setup()` option, not an `upload()` option

The "rejects a file that is not an image" test uploads a PDF into an input whose
`accept` is image-only. user-event v14 filters that upload out by default, so the
file never reached the component and the assertion saw the wrong error message.
`applyAccept` belongs on `userEvent.setup()`, not on the third argument of
`upload()`. Confirmed in isolation before changing the test:

```
ACCEPT= image/jpeg,image/png,image/webp,image/heic,image/heif  FILES= 0   # option on upload()
Tests  1 passed (1)                                                        # option on setup()
```

Disabling it is the point of the test: `accept` is a hint the OS file dialog may
respect, and a guest who switches the dialog to "All files" gets past it — so the
check has to exist in our code too.

## GREEN

```
$ npx vitest run
 Test Files  72 passed (72)
      Tests  697 passed (697)

$ npx tsc --noEmit          # clean
$ npx eslint src --ignore-pattern src/lib/supabase/database.types.ts   # clean
```

## Test specification

| #   | What is guaranteed                                                         | Test                                                                                               | Type        | Result |
| --- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------- | ------ |
| 1   | Name, email and phone are all required before checkout can be sent         | `checkout-experience.test.tsx:asks for a name, an email, and a phone number`                       | unit        | PASS   |
| 2   | Only the selected method's account details and instructions render         | `checkout-experience.test.tsx:shows only the instructions for the selected method`                 | unit        | PASS   |
| 3   | The screenshot field appears only for a method that requires proof         | `checkout-experience.test.tsx:asks for a payment screenshot only when the chosen method needs one` | unit        | PASS   |
| 4   | A non-image file is refused in the browser before anything is sent         | `checkout-experience.test.tsx:rejects a file that is not an image before anything is sent`         | unit        | PASS   |
| 5   | A proof-required method cannot be submitted with no screenshot             | `checkout-experience.test.tsx:will not submit a proof-required method without a screenshot`        | unit        | PASS   |
| 6   | Cart, contact details and file post as one multipart submission            | `checkout-experience.test.tsx:sends the cart, the contact details, and the file as one submission` | unit        | PASS   |
| 7   | The cart is emptied once the booking exists, so a refresh cannot rebook    | `checkout-experience.test.tsx:empties the cart once the booking exists`                            | unit        | PASS   |
| 8   | A refused booking keeps the cart and shows the reason                      | `checkout-experience.test.tsx:keeps the cart and shows the reason when the booking is refused`     | unit        | PASS   |
| 9   | The booking is filed against the settlement channel the method maps to     | `submit-checkout.test.ts:records the booking against the settlement channel`                       | integration | PASS   |
| 10  | A payment method not active for this club is refused without a write       | `submit-checkout.test.ts:rejects a payment method that is not an active method of this club`       | integration | PASS   |
| 11  | A non-image proof is refused before any booking is written                 | `submit-checkout.test.ts:refuses a proof that is not an image, before any booking is written`      | integration | PASS   |
| 12  | The proof is stored under the reference the booking returned               | `submit-checkout.test.ts:stores the proof under the reference the booking came back with`          | integration | PASS   |
| 13  | A failed booking is surfaced, not masked as success                        | `submit-checkout.test.ts:surfaces a failed booking rather than pretending it succeeded`            | integration | PASS   |
| 14  | A failed upload keeps the reservation and reports the proof did not attach | `submit-checkout.test.ts:keeps the reservation when the upload fails`                              | integration | PASS   |
| 15  | A malformed order payload is rejected without touching the database        | `submit-checkout.test.ts:rejects a malformed order payload without touching the database`          | integration | PASS   |

Evidence command for every row: `npx vitest run src/features/checkout`
(6 files, 70 tests, all passing).

## Known gaps

- **No E2E coverage.** `e2e/storefront.spec.ts` does not yet walk cart → checkout →
  thank-you. The flow depends on a seeded payment method and a storage bucket, so
  it needs the local Supabase stack up.
- **`/checkout` page is untested.** `src/app/checkout/page.tsx` is a server
  component doing two repository reads; its `toPublishable` narrowing (which keeps
  the settlement enum and club id off the wire) has no direct test.
- **Proof upload is not covered against real object storage.** `proof-storage.ts`
  is mocked in every test above.

## Concurrency note

While this cycle was being closed, another writer was actively adding files to the
same working tree (`src/app/checkout/`, `src/lib/imagekit/`, and edits to
`cart-drawer.tsx` / `env.ts`). The full-suite GREEN quoted above was captured
before that work landed. A later full run showed 6 failures in `src/lib/env.test.ts`,
`src/features/cart/ui/cart-drawer.test.tsx` and `src/features/courts/catalog.test.ts`
— all belonging to that separate, in-flight cycle, none in checkout. The checkout
scope was re-verified against the current tree and remains green:

```
$ npx vitest run src/features/checkout src/lib/domain/payment-proof.test.ts \
    src/lib/repositories/payment-methods.test.ts src/lib/api/schemas.test.ts
 Test Files  6 passed (6)
      Tests  70 passed (70)
```

No checkpoint commit was made, because the tree currently mixes this cycle's GREEN
work with another cycle's RED work.

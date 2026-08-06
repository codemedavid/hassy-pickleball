# TDD evidence: ImageKit image uploads

**Source plan**: inline `/ecc:plan` output — "Implementation Plan: ImageKit as the image
pipeline". Not written to a `.plan.md` file; journeys below are the ones that plan
identified, plus gaps found during implementation.

**Scope delivered**: Phases 0–3 of that plan. Phase 4 (ImageKit transformation loader for
`next/image`) was explicitly optional and is not done. See "Known gaps".

## User journeys

1. As a guest paying by GCash, I want to attach a screenshot of my payment, so that the club
   can confirm my booking without my having to message the desk.
2. As a staff member reviewing a payment, I want to open the guest's proof, so that I can
   reconcile it — and I want that link to expire, because the image is a photograph of
   someone's banking app.
3. As a staff member maintaining the catalog, I want to upload a product image, so that
   guests see what they are buying.
4. As an operator, I want the app to refuse to boot when its image credentials are missing,
   so that a misconfigured deployment fails at startup and not at a guest's checkout.

## Phase 0: assumptions verified against the live account before writing code

The plan named the private-file behaviour as the single riskiest assumption, gated on a
manual probe. Run with `curl` against the real account (endpoint
`https://ik.imagekit.io/9e1zkyidg`), then cleaned up.

| Assumption | Command | Result |
|---|---|---|
| Credentials are valid | `GET /v1/files?limit=2` | `HTTP 200` |
| A private file refuses unsigned reads | `GET /_tdd-probe/tdd-probe.png` | `HTTP 403` |
| A signed URL is accepted | same path with `ik-t`/`ik-s` | `HTTP 200` |
| Re-upload replaces rather than accumulates | second upload, `useUniqueFileName=false`, `overwriteFile=true` | same `fileId` and `filePath` |
| Probe removed | `DELETE /v1/files/<id>` | `HTTP 204` |

Consequence: proofs could move to ImageKit without weakening the posture the Supabase
private bucket had, and the signing scheme was proven before it was coded — which is why
the vendor SDK (axios + form-data, for four lines of crypto) was not adopted.

## Task report

### Task 1 — signing (`src/lib/imagekit/signature.ts`)

Implements `ik-s = HMAC-SHA1(privateKey, <path relative to endpoint> + <ik-t>)`.

- RED: `pnpm test src/lib/imagekit/signature.test.ts` → `Test Files 1 failed`, `Tests no tests`
  (module unresolved — compile-time RED).
- GREEN: same command → `Test Files 1 passed (1)`, `Tests 7 passed (7)`.
- Guaranteed: the golden vector in the test is the exact signature the live CDN returned 200
  for. A drift in the scheme fails a test rather than 403-ing in front of a guest.

### Task 2 — environment contract (`src/lib/env.ts`)

- RED: `pnpm test src/lib/env.test.ts` → 5 assertions failing, e.g.
  `expected [Function] to throw an error`.
- GREEN: → part of `Tests 35 passed (35)` across the three files.
- Guaranteed: a deployment missing `IMAGEKIT_PRIVATE_KEY` or
  `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT` throws at startup, naming the variable; the private key
  is absent from `readPublicEnv()`.

### Task 3 — REST client (`src/lib/imagekit/client.ts`)

- RED: `pnpm test src/lib/imagekit/client.test.ts` → module unresolved.
- GREEN: `Tests 35 passed (35)` (with signature + env).
- Guaranteed: basic auth uses the private key as username with an empty password; proofs go
  up `isPrivateFile=true` and catalog images `false`; re-upload overwrites; a rejected upload
  or a dead network returns `STORAGE_ERROR` instead of throwing; the private key never
  appears in an error message.

### Task 4 — payment proofs moved (`src/features/checkout/server/proof-storage.ts`)

- RED: `pnpm test src/features/checkout/server/proof-storage.test.ts` → `Tests 8 failed (8)`.
- GREEN: `pnpm test src/features/checkout/server` → `Tests 20 passed (20)`.
- Live end-to-end, through the real module against the real account:

  ```
  stored path: /payment-proofs/PB-4G6JVH/proof.png
  unsigned status: 403
  signed status: 200
  ✓ uploads a proof privately and reads it back only through a signed URL 3773ms
  ```

  Run as a throwaway file with `--environment node`, then deleted; `GET /v1/files?path=/payment-proofs`
  afterwards returns `[]`.
- Guaranteed: a proof is filed under its booking reference, stored privately, and readable
  only through an expiring link. `buildPaymentProofPath` still fails closed on a reference we
  did not issue.

### Task 5 — server-action body limit (`next.config.ts`)

Not in the original plan as a defect; found while planning and confirmed as pre-existing.
`MAX_PROOF_BYTES` is 5 MB but Next.js server actions default to a 1 MB body, so a phone
screenshot was refused by the framework before any of our own validation ran.

- Fixed by `experimental.serverActions.bodySizeLimit: '6mb'`.
- Validated by `pnpm build` → `Compiled successfully`, config accepted
  (`Experiments (use with caution): · serverActions`), no warnings.
- Not covered by an automated test: the limit is enforced by the framework's request
  handling, which the unit suite does not exercise. See "Known gaps".

### Task 6 — shared image rules (`src/lib/domain/image-upload.ts`)

- RED: `pnpm test src/lib/domain/image-upload.test.ts` → module unresolved.
- GREEN: `pnpm test src/lib/domain` → `Tests 86 passed (86)`.
- `payment-proof.ts` was refactored to compose these rules. Its own tests were **not**
  changed and still pass — that is the evidence the refactor preserved behaviour.
- Guaranteed: JPEG/PNG/WebP/HEIC/HEIF accepted; SVG refused; the extension comes from the
  content type, never the file name; empty and oversized files refused, with the boundary
  tested at exactly the limit and one byte over.

### Task 7 — staff-gated catalog upload (`src/features/admin/server/media.ts`)

- RED: `pnpm test src/features/admin/server/media.test.ts` → module unresolved, then
  `Tests 6 failed | 6 passed (12)`.
- GREEN: → `Tests 12 passed (12)`.
- Guaranteed: the club a file is written under comes from the staff session; a `clubId`
  supplied in the request is ignored (asserted directly); an unauthenticated caller is
  refused before anything uploads; non-images, SVGs, oversized files, unknown subjects, and
  non-uuid ids are all rejected before the store is touched.

Two implementation notes worth recording, both found by a failing test:

- The first version let a bad id reach `buildCatalogImagePath` and relied on `withStaff`
  catching the throw. A test made that dependence visible; the id is now checked up front, so
  rejection does not depend on another module's error mapping.
- The first version of the test built the file as a plain object. `FormData.set` stringifies
  a non-Blob, so nothing reached the handler. Fixed to use a real `File`, matching the
  existing helper in `submit-checkout.test.ts`.

### Task 8 — upload field (`src/features/admin/ui/image-upload-field.tsx`)

- RED: `pnpm test src/features/admin/ui/image-upload-field.test.tsx` → module unresolved.
- GREEN: → `Tests 6 passed (6)`.
- Guaranteed: the chosen file is uploaded with its subject and id and the stored URL is
  reported back; a non-image is refused in the browser without uploading; a server-side
  rejection is surfaced to the staff member; an existing image is previewed.

## Test specification

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 1 | A signed URL reproduces the signature the live CDN accepted | `src/lib/imagekit/signature.test.ts` | unit | PASS |
| 2 | Signing refuses a path that escapes the endpoint or carries its own query string | `src/lib/imagekit/signature.test.ts` | unit | PASS |
| 3 | Uploads authenticate with the private key as basic-auth username | `src/lib/imagekit/client.test.ts` | unit | PASS |
| 4 | Proofs upload private, catalog images public | `src/lib/imagekit/client.test.ts` | unit | PASS |
| 5 | Re-uploading the same name replaces rather than accumulates | `src/lib/imagekit/client.test.ts` | unit | PASS |
| 6 | Store failures and network failures return STORAGE_ERROR, never throw | `src/lib/imagekit/client.test.ts` | unit | PASS |
| 7 | The private key never reaches an error message | `src/lib/imagekit/client.test.ts` | unit | PASS |
| 8 | Missing ImageKit config throws at startup, naming the variable | `src/lib/env.test.ts` | unit | PASS |
| 9 | The private key is absent from the public env | `src/lib/env.test.ts` | unit | PASS |
| 10 | A proof is filed under its booking reference, privately | `src/features/checkout/server/proof-storage.test.ts` | unit | PASS |
| 11 | A reference we did not issue fails closed rather than being sanitised | `src/features/checkout/server/proof-storage.test.ts` | unit | PASS |
| 12 | A failed proof upload keeps the reservation and reports it did not attach | `src/features/checkout/server/submit-checkout.test.ts` | integration | PASS |
| 13 | SVG is refused wherever an image is accepted | `src/lib/domain/image-upload.test.ts` | unit | PASS |
| 14 | The extension comes from the content type, not the file name | `src/lib/domain/image-upload.test.ts` | unit | PASS |
| 15 | Size limit enforced at the boundary and one byte over | `src/lib/domain/image-upload.test.ts` | unit | PASS |
| 16 | A catalog image is filed under the club from the session, not the request | `src/features/admin/server/media.test.ts` | integration | PASS |
| 17 | An unauthenticated caller cannot upload | `src/features/admin/server/media.test.ts` | integration | PASS |
| 18 | Invalid files are rejected before the store is touched | `src/features/admin/server/media.test.ts` | integration | PASS |
| 19 | The upload field refuses a non-image in the browser | `src/features/admin/ui/image-upload-field.test.tsx` | unit | PASS |
| 20 | A server-side rejection is shown to the staff member | `src/features/admin/ui/image-upload-field.test.tsx` | unit | PASS |
| 21 | A private file 403s unsigned and 200s signed, against the real account | manual, `--environment node` | e2e | PASS |

## Coverage

`pnpm test:coverage`:

```
All files          |   96.12 |    88.26 |   98.47 |   97.18
 lib/imagekit      |   93.87 |    90.47 |     100 |   93.87
 lib/domain        |   98.61 |    90.32 |     100 |    98.5
 ...s/admin/server |   97.89 |    90.27 |     100 |    97.8
Statements   : 96.12% ( 1365/1420 )
```

Full suite: `Test Files 77 passed (77)`, `Tests 756 passed (756)`. `pnpm typecheck`,
`pnpm lint`, and `pnpm build` all clean.

## Known gaps

1. **`ImageUploadField` is not mounted in the admin console.** The upload path is complete
   and tested end to end, but `products-screen.tsx` is a read-only table — there is no
   product editor form to host the field, and `saveProduct` is likewise unreachable from the
   UI today. Building that editor is a separate feature with its own UX decisions, so it was
   not invented here. Court hero and payment-method QR uploads are in the same position.
2. **The 6 MB body limit has no automated test.** It is enforced by the framework, not our
   code. Verified only by a clean `pnpm build`.
3. **Seeded catalog rows still point at Supabase Storage.** Both hosts stay allowlisted in
   `next.config.ts` until that data is backfilled; removing the Supabase entry before then
   would break the catalog at render.
4. **Phase 4 not done.** `next/image` optimises ImageKit URLs through the Next server rather
   than using ImageKit's own `tr:` transformations. Deliberately deferred as optional.
5. **The credentials were pasted into a chat transcript.** They now live in `.env.local`
   (gitignored, confirmed via `git check-ignore`) and `.env.example` carries placeholders
   only. Rotating the private key in the ImageKit dashboard is still recommended.

## Merge evidence

Checkpoint commits on `main`, in order:

- `8e5c049` feat: add ImageKit client, URL signing, and config
- `d9c525b` feat: store payment proofs in ImageKit instead of Supabase Storage
- `cb32c12` feat: upload catalog images to ImageKit from the admin console

Each message records its own RED and GREEN commands and results. If these are squashed, this
report is the surviving record.

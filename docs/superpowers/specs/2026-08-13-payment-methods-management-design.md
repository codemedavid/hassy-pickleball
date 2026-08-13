# Payment Methods Management Design

## Goal

Give club staff a dedicated admin screen for managing the payment methods and instructions shown during guest checkout, without requiring database access or disturbing historical payment records.

## Experience

`/admin/payment-methods` uses the console's existing inline-table pattern. The table includes active and hidden methods in checkout order and summarizes the display label, settlement channel, account details, proof requirement, and status. Add and Edit open one inline editor at a time.

Staff can edit the channel, label, account name, account number, instructions, proof requirement, and optional QR image. A method needs a label plus useful guidance. New rows must first be saved with account details or written instructions; the newly saved row then remains selected so a QR image can be uploaded using its database ID.

Move up and Move down swap adjacent rows. Hidden rows keep their position and checkout skips them, so restoring a method returns it to a predictable place. Methods are hidden rather than deleted. Hiding the final active method requires confirmation that checkout will pause.

## Architecture and Data Flow

The admin page loads every payment method scoped to the signed-in staff member's club. Checkout keeps using the existing active-only query. Browser payloads never include a trusted club ID; server actions derive it from `withStaff` and verify the target row belongs to that club.

Create and patch requests use Zod boundary schemas. Patch validation merges the requested fields with the stored method before applying the useful-guidance invariant. The server also enforces acknowledgement before deactivating the final active method.

Repository support expands to list all, find club-scoped, create, update, and move methods. Moving calls a small authenticated PostgreSQL function that swaps adjacent `sort_order` values atomically and treats boundary moves as no-ops. The existing catalog uploader already accepts the `payment-method` subject, so the editor stores its returned delivery URL in `qr_image_url`.

## Failure Handling

All mutations expose pending states, render action errors inline, and refresh server data only after success. Repository failures retain contextual messages. Concurrent ordinary edits use latest-successful-save behavior. The server-side final-active check prevents two simultaneous hides from silently disabling checkout without acknowledgement.

## Verification

Tests cover validation, club scoping, CRUD mapping, atomic move calls, final-active acknowledgement, form mapping, inline editing, QR gating/removal, ordering controls, hide/restore, navigation, and checkout's active-only ordering and paused state. An admin flow verifies that a configured method becomes visible at checkout, can be hidden, and can be restored without affecting historical payments.


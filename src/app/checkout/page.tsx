import { notFound } from 'next/navigation'
import { submitCheckoutAction } from '@/features/checkout/actions'
import { CheckoutExperience } from '@/features/checkout/ui/checkout-experience'
import type { CheckoutPaymentMethod } from '@/features/checkout/view/checkout-view'
import { findClubBySlug } from '@/lib/repositories/clubs'
import { listActivePaymentMethods } from '@/lib/repositories/payment-methods'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { PaymentMethod } from '@/lib/repositories/mappers'

/**
 * Checkout.
 *
 * The server's only job here is to say who the club is and how it takes money —
 * the cart itself lives in the browser and has never been sent anywhere. That
 * is why this page renders no order lines of its own: it would have nothing to
 * put in them.
 */

const CLUB_SLUG = 'baseline'

/**
 * Narrows a payment method to what the browser may see. `method` (the
 * settlement enum) and the club id stay on the server: checkout names a
 * published method by id, and the server resolves the rest.
 */
function toPublishable(method: PaymentMethod): CheckoutPaymentMethod {
  return {
    id: method.id,
    label: method.label,
    accountName: method.accountName,
    accountNumber: method.accountNumber,
    instructions: method.instructions,
    qrImageUrl: method.qrImageUrl,
    requiresProof: method.requiresProof,
  }
}

export default async function CheckoutPage() {
  const client = await createSupabaseServerClient()
  const club = await findClubBySlug(client, CLUB_SLUG)

  if (!club) {
    notFound()
  }

  const paymentMethods = await listActivePaymentMethods(client, club.id)

  return (
    <main className="mx-auto w-full max-w-[1080px] flex-1 px-5 py-8">
      <h1 className="mb-6 font-[family-name:var(--font-display)] text-[30px] font-bold tracking-[-0.02em] text-ink">
        Checkout
      </h1>

      {paymentMethods.length === 0 ? (
        <p className="rounded-[14px] border border-line bg-surface p-6 text-[14px] text-muted">
          Online booking is paused while we update our payment details. Please call the club to
          reserve a court.
        </p>
      ) : (
        <CheckoutExperience
          clubId={club.id}
          currency={club.currency}
          paymentMethods={paymentMethods.map(toPublishable)}
          onSubmit={submitCheckoutAction}
        />
      )}
    </main>
  )
}

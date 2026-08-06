import 'server-only'

import { toPaymentMethod, type PaymentMethod } from './mappers'
import { raise, type Client } from './support'

/**
 * The payment instructions a club publishes: which channels it accepts, the
 * account details a guest must type into their wallet, and whether checkout has
 * to carry a screenshot.
 *
 * Reads only. These rows are edited from the admin console, not from checkout.
 */

export async function listActivePaymentMethods(
  client: Client,
  clubId: string,
): Promise<PaymentMethod[]> {
  const { data, error } = await client
    .from('payment_methods')
    .select('*')
    .eq('club_id', clubId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  raise('Failed to load payment methods', error)

  return (data ?? []).map(toPaymentMethod)
}

/**
 * Resolves a method id the client sent.
 *
 * Scoped to the club and to active rows on purpose: the id arrives from the
 * browser, and without both filters a guest could book against another club's
 * method — or one the club has retired — and be given the wrong account number.
 */
export async function findActivePaymentMethod(
  client: Client,
  clubId: string,
  paymentMethodId: string,
): Promise<PaymentMethod | null> {
  const { data, error } = await client
    .from('payment_methods')
    .select('*')
    .eq('id', paymentMethodId)
    .eq('club_id', clubId)
    .eq('is_active', true)
    .maybeSingle()

  raise('Failed to load payment method', error)

  return data ? toPaymentMethod(data) : null
}

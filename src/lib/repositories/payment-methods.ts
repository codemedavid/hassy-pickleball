import 'server-only'

import { toPaymentMethod, type PaymentMethod } from './mappers'
import { raise, RepositoryError, type Client } from './support'
import type { Enums, Tables } from './rows'

type PaymentMethodUpdate = Tables['payment_methods']['Update']

export type CreatePaymentMethodInput = {
  readonly clubId: string
  readonly method: Enums['payment_method']
  readonly label: string
  readonly accountName: string | null
  readonly accountNumber: string | null
  readonly instructions: string | null
  readonly qrImageUrl: string | null
  readonly requiresProof: boolean
  readonly sortOrder: number
}

export type PaymentMethodPatch = {
  readonly method?: Enums['payment_method']
  readonly label?: string
  readonly accountName?: string | null
  readonly accountNumber?: string | null
  readonly instructions?: string | null
  readonly qrImageUrl?: string | null
  readonly requiresProof?: boolean
  readonly sortOrder?: number
  readonly isActive?: boolean
}

export type PaymentMethodMove = 'up' | 'down'

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

/** The admin editor includes hidden rows so a retired method can be restored. */
export async function listAllPaymentMethods(
  client: Client,
  clubId: string,
): Promise<PaymentMethod[]> {
  const { data, error } = await client
    .from('payment_methods')
    .select('*')
    .eq('club_id', clubId)
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

/** Club-scoped lookup for admin edits, including hidden methods. */
export async function findPaymentMethod(
  client: Client,
  clubId: string,
  paymentMethodId: string,
): Promise<PaymentMethod | null> {
  const { data, error } = await client
    .from('payment_methods')
    .select('*')
    .eq('id', paymentMethodId)
    .eq('club_id', clubId)
    .maybeSingle()

  raise('Failed to load payment method', error)

  return data ? toPaymentMethod(data) : null
}

export async function createPaymentMethod(
  client: Client,
  input: CreatePaymentMethodInput,
): Promise<PaymentMethod> {
  const { data, error } = await client
    .from('payment_methods')
    .insert({
      club_id: input.clubId,
      method: input.method,
      label: input.label,
      account_name: input.accountName,
      account_number: input.accountNumber,
      instructions: input.instructions,
      qr_image_url: input.qrImageUrl,
      requires_proof: input.requiresProof,
      sort_order: input.sortOrder,
    })
    .select('*')
    .single()

  raise('Failed to create payment method', error)

  return toPaymentMethod(data as NonNullable<typeof data>)
}

function toRowPatch(patch: PaymentMethodPatch): PaymentMethodUpdate {
  const columns: PaymentMethodUpdate = {}

  if (patch.method !== undefined) columns.method = patch.method
  if (patch.label !== undefined) columns.label = patch.label
  if (patch.accountName !== undefined) columns.account_name = patch.accountName
  if (patch.accountNumber !== undefined) columns.account_number = patch.accountNumber
  if (patch.instructions !== undefined) columns.instructions = patch.instructions
  if (patch.qrImageUrl !== undefined) columns.qr_image_url = patch.qrImageUrl
  if (patch.requiresProof !== undefined) columns.requires_proof = patch.requiresProof
  if (patch.sortOrder !== undefined) columns.sort_order = patch.sortOrder
  if (patch.isActive !== undefined) columns.is_active = patch.isActive

  return columns
}

export async function updatePaymentMethod(
  client: Client,
  paymentMethodId: string,
  patch: PaymentMethodPatch,
): Promise<PaymentMethod> {
  const columns = toRowPatch(patch)

  if (Object.keys(columns).length === 0) {
    throw new RepositoryError('Nothing to update on this payment method')
  }

  const { data, error } = await client
    .from('payment_methods')
    .update(columns)
    .eq('id', paymentMethodId)
    .select('*')
    .single()

  raise('Failed to update payment method', error)

  return toPaymentMethod(data as NonNullable<typeof data>)
}

export async function movePaymentMethod(
  client: Client,
  paymentMethodId: string,
  direction: PaymentMethodMove,
): Promise<void> {
  const { error } = await client.rpc('move_payment_method', {
    p_method_id: paymentMethodId,
    p_direction: direction,
  })

  raise('Failed to move payment method', error)
}

/**
 * Changes publication state while the database holds the club's method rows.
 * This closes the race where two staff members could otherwise hide the last
 * two active methods after both independently counted two.
 */
export async function setPaymentMethodActive(
  client: Client,
  paymentMethodId: string,
  isActive: boolean,
  acknowledgeCheckoutPause: boolean,
): Promise<PaymentMethod> {
  const { data, error } = await client.rpc('set_payment_method_active', {
    p_method_id: paymentMethodId,
    p_is_active: isActive,
    p_acknowledge_checkout_pause: acknowledgeCheckoutPause,
  })

  raise('Failed to change payment method status', error)

  return toPaymentMethod(data as NonNullable<typeof data>)
}

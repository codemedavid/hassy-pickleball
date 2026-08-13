import type { PaymentMethod } from '@/lib/repositories/mappers'
import type { Enums } from '@/lib/repositories/rows'

export type PaymentMethodFormState = {
  readonly method: Enums['payment_method']
  readonly label: string
  readonly accountName: string
  readonly accountNumber: string
  readonly instructions: string
  readonly qrImageUrl: string | null
  readonly requiresProof: boolean
}

export const BLANK_PAYMENT_METHOD_FORM: PaymentMethodFormState = {
  method: 'cash',
  label: '',
  accountName: '',
  accountNumber: '',
  instructions: '',
  qrImageUrl: null,
  requiresProof: false,
}

export function toPaymentMethodFormState(
  paymentMethod: PaymentMethod | null,
): PaymentMethodFormState {
  if (!paymentMethod) return BLANK_PAYMENT_METHOD_FORM

  return {
    method: paymentMethod.method,
    label: paymentMethod.label,
    accountName: paymentMethod.accountName ?? '',
    accountNumber: paymentMethod.accountNumber ?? '',
    instructions: paymentMethod.instructions ?? '',
    qrImageUrl: paymentMethod.qrImageUrl,
    requiresProof: paymentMethod.requiresProof,
  }
}

export type PaymentMethodPayload = {
  readonly id?: string
  readonly method: Enums['payment_method']
  readonly label: string
  readonly accountName: string | null
  readonly accountNumber: string | null
  readonly instructions: string | null
  readonly qrImageUrl: string | null
  readonly requiresProof: boolean
}

function optionalCopy(value: string): string | null {
  return value.trim() || null
}

export function toPaymentMethodPayload(
  state: PaymentMethodFormState,
  paymentMethodId?: string,
): PaymentMethodPayload {
  const fields = {
    method: state.method,
    label: state.label.trim(),
    accountName: optionalCopy(state.accountName),
    accountNumber: optionalCopy(state.accountNumber),
    instructions: optionalCopy(state.instructions),
    qrImageUrl: state.qrImageUrl,
    requiresProof: state.requiresProof,
  }

  return paymentMethodId === undefined ? fields : { id: paymentMethodId, ...fields }
}

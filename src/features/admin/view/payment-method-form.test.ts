import { describe, expect, it } from 'vitest'
import {
  BLANK_PAYMENT_METHOD_FORM,
  toPaymentMethodFormState,
  toPaymentMethodPayload,
} from './payment-method-form'
import type { PaymentMethod } from '@/lib/repositories/mappers'

const METHOD_ID = '55555555-5555-4555-8555-555555555555'

const gcash: PaymentMethod = {
  id: METHOD_ID,
  clubId: 'club-1',
  method: 'gcash',
  label: 'GCash',
  accountName: 'Baseline Pickleball Club',
  accountNumber: '0917 123 4567',
  instructions: 'Send the exact total.',
  qrImageUrl: 'https://ik.imagekit.io/test/gcash.png',
  requiresProof: true,
  sortOrder: 2,
  isActive: true,
}

describe('toPaymentMethodFormState', () => {
  it('starts a new method with customer-safe defaults', () => {
    expect(toPaymentMethodFormState(null)).toEqual(BLANK_PAYMENT_METHOD_FORM)
  })

  it('fills every editable field from a stored method', () => {
    expect(toPaymentMethodFormState(gcash)).toEqual({
      method: 'gcash',
      label: 'GCash',
      accountName: 'Baseline Pickleball Club',
      accountNumber: '0917 123 4567',
      instructions: 'Send the exact total.',
      qrImageUrl: 'https://ik.imagekit.io/test/gcash.png',
      requiresProof: true,
    })
  })
})

describe('toPaymentMethodPayload', () => {
  it('trims copy and sends blank optional fields as null', () => {
    const payload = toPaymentMethodPayload({
      ...BLANK_PAYMENT_METHOD_FORM,
      label: '  Pay at the desk  ',
      accountName: '   ',
      instructions: '  Arrive early.  ',
    })

    expect(payload).toEqual({
      method: 'cash',
      label: 'Pay at the desk',
      accountName: null,
      accountNumber: null,
      instructions: 'Arrive early.',
      qrImageUrl: null,
      requiresProof: false,
    })
  })

  it('includes the id only when editing an existing method', () => {
    const payload = toPaymentMethodPayload(toPaymentMethodFormState(gcash), METHOD_ID)

    expect(payload.id).toBe(METHOD_ID)
  })

  it('carries a removed QR image as null so the stored URL is cleared', () => {
    const payload = toPaymentMethodPayload(
      {
        ...toPaymentMethodFormState(gcash),
        qrImageUrl: null,
      },
      METHOD_ID,
    )

    expect(payload.qrImageUrl).toBeNull()
  })
})

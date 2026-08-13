import { describe, expect, it } from 'vitest'
import {
  createPaymentMethodSchema,
  movePaymentMethodSchema,
  paymentMethodPatchSchema,
} from './admin-schemas'

const METHOD_ID = '55555555-5555-4555-8555-555555555555'

const VALID_METHOD = {
  method: 'gcash',
  label: 'GCash',
  accountName: 'Baseline Pickleball Club',
  accountNumber: '0917 123 4567',
  instructions: 'Send the exact total.',
  qrImageUrl: null,
  requiresProof: true,
}

describe('createPaymentMethodSchema', () => {
  it('accepts a complete published payment method', () => {
    expect(createPaymentMethodSchema.safeParse(VALID_METHOD).success).toBe(true)
  })

  it('requires useful guidance beyond the display label', () => {
    const result = createPaymentMethodSchema.safeParse({
      ...VALID_METHOD,
      accountName: null,
      accountNumber: null,
      instructions: null,
    })

    expect(result.success).toBe(false)
  })

  it('accepts written instructions without account fields for pay-at-the-desk', () => {
    const result = createPaymentMethodSchema.safeParse({
      ...VALID_METHOD,
      method: 'cash',
      label: 'Pay at the desk',
      accountName: null,
      accountNumber: null,
      instructions: 'Arrive ten minutes before your booking.',
      requiresProof: false,
    })

    expect(result.success).toBe(true)
  })

  it('refuses a channel outside the database enum', () => {
    expect(createPaymentMethodSchema.safeParse({ ...VALID_METHOD, method: 'crypto' }).success).toBe(
      false,
    )
  })

  it('refuses a malformed QR image URL', () => {
    expect(
      createPaymentMethodSchema.safeParse({ ...VALID_METHOD, qrImageUrl: 'not-a-url' }).success,
    ).toBe(false)
  })
})

describe('paymentMethodPatchSchema', () => {
  it('accepts one editable field and an id', () => {
    expect(paymentMethodPatchSchema.safeParse({ id: METHOD_ID, label: 'GCash wallet' }).success).toBe(
      true,
    )
  })

  it('refuses an id without a change', () => {
    expect(paymentMethodPatchSchema.safeParse({ id: METHOD_ID }).success).toBe(false)
  })

  it('accepts the explicit acknowledgement used when checkout will pause', () => {
    expect(
      paymentMethodPatchSchema.safeParse({
        id: METHOD_ID,
        isActive: false,
        acknowledgeCheckoutPause: true,
      }).success,
    ).toBe(true)
  })
})

describe('movePaymentMethodSchema', () => {
  it.each(['up', 'down'] as const)('accepts the %s direction', (direction) => {
    expect(movePaymentMethodSchema.safeParse({ id: METHOD_ID, direction }).success).toBe(true)
  })

  it('refuses an arbitrary direction', () => {
    expect(movePaymentMethodSchema.safeParse({ id: METHOD_ID, direction: 'first' }).success).toBe(
      false,
    )
  })
})


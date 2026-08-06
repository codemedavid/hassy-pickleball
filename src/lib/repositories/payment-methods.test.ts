import { describe, expect, it } from 'vitest'
import { findActivePaymentMethod, listActivePaymentMethods } from './payment-methods'
import { fakeClient, fakeTable } from '../../../test/postgrest-fake'

const ROW = {
  id: 'method-1',
  club_id: 'club-1',
  method: 'gcash' as const,
  label: 'GCash',
  account_name: 'Baseline Pickleball Club',
  account_number: '0917 123 4567',
  instructions: 'Send the exact total, then upload the receipt screenshot.',
  qr_image_url: null,
  requires_proof: true,
  sort_order: 1,
  is_active: true,
}

describe('listActivePaymentMethods', () => {
  it('returns only the club’s active methods, in the order staff arranged them', async () => {
    const payment_methods = fakeTable({ data: [ROW], error: null })

    await listActivePaymentMethods(fakeClient({ payment_methods }), 'club-1')

    expect(payment_methods.calls).toContainEqual({ method: 'eq', args: ['club_id', 'club-1'] })
    expect(payment_methods.calls).toContainEqual({ method: 'eq', args: ['is_active', true] })
    expect(payment_methods.calls).toContainEqual({
      method: 'order',
      args: ['sort_order', { ascending: true }],
    })
  })

  it('maps the row to the domain shape the checkout page renders', async () => {
    const payment_methods = fakeTable({ data: [ROW], error: null })

    const [method] = await listActivePaymentMethods(fakeClient({ payment_methods }), 'club-1')

    expect(method).toEqual({
      id: 'method-1',
      clubId: 'club-1',
      method: 'gcash',
      label: 'GCash',
      accountName: 'Baseline Pickleball Club',
      accountNumber: '0917 123 4567',
      instructions: 'Send the exact total, then upload the receipt screenshot.',
      qrImageUrl: null,
      requiresProof: true,
      sortOrder: 1,
      isActive: true,
    })
  })

  it('throws with context when the query errors', async () => {
    const client = fakeClient({
      payment_methods: fakeTable({ data: null, error: { message: 'x' } }),
    })

    await expect(listActivePaymentMethods(client, 'club-1')).rejects.toThrow(
      /Failed to load payment methods/,
    )
  })
})

describe('findActivePaymentMethod', () => {
  it('scopes the lookup to the club, so a method id from another club cannot be used', async () => {
    const payment_methods = fakeTable({ data: ROW, error: null })

    await findActivePaymentMethod(fakeClient({ payment_methods }), 'club-1', 'method-1')

    expect(payment_methods.calls).toContainEqual({ method: 'eq', args: ['id', 'method-1'] })
    expect(payment_methods.calls).toContainEqual({ method: 'eq', args: ['club_id', 'club-1'] })
    expect(payment_methods.calls).toContainEqual({ method: 'eq', args: ['is_active', true] })
  })

  it('returns null when no active method matches', async () => {
    const payment_methods = fakeTable({ data: null, error: null })

    const found = await findActivePaymentMethod(fakeClient({ payment_methods }), 'club-1', 'gone')

    expect(found).toBeNull()
  })
})

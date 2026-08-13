import { describe, expect, it } from 'vitest'
import {
  createPaymentMethod,
  findActivePaymentMethod,
  findPaymentMethod,
  listActivePaymentMethods,
  listAllPaymentMethods,
  movePaymentMethod,
  setPaymentMethodActive,
  updatePaymentMethod,
} from './payment-methods'
import { callsFor, fakeClient, fakeTable } from '../../../test/postgrest-fake'

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

describe('listAllPaymentMethods', () => {
  it('loads active and hidden methods for the staff member’s club in checkout order', async () => {
    const payment_methods = fakeTable({ data: [ROW], error: null })

    await listAllPaymentMethods(fakeClient({ payment_methods }), 'club-1')

    expect(payment_methods.calls).toContainEqual({ method: 'eq', args: ['club_id', 'club-1'] })
    expect(payment_methods.calls).not.toContainEqual({ method: 'eq', args: ['is_active', true] })
    expect(payment_methods.calls).toContainEqual({
      method: 'order',
      args: ['sort_order', { ascending: true }],
    })
  })
})

describe('findPaymentMethod', () => {
  it('scopes an editable method to the staff member’s club without requiring it to be active', async () => {
    const payment_methods = fakeTable({ data: { ...ROW, is_active: false }, error: null })

    const found = await findPaymentMethod(fakeClient({ payment_methods }), 'club-1', 'method-1')

    expect(found?.isActive).toBe(false)
    expect(payment_methods.calls).toContainEqual({ method: 'eq', args: ['club_id', 'club-1'] })
    expect(payment_methods.calls).not.toContainEqual({ method: 'eq', args: ['is_active', true] })
  })
})

describe('createPaymentMethod', () => {
  it('writes camel-case input to the payment_methods columns', async () => {
    const payment_methods = fakeTable({ data: ROW, error: null })

    await createPaymentMethod(fakeClient({ payment_methods }), {
      clubId: 'club-1',
      method: 'gcash',
      label: 'GCash',
      accountName: 'Baseline Pickleball Club',
      accountNumber: '0917 123 4567',
      instructions: 'Send the exact total.',
      qrImageUrl: null,
      requiresProof: true,
      sortOrder: 1,
    })

    expect(callsFor(payment_methods, 'insert')[0]?.args[0]).toEqual({
      club_id: 'club-1',
      method: 'gcash',
      label: 'GCash',
      account_name: 'Baseline Pickleball Club',
      account_number: '0917 123 4567',
      instructions: 'Send the exact total.',
      qr_image_url: null,
      requires_proof: true,
      sort_order: 1,
    })
  })
})

describe('updatePaymentMethod', () => {
  it('patches only the supplied fields and never deletes the row', async () => {
    const payment_methods = fakeTable({ data: ROW, error: null })

    await updatePaymentMethod(fakeClient({ payment_methods }), 'method-1', {
      label: 'GCash wallet',
      isActive: false,
    })

    expect(callsFor(payment_methods, 'update')[0]?.args[0]).toEqual({
      label: 'GCash wallet',
      is_active: false,
    })
    expect(callsFor(payment_methods, 'delete')).toHaveLength(0)
  })

  it('refuses an empty patch', async () => {
    const payment_methods = fakeTable({ data: ROW, error: null })

    await expect(updatePaymentMethod(fakeClient({ payment_methods }), 'method-1', {})).rejects.toThrow(
      /nothing to update/i,
    )
  })
})

describe('movePaymentMethod', () => {
  it('delegates the reorder to one atomic database call', async () => {
    const client = fakeClient({}, async () => ({ data: null, error: null }))

    await movePaymentMethod(client, 'method-1', 'up')

    expect(client.rpc).toHaveBeenCalledWith('move_payment_method', {
      p_method_id: 'method-1',
      p_direction: 'up',
    })
  })

  it('throws with context when the database refuses the move', async () => {
    const client = fakeClient({}, async () => ({ data: null, error: { message: 'denied' } }))

    await expect(movePaymentMethod(client, 'method-1', 'down')).rejects.toThrow(
      /Failed to move payment method: denied/,
    )
  })
})

describe('setPaymentMethodActive', () => {
  it('checks and changes active state inside one database transaction', async () => {
    const client = fakeClient({}, async () => ({ data: ROW, error: null }))

    await setPaymentMethodActive(client, 'method-1', false, false)

    expect(client.rpc).toHaveBeenCalledWith('set_payment_method_active', {
      p_method_id: 'method-1',
      p_is_active: false,
      p_acknowledge_checkout_pause: false,
    })
  })
})

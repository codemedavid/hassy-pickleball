import { describe, expect, it } from 'vitest'
import { callsFor, fakeClient, fakeTable } from '../../../test/postgrest-fake'
import { markPaymentRefunded, recordPayment } from './payments'

const PAYMENT_ROW = {
  id: 'payment-1',
  booking_id: 'booking-1',
  method: 'gcash' as const,
  status: 'paid' as const,
  amount_cents: 100000,
  external_reference: 'GC-123',
  paid_at: '2026-02-21T04:00:00.000Z',
  refunded_at: null,
}

describe('recordPayment', () => {
  it('stamps paid_at when the payment is recorded as paid', async () => {
    const payments = fakeTable({ data: PAYMENT_ROW, error: null })

    await recordPayment(fakeClient({ payments }), {
      bookingId: 'booking-1',
      method: 'gcash',
      status: 'paid',
      amountCents: 100000,
      externalReference: 'GC-123',
      recordedBy: 'user-1',
    })

    const row = callsFor(payments, 'insert')[0]?.args[0] as Record<string, unknown>

    expect(row).toMatchObject({
      booking_id: 'booking-1',
      method: 'gcash',
      status: 'paid',
      amount_cents: 100000,
      external_reference: 'GC-123',
      recorded_by: 'user-1',
    })
    expect(row.paid_at).toEqual(expect.any(String))
  })

  it('leaves paid_at null for a payment that is still pending', async () => {
    const payments = fakeTable({ data: { ...PAYMENT_ROW, status: 'pending' }, error: null })

    await recordPayment(fakeClient({ payments }), {
      bookingId: 'booking-1',
      method: 'cash',
      status: 'pending',
      amountCents: 100000,
      externalReference: null,
      recordedBy: 'user-1',
    })

    const row = callsFor(payments, 'insert')[0]?.args[0] as Record<string, unknown>

    expect(row.paid_at).toBeNull()
  })

  it('returns the mapped payment', async () => {
    const client = fakeClient({ payments: fakeTable({ data: PAYMENT_ROW, error: null }) })

    const payment = await recordPayment(client, {
      bookingId: 'booking-1',
      method: 'gcash',
      status: 'paid',
      amountCents: 100000,
      externalReference: 'GC-123',
      recordedBy: 'user-1',
    })

    expect(payment.amountCents).toBe(100000)
    expect(payment.paidAt).toBeInstanceOf(Date)
  })

  it('throws with context when the insert is rejected', async () => {
    const client = fakeClient({ payments: fakeTable({ data: null, error: { message: 'denied' } }) })

    await expect(
      recordPayment(client, {
        bookingId: 'booking-1',
        method: 'cash',
        status: 'paid',
        amountCents: 1,
        externalReference: null,
        recordedBy: 'user-1',
      }),
    ).rejects.toThrow(/Failed to record payment: denied/)
  })
})

describe('markPaymentRefunded', () => {
  it('sets the refunded status and stamps refunded_at for that payment only', async () => {
    const payments = fakeTable({
      data: { ...PAYMENT_ROW, status: 'refunded', refunded_at: '2026-02-22T00:00:00.000Z' },
      error: null,
    })

    await markPaymentRefunded(fakeClient({ payments }), 'payment-1')

    const patch = callsFor(payments, 'update')[0]?.args[0] as Record<string, unknown>

    expect(patch.status).toBe('refunded')
    expect(patch.refunded_at).toEqual(expect.any(String))
    expect(payments.calls).toContainEqual({ method: 'eq', args: ['id', 'payment-1'] })
  })

  it('throws with context when the update is rejected', async () => {
    const client = fakeClient({ payments: fakeTable({ data: null, error: { message: 'nope' } }) })

    await expect(markPaymentRefunded(client, 'payment-1')).rejects.toThrow(
      /Failed to refund payment: nope/,
    )
  })
})

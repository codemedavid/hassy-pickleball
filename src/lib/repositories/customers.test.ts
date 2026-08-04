import { describe, expect, it } from 'vitest'
import { callsFor, fakeClient, fakeTable } from '../../../test/postgrest-fake'
import { findCustomerByEmail, listCustomers } from './customers'

const CUSTOMER_ROW = {
  id: 'customer-1',
  club_id: 'club-1',
  full_name: 'Ana Cruz',
  email: 'ana@example.com',
  phone: null,
  tier: 'pro' as const,
  total_spend_cents: 450000,
  bookings_count: 7,
  last_visit_at: '2026-02-18T09:00:00.000Z',
}

describe('findCustomerByEmail', () => {
  it('scopes the lookup to the club, because email is only unique per club', async () => {
    const customers = fakeTable({ data: CUSTOMER_ROW, error: null })

    await findCustomerByEmail(fakeClient({ customers }), 'club-1', 'ana@example.com')

    expect(customers.calls).toContainEqual({ method: 'eq', args: ['club_id', 'club-1'] })
    expect(customers.calls).toContainEqual({ method: 'eq', args: ['email', 'ana@example.com'] })
  })

  it('returns the tier so quoting can apply member pricing', async () => {
    const client = fakeClient({ customers: fakeTable({ data: CUSTOMER_ROW, error: null }) })

    const customer = await findCustomerByEmail(client, 'club-1', 'ana@example.com')

    expect(customer?.tier).toBe('pro')
  })

  it('returns null for a first-time guest', async () => {
    const client = fakeClient({ customers: fakeTable({ data: null, error: null }) })

    expect(await findCustomerByEmail(client, 'club-1', 'new@example.com')).toBeNull()
  })

  it('throws with context when the query errors', async () => {
    const client = fakeClient({ customers: fakeTable({ data: null, error: { message: 'boom' } }) })

    await expect(findCustomerByEmail(client, 'club-1', 'ana@example.com')).rejects.toThrow(
      /Failed to load customer: boom/,
    )
  })
})

describe('listCustomers', () => {
  it('orders by spend so the highest-value customers lead the table', async () => {
    const customers = fakeTable({ data: [], error: null })

    await listCustomers(fakeClient({ customers }), 'club-1')

    expect(customers.calls).toContainEqual({
      method: 'order',
      args: ['total_spend_cents', { ascending: false }],
    })
  })

  it('caps the result set so the page can never be unbounded', async () => {
    const customers = fakeTable({ data: [], error: null })

    await listCustomers(fakeClient({ customers }), 'club-1')

    expect(callsFor(customers, 'limit')).toHaveLength(1)
  })

  it('returns an empty list rather than null for a club with no customers', async () => {
    const client = fakeClient({ customers: fakeTable({ data: null, error: null }) })

    expect(await listCustomers(client, 'club-1')).toEqual([])
  })

  it('throws with context when the query errors', async () => {
    const client = fakeClient({ customers: fakeTable({ data: null, error: { message: 'x' } }) })

    await expect(listCustomers(client, 'club-1')).rejects.toThrow(/Failed to load customers/)
  })
})

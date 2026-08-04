import 'server-only'

import { toCustomer, type Customer } from './booking-mappers'
import { MAX_ROWS, raise, type Client } from './support'

/** Customer reads. Rows are created by the create_booking RPC, never here. */

/**
 * Used at quote time to apply tier pricing. Email is unique per club, not
 * globally, so the club id is part of the lookup.
 */
export async function findCustomerByEmail(
  client: Client,
  clubId: string,
  email: string,
): Promise<Customer | null> {
  const { data, error } = await client
    .from('customers')
    .select('*')
    .eq('club_id', clubId)
    .eq('email', email)
    .maybeSingle()

  raise('Failed to load customer', error)

  return data ? toCustomer(data) : null
}

/** Highest-spending customers first, matching the admin Customers table. */
export async function listCustomers(client: Client, clubId: string): Promise<readonly Customer[]> {
  const { data, error } = await client
    .from('customers')
    .select('*')
    .eq('club_id', clubId)
    .order('total_spend_cents', { ascending: false })
    .limit(MAX_ROWS)

  raise('Failed to load customers', error)

  return (data ?? []).map(toCustomer)
}

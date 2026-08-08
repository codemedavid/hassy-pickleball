import 'server-only'

import { toPricingRule } from './mappers'
import { raise, type Client } from './support'
import type { PricingRule } from '@/lib/domain/types'

/**
 * Pricing rules, read for quoting.
 *
 * Rules are seeded and maintained in the database — the console has no editor,
 * so this module is read-only. Every quote path (availability, create-booking,
 * reschedule) loads the active set and hands it to `quoteCourtSegment`.
 */

export async function listActivePricingRules(
  client: Client,
  clubId: string,
): Promise<PricingRule[]> {
  const { data, error } = await client
    .from('pricing_rules')
    .select('*')
    .eq('club_id', clubId)
    .eq('is_active', true)
    .order('priority', { ascending: true })

  raise('Failed to load pricing rules', error)

  return (data ?? []).map(toPricingRule)
}

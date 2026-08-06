import { loadConsole } from '../console-data'
import { PricingScreen } from '@/features/admin/ui/pricing-screen'
import { describePricingRules } from '@/features/admin/view/pricing'
import { listActiveCourts } from '@/lib/repositories/courts'
import { listAllPricingRules } from '@/lib/repositories/pricing-rules'

export default async function AdminPricingPage() {
  const { client, club } = await loadConsole()

  const [rules, courts] = await Promise.all([
    listAllPricingRules(client, club.id),
    listActiveCourts(client, club.id),
  ])

  return <PricingScreen rows={describePricingRules(rules, courts, club)} />
}

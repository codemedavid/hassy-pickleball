import { loadConsole } from '../console-data'
import { CustomersScreen } from '@/features/admin/ui/customers-screen'
import { listCustomers } from '@/lib/repositories/customers'

export default async function AdminCustomersPage() {
  const { client, club } = await loadConsole()
  const customers = await listCustomers(client, club.id)

  return <CustomersScreen customers={customers} club={club} />
}

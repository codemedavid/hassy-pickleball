import { loadConsole } from '../console-data'
import { PaymentMethodsScreen } from '@/features/admin/ui/payment-methods-screen'
import {
  movePaymentMethodAction,
  savePaymentMethodAction,
  uploadCatalogImageAction,
} from '@/features/admin/actions'
import { listAllPaymentMethods } from '@/lib/repositories/payment-methods'

/** Staff configure the exact payment choices and instructions checkout publishes. */
export default async function AdminPaymentMethodsPage() {
  const { client, club } = await loadConsole()
  const methods = await listAllPaymentMethods(client, club.id)

  return (
    <PaymentMethodsScreen
      methods={methods}
      onSave={savePaymentMethodAction}
      onMove={movePaymentMethodAction}
      onUpload={uploadCatalogImageAction}
    />
  )
}

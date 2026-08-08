import { loadConsole } from '../console-data'
import { CourtsScreen } from '@/features/admin/ui/courts-screen'
import { saveCourtAction, uploadCatalogImageAction } from '@/features/admin/actions'
import { listAllCourts } from '@/lib/repositories/courts'

/** Staff see offline courts too — that is the difference from the storefront. */
export default async function AdminCourtsPage() {
  const { client, club } = await loadConsole()
  const courts = await listAllCourts(client, club.id)

  return (
    <CourtsScreen
      courts={courts}
      currency={club.currency}
      onSave={saveCourtAction}
      onUpload={uploadCatalogImageAction}
    />
  )
}

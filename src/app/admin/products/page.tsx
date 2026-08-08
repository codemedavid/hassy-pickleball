import { loadConsole } from '../console-data'
import { ProductsScreen } from '@/features/admin/ui/products-screen'
import { saveProductAction, uploadCatalogImageAction } from '@/features/admin/actions'
import { listAllProducts } from '@/lib/repositories/products'

/** Staff see hidden products too — that is the difference from the storefront. */
export default async function AdminProductsPage() {
  const { client, club } = await loadConsole()
  const products = await listAllProducts(client, club.id)

  return (
    <ProductsScreen
      products={products}
      currency={club.currency}
      onSave={saveProductAction}
      onUpload={uploadCatalogImageAction}
    />
  )
}

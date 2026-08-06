import { AdminPageHeader, AdminScreen, CARD, CELL, EmptyState, TABLE_HEAD } from './primitives'
import { formatMoney } from '@/lib/format/money'
import type { Product } from '@/lib/repositories/mappers'
import type { ProductType } from '@/lib/repositories/rows'

/** The add-on and café catalog behind the booking flow. */

const COLUMNS = ['Product', 'Type', 'Price', 'Status'] as const

const TYPE_LABELS: Record<ProductType, string> = {
  addon: 'Add-on',
  cafe: 'Café',
}

export interface ProductsScreenProps {
  readonly products: readonly Product[]
  readonly currency: string
}

export function ProductsScreen({ products, currency }: ProductsScreenProps) {
  return (
    <AdminScreen>
      <AdminPageHeader title="Products" subtitle="Add-ons and café items sold alongside courts" />

      <div className={`${CARD} overflow-x-auto`}>
        {products.length === 0 ? (
          <EmptyState>No products yet.</EmptyState>
        ) : (
          <table aria-label="Products" className="w-full min-w-[640px] border-collapse text-[14px]">
            <thead className={TABLE_HEAD}>
              <tr>
                {COLUMNS.map((column) => (
                  <th key={column} scope="col" className={CELL}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-t border-[#f2f5f8]">
                  <td className={CELL}>
                    <span className="block font-semibold">{product.name}</span>
                    {product.description ? (
                      <span className="mt-px block text-[12.5px] text-subtle">
                        {product.description}
                      </span>
                    ) : null}
                  </td>
                  <td className={`${CELL} text-slate`}>{TYPE_LABELS[product.type]}</td>
                  <td className={`${CELL} text-slate tabular-nums`}>
                    {formatMoney(product.priceCents, currency)}
                  </td>
                  <td className={CELL}>
                    {/* Wording, not just colour: a hidden item still sits in the list. */}
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase ${
                        product.isActive
                          ? 'bg-success-bg text-success'
                          : 'bg-surface-sunken text-muted'
                      }`}
                    >
                      {product.isActive ? 'On sale' : 'Hidden'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminScreen>
  )
}

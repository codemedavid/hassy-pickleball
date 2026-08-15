'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AdminPageHeader,
  AdminScreen,
  CARD,
  Cell,
  DataTable,
  EmptyState,
  FullWidthRow,
  Row,
} from './primitives'
import { Button } from '@/components/ui/button'
import { ProductEditor } from './product-editor'
import { type UploadedImage } from './image-upload-field'
import { formatMoney } from '@/lib/format/money'
import type { Product } from '@/lib/repositories/mappers'
import type { ProductType } from '@/lib/repositories/rows'
import type { Result } from '@/lib/api/result'

/**
 * The add-on and café catalog behind the booking flow, and the editor for it.
 *
 * The editor opens inline beneath the row it belongs to rather than on its own
 * route, matching ./courts-screen: the console is tab-driven and has no nested
 * pages. Only one row edits at a time — two open forms writing the same list is
 * a way to lose an edit, not a feature.
 *
 * A product is never deleted. `booking_items` references it, so a product that
 * has ever been ordered cannot be removed and its history must keep resolving;
 * hiding it is the real operation, and the buttons say so.
 */

export interface ProductsScreenProps {
  readonly products: readonly Product[]
  readonly currency: string
  readonly onSave: (payload: unknown) => Promise<Result<Product>>
  readonly onUpload: (form: FormData) => Promise<Result<UploadedImage>>
}

const COLUMNS = ['Product', 'Type', 'Price', 'Status', ''] as const

const TYPE_LABELS: Record<ProductType, string> = {
  addon: 'Add-on',
  cafe: 'Café',
}

/** Which row's editor is open. 'new' is the add form, which belongs to no row. */
type EditTarget = string | 'new' | null

export function ProductsScreen({ products, currency, onSave, onUpload }: ProductsScreenProps) {
  const router = useRouter()
  const [editing, setEditing] = useState<EditTarget>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSaved(): void {
    setEditing(null)
    router.refresh()
  }

  function toggleAvailability(product: Product): void {
    setError(null)

    startTransition(async () => {
      const result = await onSave({ id: product.id, isActive: !product.isActive })

      if (!result.success) {
        setError(result.error)
        return
      }

      router.refresh()
    })
  }

  return (
    <AdminScreen>
      <AdminPageHeader title="Products" subtitle="Add-ons and café items sold alongside courts">
        <Button onClick={() => setEditing('new')} disabled={editing === 'new'}>
          Add product
        </Button>
      </AdminPageHeader>

      {error ? (
        <p role="alert" className={`${CARD} mb-4 px-4 py-3 text-[13px] text-danger`}>
          {error}
        </p>
      ) : null}

      {editing === 'new' ? (
        <div className={`${CARD} mb-4`}>
          <ProductEditor
            product={null}
            currency={currency}
            onSave={onSave}
            onUpload={onUpload}
            onSaved={handleSaved}
            onCancel={() => setEditing(null)}
          />
        </div>
      ) : null}

      <div className={`${CARD} overflow-x-auto`}>
        {products.length === 0 ? (
          <EmptyState>No products yet. Add one to sell alongside a booking.</EmptyState>
        ) : (
          <DataTable label="Products" columns={COLUMNS} wideClassName="sm:min-w-[720px]">
            {products.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                currency={currency}
                isPending={isPending}
                isEditing={editing === product.id}
                onEdit={() => setEditing(product.id)}
                onToggle={() => toggleAvailability(product)}
                onSave={onSave}
                onUpload={onUpload}
                onSaved={handleSaved}
                onCancel={() => setEditing(null)}
              />
            ))}
          </DataTable>
        )}
      </div>
    </AdminScreen>
  )
}

interface ProductRowProps {
  readonly product: Product
  readonly currency: string
  readonly isPending: boolean
  readonly isEditing: boolean
  readonly onEdit: () => void
  readonly onToggle: () => void
  readonly onSave: ProductsScreenProps['onSave']
  readonly onUpload: ProductsScreenProps['onUpload']
  readonly onSaved: () => void
  readonly onCancel: () => void
}

function ProductRow({
  product,
  currency,
  isPending,
  isEditing,
  onEdit,
  onToggle,
  onSave,
  onUpload,
  onSaved,
  onCancel,
}: ProductRowProps) {
  return (
    <>
      <Row>
        <Cell label="Product">
          <span className="block font-semibold">{product.name}</span>
          {product.description ? (
            <span className="mt-px block text-[12.5px] text-subtle">{product.description}</span>
          ) : null}
        </Cell>
        <Cell label="Type" className="text-slate">
          {TYPE_LABELS[product.type]}
        </Cell>
        <Cell label="Price" className="text-slate tabular-nums">
          {formatMoney(product.priceCents, currency)}
        </Cell>
        <Cell label="Status">
          {/* Wording, not just colour: a hidden item still sits in the list. */}
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase ${
              product.isActive ? 'bg-success-bg text-success' : 'bg-surface-sunken text-muted'
            }`}
          >
            {product.isActive ? 'On sale' : 'Hidden'}
          </span>
        </Cell>
        <Cell label="">
          <div className="flex justify-end gap-2 max-sm:justify-start">
            <Button variant="secondary" size="sm" onClick={onEdit} disabled={isEditing}>
              Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={onToggle} disabled={isPending}>
              {product.isActive ? 'Hide' : 'Put on sale'}
            </Button>
          </div>
        </Cell>
      </Row>

      {isEditing ? (
        <FullWidthRow columnCount={COLUMNS.length}>
          <ProductEditor
            product={product}
            currency={currency}
            onSave={onSave}
            onUpload={onUpload}
            onSaved={onSaved}
            onCancel={onCancel}
          />
        </FullWidthRow>
      ) : null}
    </>
  )
}

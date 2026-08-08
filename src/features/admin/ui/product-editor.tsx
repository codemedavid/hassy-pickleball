'use client'

import { useId, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { ImageUploadField, type UploadedImage } from './image-upload-field'
import { toFormState, toProductPayload, type ProductFormState } from '../view/product-form'
import type { Product } from '@/lib/repositories/mappers'
import type { ProductType } from '@/lib/repositories/rows'
import type { Result } from '@/lib/api/result'

/**
 * The add-and-edit form for a product.
 *
 * One form for both, because the fields are the same and saveProduct keys off
 * the presence of an id. Validation is not duplicated here: the schema behind
 * the action owns it, and its message is what the staff member reads.
 *
 * Images are only offered for a product that exists. The image store files them
 * under the product's id, so there is nowhere to put one until the row has been
 * created — the form says so rather than presenting a control that fails.
 */

export interface ProductEditorProps {
  /** Null when adding. */
  readonly product: Product | null
  readonly currency: string
  readonly onSave: (payload: unknown) => Promise<Result<Product>>
  readonly onUpload: (form: FormData) => Promise<Result<UploadedImage>>
  readonly onSaved: () => void
  readonly onCancel: () => void
}

const FIELD =
  'h-10 rounded-xl border border-line-strong bg-surface px-3 text-[14px] text-ink ' +
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-navy-mid'
const AREA =
  'min-h-20 rounded-xl border border-line-strong bg-surface px-3 py-2 text-[14px] text-ink ' +
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-navy-mid'
const LABEL = 'text-[13px] font-semibold text-ink'

export function ProductEditor({
  product,
  currency,
  onSave,
  onUpload,
  onSaved,
  onCancel,
}: ProductEditorProps) {
  const [form, setForm] = useState<ProductFormState>(() => toFormState(product))
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const ids = useFieldIds()

  function update<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]): void {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await onSave(toProductPayload(form, product?.id))

      if (!result.success) {
        setError(result.error)
        return
      }

      onSaved()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 p-5 sm:grid-cols-2">
      <Field id={ids.name} label="Product name">
        <input
          id={ids.name}
          value={form.name}
          onChange={(event) => update('name', event.target.value)}
          required
          maxLength={120}
          className={FIELD}
        />
      </Field>

      <Field id={ids.type} label="Type">
        <select
          id={ids.type}
          value={form.type}
          onChange={(event) => update('type', event.target.value as ProductType)}
          className={FIELD}
        >
          <option value="addon">Add-on</option>
          <option value="cafe">Café</option>
        </select>
      </Field>

      <Field id={ids.price} label={`Price (${currency})`}>
        <input
          id={ids.price}
          value={form.price}
          onChange={(event) => update('price', event.target.value)}
          required
          inputMode="decimal"
          className={FIELD}
        />
      </Field>

      <Field id={ids.sortOrder} label="Sort order" hint="Lower numbers list first.">
        <input
          id={ids.sortOrder}
          value={form.sortOrder}
          onChange={(event) => update('sortOrder', event.target.value)}
          inputMode="numeric"
          className={FIELD}
        />
      </Field>

      <Field id={ids.description} label="Description" className="sm:col-span-2">
        <textarea
          id={ids.description}
          value={form.description}
          onChange={(event) => update('description', event.target.value)}
          maxLength={500}
          className={AREA}
        />
      </Field>

      <label className="flex items-center gap-2.5 self-end sm:col-span-2">
        <input
          type="checkbox"
          checked={form.hasQuantity}
          onChange={(event) => update('hasQuantity', event.target.checked)}
          className="size-4"
        />
        <span className={LABEL}>Guests choose a quantity</span>
      </label>

      <div className="sm:col-span-1">
        {product ? (
          <ImageUploadField
            label="Product image"
            subject="product"
            subjectId={product.id}
            value={form.imageUrl}
            onUpload={onUpload}
            onUploaded={(url) => update('imageUrl', url)}
          />
        ) : (
          <p className="m-0 text-[12.5px] text-subtle">
            You can add an image after saving this product.
          </p>
        )}
      </div>

      {error ? (
        <p role="alert" className="m-0 text-[13px] text-danger sm:col-span-2">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2.5 sm:col-span-2">
        <Button type="submit" isPending={isPending}>
          Save product
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

/** One call, so the ids stay stable across renders without a hook per field. */
function useFieldIds() {
  const prefix = useId()

  return {
    name: `${prefix}-name`,
    type: `${prefix}-type`,
    price: `${prefix}-price`,
    sortOrder: `${prefix}-sort-order`,
    description: `${prefix}-description`,
  }
}

interface FieldProps {
  readonly id: string
  readonly label: string
  readonly hint?: string
  readonly className?: string
  readonly children: React.ReactNode
}

function Field({ id, label, hint, className = '', children }: FieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      {children}
      {hint ? <p className="m-0 text-[12px] text-subtle">{hint}</p> : null}
    </div>
  )
}

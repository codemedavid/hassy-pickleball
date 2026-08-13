'use client'

import { useId, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { ImageUploadField, type UploadedImage } from './image-upload-field'
import {
  toPaymentMethodFormState,
  toPaymentMethodPayload,
  type PaymentMethodFormState,
} from '../view/payment-method-form'
import type { Result } from '@/lib/api/result'
import type { PaymentMethod } from '@/lib/repositories/mappers'
import type { Enums } from '@/lib/repositories/rows'

export interface PaymentMethodEditorProps {
  readonly paymentMethod: PaymentMethod | null
  readonly onSave: (payload: unknown) => Promise<Result<PaymentMethod>>
  readonly onUpload: (form: FormData) => Promise<Result<UploadedImage>>
  readonly onSaved: (paymentMethod: PaymentMethod) => void
  readonly onCancel: () => void
}

const FIELD =
  'h-10 rounded-xl border border-line-strong bg-surface px-3 text-[14px] text-ink ' +
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-navy-mid'
const AREA =
  'min-h-28 rounded-xl border border-line-strong bg-surface px-3 py-2 text-[14px] text-ink ' +
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-navy-mid'
const LABEL = 'text-[13px] font-semibold text-ink'

export function PaymentMethodEditor({
  paymentMethod,
  onSave,
  onUpload,
  onSaved,
  onCancel,
}: PaymentMethodEditorProps) {
  const [form, setForm] = useState<PaymentMethodFormState>(() =>
    toPaymentMethodFormState(paymentMethod),
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const ids = useFieldIds()

  function update<K extends keyof PaymentMethodFormState>(
    key: K,
    value: PaymentMethodFormState[K],
  ): void {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await onSave(toPaymentMethodPayload(form, paymentMethod?.id))

      if (!result.success) {
        setError(result.error)
        return
      }

      onSaved(result.data)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 p-5 sm:grid-cols-2">
      <Field id={ids.method} label="Payment channel">
        <select
          id={ids.method}
          value={form.method}
          onChange={(event) => update('method', event.target.value as Enums['payment_method'])}
          className={FIELD}
        >
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="gcash">GCash</option>
          <option value="online">Online payment</option>
        </select>
      </Field>

      <Field id={ids.label} label="Display label" hint="Shown to guests during checkout.">
        <input
          id={ids.label}
          value={form.label}
          onChange={(event) => update('label', event.target.value)}
          required
          maxLength={120}
          className={FIELD}
        />
      </Field>

      <Field id={ids.accountName} label="Account name">
        <input
          id={ids.accountName}
          value={form.accountName}
          onChange={(event) => update('accountName', event.target.value)}
          maxLength={160}
          className={FIELD}
        />
      </Field>

      <Field id={ids.accountNumber} label="Account number">
        <input
          id={ids.accountNumber}
          value={form.accountNumber}
          onChange={(event) => update('accountNumber', event.target.value)}
          maxLength={160}
          className={FIELD}
        />
      </Field>

      <Field id={ids.instructions} label="Payment instructions" className="sm:col-span-2">
        <textarea
          id={ids.instructions}
          value={form.instructions}
          onChange={(event) => update('instructions', event.target.value)}
          maxLength={1000}
          className={AREA}
        />
      </Field>

      <label className="flex items-center gap-2.5 sm:col-span-2">
        <input
          type="checkbox"
          checked={form.requiresProof}
          onChange={(event) => update('requiresProof', event.target.checked)}
          className="size-4"
        />
        <span className={LABEL}>Require payment proof at checkout</span>
      </label>

      <div className="sm:col-span-2">
        {paymentMethod ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 flex-1">
              <ImageUploadField
                label="QR image"
                subject="payment-method"
                subjectId={paymentMethod.id}
                value={form.qrImageUrl}
                onUpload={onUpload}
                onUploaded={(url) => update('qrImageUrl', url)}
              />
            </div>
            {form.qrImageUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => update('qrImageUrl', null)}
              >
                Remove QR image
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="m-0 text-[12.5px] text-subtle">
            You can add a QR image after saving this payment method.
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
          Save payment method
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function useFieldIds() {
  const prefix = useId()

  return {
    method: `${prefix}-method`,
    label: `${prefix}-label`,
    accountName: `${prefix}-account-name`,
    accountNumber: `${prefix}-account-number`,
    instructions: `${prefix}-instructions`,
  }
}

function Field({
  id,
  label,
  hint,
  className = '',
  children,
}: {
  readonly id: string
  readonly label: string
  readonly hint?: string
  readonly className?: string
  readonly children: React.ReactNode
}) {
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


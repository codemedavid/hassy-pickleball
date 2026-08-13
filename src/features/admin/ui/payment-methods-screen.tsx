'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AdminPageHeader, AdminScreen, CARD, CELL, EmptyState, TABLE_HEAD } from './primitives'
import { PaymentMethodEditor } from './payment-method-editor'
import type { UploadedImage } from './image-upload-field'
import type { Result } from '@/lib/api/result'
import type { PaymentMethod } from '@/lib/repositories/mappers'

type MoveResult = { readonly id: string; readonly direction: 'up' | 'down' }

export interface PaymentMethodsScreenProps {
  readonly methods: readonly PaymentMethod[]
  readonly onSave: (payload: unknown) => Promise<Result<PaymentMethod>>
  readonly onMove: (payload: unknown) => Promise<Result<MoveResult>>
  readonly onUpload: (form: FormData) => Promise<Result<UploadedImage>>
}

type EditTarget = string | 'new' | null
const COLUMNS = ['Method', 'Account', 'Payment proof', 'Status', ''] as const

const CHANNEL_LABELS: Record<PaymentMethod['method'], string> = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  gcash: 'GCash',
  online: 'Online payment',
}

export function PaymentMethodsScreen({
  methods,
  onSave,
  onMove,
  onUpload,
}: PaymentMethodsScreenProps) {
  const router = useRouter()
  const [editing, setEditing] = useState<EditTarget>(null)
  const [freshMethod, setFreshMethod] = useState<PaymentMethod | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const displayedMethods = useMemo(() => {
    if (!freshMethod || methods.some((method) => method.id === freshMethod.id)) return methods

    return [...methods, freshMethod].sort(
      (left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id),
    )
  }, [freshMethod, methods])

  const activeCount = displayedMethods.filter((method) => method.isActive).length

  function handleSaved(saved: PaymentMethod, wasNew: boolean): void {
    if (wasNew) {
      setFreshMethod(saved)
      setEditing(saved.id)
    } else {
      setEditing(null)
    }

    router.refresh()
  }

  function mutate(run: () => Promise<Result<unknown>>): void {
    setError(null)
    startTransition(async () => {
      const result = await run()

      if (!result.success) {
        setError(result.error)
        return
      }

      router.refresh()
    })
  }

  function toggle(method: PaymentMethod): void {
    if (method.isActive && activeCount === 1) {
      const confirmed = window.confirm(
        'Hiding the final active payment method will pause online checkout. Continue?',
      )

      if (!confirmed) return

      mutate(() =>
        onSave({ id: method.id, isActive: false, acknowledgeCheckoutPause: true }),
      )
      return
    }

    mutate(() => onSave({ id: method.id, isActive: !method.isActive }))
  }

  return (
    <AdminScreen>
      <AdminPageHeader
        title="Payment methods"
        subtitle="Payment choices and instructions shown to guests at checkout"
      >
        <Button onClick={() => setEditing('new')} disabled={editing === 'new'}>
          Add payment method
        </Button>
      </AdminPageHeader>

      {error ? (
        <p role="alert" className={`${CARD} mb-4 px-4 py-3 text-[13px] text-danger`}>
          {error}
        </p>
      ) : null}

      {editing === 'new' ? (
        <div className={`${CARD} mb-4`}>
          <PaymentMethodEditor
            paymentMethod={null}
            onSave={onSave}
            onUpload={onUpload}
            onSaved={(saved) => handleSaved(saved, true)}
            onCancel={() => setEditing(null)}
          />
        </div>
      ) : null}

      <div className={`${CARD} overflow-x-auto`}>
        {displayedMethods.length === 0 ? (
          <EmptyState>No payment methods yet. Add one to reopen online checkout.</EmptyState>
        ) : (
          <table
            aria-label="Payment methods"
            className="w-full min-w-[880px] border-collapse text-[14px]"
          >
            <thead className={TABLE_HEAD}>
              <tr>
                {COLUMNS.map((column, index) => (
                  <th key={column || index} scope="col" className={CELL}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedMethods.map((method, index) => (
                <PaymentMethodRow
                  key={method.id}
                  method={method}
                  isEditing={editing === method.id}
                  isPending={isPending}
                  isFirst={index === 0}
                  isLast={index === displayedMethods.length - 1}
                  onEdit={() => setEditing(method.id)}
                  onToggle={() => toggle(method)}
                  onMove={(direction) =>
                    mutate(() => onMove({ id: method.id, direction }))
                  }
                  onSave={onSave}
                  onUpload={onUpload}
                  onSaved={(saved) => handleSaved(saved, false)}
                  onCancel={() => setEditing(null)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminScreen>
  )
}

function PaymentMethodRow({
  method,
  isEditing,
  isPending,
  isFirst,
  isLast,
  onEdit,
  onToggle,
  onMove,
  onSave,
  onUpload,
  onSaved,
  onCancel,
}: {
  readonly method: PaymentMethod
  readonly isEditing: boolean
  readonly isPending: boolean
  readonly isFirst: boolean
  readonly isLast: boolean
  readonly onEdit: () => void
  readonly onToggle: () => void
  readonly onMove: (direction: 'up' | 'down') => void
  readonly onSave: PaymentMethodsScreenProps['onSave']
  readonly onUpload: PaymentMethodsScreenProps['onUpload']
  readonly onSaved: (saved: PaymentMethod) => void
  readonly onCancel: () => void
}) {
  return (
    <>
      <tr className="border-t border-[#f2f5f8]">
        <td className={CELL}>
          <span className="block font-semibold">{method.label}</span>
          <span className="mt-px block text-[12.5px] text-subtle">
            {CHANNEL_LABELS[method.method]}
          </span>
        </td>
        <td className={`${CELL} text-slate`}>
          {method.accountName || method.accountNumber ? (
            <>
              {method.accountName ? <span className="block">{method.accountName}</span> : null}
              {method.accountNumber ? (
                <span className="block font-semibold tabular-nums">{method.accountNumber}</span>
              ) : null}
            </>
          ) : (
            '—'
          )}
        </td>
        <td className={`${CELL} text-slate`}>
          {method.requiresProof ? 'Required' : 'Not required'}
        </td>
        <td className={CELL}>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase ${
              method.isActive ? 'bg-success-bg text-success' : 'bg-surface-sunken text-muted'
            }`}
          >
            {method.isActive ? 'Active' : 'Hidden'}
          </span>
        </td>
        <td className={CELL}>
          <div className="flex justify-end gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMove('up')}
              disabled={isPending || isFirst}
              aria-label={`Move ${method.label} up`}
            >
              ↑
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMove('down')}
              disabled={isPending || isLast}
              aria-label={`Move ${method.label} down`}
            >
              ↓
            </Button>
            <Button variant="secondary" size="sm" onClick={onEdit} disabled={isEditing}>
              Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={onToggle} disabled={isPending}>
              {method.isActive ? 'Hide' : 'Restore'}
            </Button>
          </div>
        </td>
      </tr>

      {isEditing ? (
        <tr className="border-t border-[#f2f5f8]">
          <td colSpan={COLUMNS.length} className="bg-surface-alt p-0">
            <PaymentMethodEditor
              paymentMethod={method}
              onSave={onSave}
              onUpload={onUpload}
              onSaved={onSaved}
              onCancel={onCancel}
            />
          </td>
        </tr>
      ) : null}
    </>
  )
}

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
  TABLE_SHELL,
} from './primitives'
import { Button } from '@/components/ui/button'
import { CourtEditor } from './court-editor'
import { type UploadedImage } from './image-upload-field'
import { formatMoney } from '@/lib/format/money'
import type { Court } from '@/lib/repositories/mappers'
import type { CourtEnvironment } from '@/lib/repositories/rows'
import type { Result } from '@/lib/api/result'

/**
 * The club's courts: what exists, what is bookable, and the editor for both.
 *
 * The editor opens inline beneath the row it belongs to rather than on its own
 * route, because the console is tab-driven and has no nested pages to match.
 * Only one row edits at a time — two open forms writing the same list is a way
 * to lose an edit, not a feature.
 *
 * A court is never deleted. `booking_courts` references it with
 * `on delete restrict`, so a court that has ever been booked cannot be removed
 * and its history must keep resolving; taking it offline is the real operation,
 * and the buttons say so.
 */

export interface CourtsScreenProps {
  readonly courts: readonly Court[]
  readonly currency: string
  readonly onSave: (payload: unknown) => Promise<Result<Court>>
  readonly onUpload: (form: FormData) => Promise<Result<UploadedImage>>
}

const COLUMNS = ['Court', 'Surface', 'Players', 'Price', 'Order', 'Status', ''] as const

const ENVIRONMENT_LABELS: Record<CourtEnvironment, string> = {
  indoor: 'Indoor',
  outdoor: 'Outdoor',
}
const SAVE_FAILURE_MESSAGE = 'We could not save that change. Please try again.'

/** Which row's editor is open. 'new' is the add form, which belongs to no row. */
type EditTarget = string | 'new' | null

export function CourtsScreen({ courts, currency, onSave, onUpload }: CourtsScreenProps) {
  const router = useRouter()
  const [editing, setEditing] = useState<EditTarget>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSaved(): void {
    setEditing(null)
    router.refresh()
  }

  function toggleAvailability(court: Court): void {
    setError(null)

    startTransition(async () => {
      try {
        const result = await onSave({ id: court.id, isActive: !court.isActive })

        if (!result.success) {
          setError(result.error)
          return
        }

        router.refresh()
      } catch {
        setError(SAVE_FAILURE_MESSAGE)
      }
    })
  }

  return (
    <AdminScreen>
      <AdminPageHeader title="Courts" subtitle="The courts guests can book, and what each one is">
        <Button onClick={() => setEditing('new')} disabled={editing === 'new'}>
          Add court
        </Button>
      </AdminPageHeader>

      {error ? (
        <p role="alert" className={`${CARD} mb-4 px-4 py-3 text-[13px] text-danger`}>
          {error}
        </p>
      ) : null}

      {editing === 'new' ? (
        <div className={`${CARD} mb-4`}>
          <CourtEditor
            court={null}
            currency={currency}
            onSave={onSave}
            onUpload={onUpload}
            onSaved={handleSaved}
            onCancel={() => setEditing(null)}
          />
        </div>
      ) : null}

      <div className={`${TABLE_SHELL} sm:overflow-x-auto`}>
        {courts.length === 0 ? (
          <EmptyState>No courts yet. Add one to start taking bookings.</EmptyState>
        ) : (
          <DataTable label="Courts" columns={COLUMNS} wideClassName="sm:min-w-[820px]">
            {courts.map((court) => (
              <CourtRow
                key={court.id}
                court={court}
                currency={currency}
                isPending={isPending}
                isEditing={editing === court.id}
                onEdit={() => setEditing(court.id)}
                onToggle={() => toggleAvailability(court)}
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

interface CourtRowProps {
  readonly court: Court
  readonly currency: string
  readonly isPending: boolean
  readonly isEditing: boolean
  readonly onEdit: () => void
  readonly onToggle: () => void
  readonly onSave: CourtsScreenProps['onSave']
  readonly onUpload: CourtsScreenProps['onUpload']
  readonly onSaved: () => void
  readonly onCancel: () => void
}

function CourtRow({
  court,
  currency,
  isPending,
  isEditing,
  onEdit,
  onToggle,
  onSave,
  onUpload,
  onSaved,
  onCancel,
}: CourtRowProps) {
  return (
    <>
      <Row>
        <Cell label="Court" mobile="title">
          <span className="block font-semibold">{court.name}</span>
          <span className="mt-px block text-[12.5px] font-normal text-subtle">/{court.slug}</span>
        </Cell>
        <Cell label="Surface" mobile="lead" className="text-slate">
          <span className="block">{court.surface}</span>
          <span className="mt-px block text-[12.5px] text-subtle">
            {ENVIRONMENT_LABELS[court.environment]}
            {court.isTournamentGrade ? ' · Tournament grade' : ''}
          </span>
        </Cell>
        <Cell label="Players" className="text-slate tabular-nums">
          <span className="block">
            {court.minPlayers}–{court.maxPlayers}
          </span>
          {/* Only where staff opted in: a "0 per extra player" line would be
              noise on every court that is still sold whole for the slot price. */}
          {court.extraPlayerFeeCents > 0 ? (
            <span className="mt-px block text-[12.5px] text-subtle">
              {court.includedPlayers} covered · {formatMoney(court.extraPlayerFeeCents, currency)}{' '}
              each
            </span>
          ) : null}
        </Cell>
        <Cell label="Price" mobile="trailing" className="text-slate tabular-nums">
          {formatMoney(court.basePriceCents, currency)}
        </Cell>
        <Cell label="Order" className="text-slate tabular-nums">
          {court.sortOrder}
        </Cell>
        <Cell label="Status" mobile="badge">
          {/* Wording, not just colour: an offline court still sits in the list. */}
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase ${
              court.isActive ? 'bg-success-bg text-success' : 'bg-surface-sunken text-muted'
            }`}
          >
            {court.isActive ? 'Bookable' : 'Offline'}
          </span>
        </Cell>
        <Cell label="" mobile="actions">
          {/* Side by side and full width on a phone: a pair of 70px buttons in
              the corner of a card is a miss waiting to happen. */}
          <div className="flex justify-end gap-2 max-sm:grid max-sm:grid-cols-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onEdit}
              disabled={isEditing}
              className="max-sm:h-11 max-sm:text-sm"
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              disabled={isPending}
              className="max-sm:h-11 max-sm:border max-sm:border-line-strong max-sm:text-sm"
            >
              {court.isActive ? 'Take offline' : 'Bring back'}
            </Button>
          </div>
        </Cell>
      </Row>

      {isEditing ? (
        <FullWidthRow columnCount={COLUMNS.length}>
          <CourtEditor
            court={court}
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

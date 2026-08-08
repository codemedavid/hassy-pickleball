'use client'

import { useId, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { ImageUploadField, type UploadedImage } from './image-upload-field'
import { toCourtPayload, toFormState, toSlug, type CourtFormState } from '../view/court-form'
import type { Court } from '@/lib/repositories/mappers'
import type { CourtEnvironment } from '@/lib/repositories/rows'
import type { Result } from '@/lib/api/result'

/**
 * The add-and-edit form for a court.
 *
 * One form for both, because the fields are the same and saveCourt keys off the
 * presence of an id. Validation is not duplicated here: the schema behind the
 * action owns it, and its message is what the staff member reads. The one
 * exception is the capacity band, checked locally because an inverted band is
 * easy to typo and there is no reason to spend a round trip discovering it.
 *
 * Hero images are only offered for a court that exists. The image store files
 * them under the court's id, so there is nowhere to put one until the row has
 * been created — the form says so rather than presenting a control that fails.
 */

export interface CourtEditorProps {
  /** Null when adding. */
  readonly court: Court | null
  readonly currency: string
  readonly onSave: (payload: unknown) => Promise<Result<Court>>
  readonly onUpload: (form: FormData) => Promise<Result<UploadedImage>>
  readonly onSaved: () => void
  readonly onCancel: () => void
}

const CAPACITY_MESSAGE = 'The most players cannot be fewer than the fewest'
const INCLUDED_MESSAGE = 'Players covered by the price must sit inside the court capacity'

const FIELD =
  'h-10 rounded-xl border border-line-strong bg-surface px-3 text-[14px] text-ink ' +
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-navy-mid'
const AREA =
  'min-h-20 rounded-xl border border-line-strong bg-surface px-3 py-2 text-[14px] text-ink ' +
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-navy-mid'
const LABEL = 'text-[13px] font-semibold text-ink'

export function CourtEditor({
  court,
  currency,
  onSave,
  onUpload,
  onSaved,
  onCancel,
}: CourtEditorProps) {
  const [form, setForm] = useState<CourtFormState>(() => toFormState(court))
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  /**
   * Whether the slug still tracks the name. An existing court's slug is a live
   * URL, so it never does; a new court's stops the moment it is typed in.
   */
  const [isSlugDerived, setIsSlugDerived] = useState(court === null)

  const ids = useFieldIds()

  function update<K extends keyof CourtFormState>(key: K, value: CourtFormState[K]): void {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleNameChange(name: string): void {
    setForm((current) => ({
      ...current,
      name,
      slug: isSlugDerived ? toSlug(name) : current.slug,
    }))
  }

  function handleSlugChange(slug: string): void {
    setIsSlugDerived(false)
    update('slug', slug)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()

    const payload = toCourtPayload(form, court?.id)

    if (payload.maxPlayers < payload.minPlayers) {
      setError(CAPACITY_MESSAGE)
      return
    }

    if (
      payload.includedPlayers < payload.minPlayers ||
      payload.includedPlayers > payload.maxPlayers
    ) {
      setError(INCLUDED_MESSAGE)
      return
    }

    setError(null)

    startTransition(async () => {
      const result = await onSave(payload)

      if (!result.success) {
        setError(result.error)
        return
      }

      onSaved()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 p-5 sm:grid-cols-2">
      <Field id={ids.name} label="Court name">
        <input
          id={ids.name}
          value={form.name}
          onChange={(event) => handleNameChange(event.target.value)}
          required
          maxLength={120}
          className={FIELD}
        />
      </Field>

      <Field id={ids.slug} label="URL slug" hint="Appears in the court’s public web address.">
        <input
          id={ids.slug}
          value={form.slug}
          onChange={(event) => handleSlugChange(event.target.value)}
          required
          maxLength={80}
          className={FIELD}
        />
      </Field>

      <Field id={ids.surface} label="Surface">
        <input
          id={ids.surface}
          value={form.surface}
          onChange={(event) => update('surface', event.target.value)}
          required
          maxLength={120}
          className={FIELD}
        />
      </Field>

      <Field id={ids.environment} label="Environment">
        <select
          id={ids.environment}
          value={form.environment}
          onChange={(event) => update('environment', event.target.value as CourtEnvironment)}
          className={FIELD}
        >
          <option value="indoor">Indoor</option>
          <option value="outdoor">Outdoor</option>
        </select>
      </Field>

      <Field id={ids.basePrice} label={`Base price (${currency} per hour)`}>
        <input
          id={ids.basePrice}
          value={form.basePrice}
          onChange={(event) => update('basePrice', event.target.value)}
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

      <Field id={ids.minPlayers} label="Fewest players">
        <input
          id={ids.minPlayers}
          value={form.minPlayers}
          onChange={(event) => update('minPlayers', event.target.value)}
          inputMode="numeric"
          className={FIELD}
        />
      </Field>

      <Field id={ids.maxPlayers} label="Most players">
        <input
          id={ids.maxPlayers}
          value={form.maxPlayers}
          onChange={(event) => update('maxPlayers', event.target.value)}
          inputMode="numeric"
          className={FIELD}
        />
      </Field>

      <Field
        id={ids.includedPlayers}
        label="Players covered by the price"
        hint="Anyone beyond this pays the fee below."
      >
        <input
          id={ids.includedPlayers}
          value={form.includedPlayers}
          onChange={(event) => update('includedPlayers', event.target.value)}
          inputMode="numeric"
          className={FIELD}
        />
      </Field>

      <Field
        id={ids.extraPlayerFee}
        label={`Fee per extra player (${currency})`}
        hint="Leave at 0 to sell the whole court for the slot price."
      >
        <input
          id={ids.extraPlayerFee}
          value={form.extraPlayerFee}
          onChange={(event) => update('extraPlayerFee', event.target.value)}
          inputMode="decimal"
          className={FIELD}
        />
      </Field>

      <label className="flex items-center gap-2.5 self-end sm:col-span-2">
        <input
          type="checkbox"
          checked={form.isTournamentGrade}
          onChange={(event) => update('isTournamentGrade', event.target.checked)}
          className="size-4"
        />
        <span className={LABEL}>Tournament grade</span>
      </label>

      <Field id={ids.blurb} label="Blurb" className="sm:col-span-2">
        <textarea
          id={ids.blurb}
          value={form.blurb}
          onChange={(event) => update('blurb', event.target.value)}
          maxLength={500}
          className={AREA}
        />
      </Field>

      <Field id={ids.notes} label="Good to know" hint="One per line.">
        <textarea
          id={ids.notes}
          value={form.notes}
          onChange={(event) => update('notes', event.target.value)}
          className={AREA}
        />
      </Field>

      <Field id={ids.includes} label="Included" hint="One per line.">
        <textarea
          id={ids.includes}
          value={form.includes}
          onChange={(event) => update('includes', event.target.value)}
          className={AREA}
        />
      </Field>

      <Field id={ids.tags} label="Tags" hint="One per line.">
        <textarea
          id={ids.tags}
          value={form.tags}
          onChange={(event) => update('tags', event.target.value)}
          className={AREA}
        />
      </Field>

      <div className="sm:col-span-1">
        {court ? (
          <ImageUploadField
            label="Hero image"
            subject="court"
            subjectId={court.id}
            value={form.heroImageUrl}
            onUpload={onUpload}
            onUploaded={(url) => update('heroImageUrl', url)}
          />
        ) : (
          <p className="m-0 text-[12.5px] text-subtle">
            You can add a hero image after saving this court.
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
          Save court
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
    slug: `${prefix}-slug`,
    surface: `${prefix}-surface`,
    environment: `${prefix}-environment`,
    basePrice: `${prefix}-base-price`,
    sortOrder: `${prefix}-sort-order`,
    minPlayers: `${prefix}-min-players`,
    maxPlayers: `${prefix}-max-players`,
    includedPlayers: `${prefix}-included-players`,
    extraPlayerFee: `${prefix}-extra-player-fee`,
    blurb: `${prefix}-blurb`,
    notes: `${prefix}-notes`,
    includes: `${prefix}-includes`,
    tags: `${prefix}-tags`,
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

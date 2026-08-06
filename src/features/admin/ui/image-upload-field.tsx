'use client'

import { useId, useState, useTransition } from 'react'
import Image from 'next/image'
import { IMAGE_ACCEPT_ATTRIBUTE, validateImage } from '@/lib/domain/image-upload'
import type { CatalogSubject } from '@/lib/domain/image-upload'
import type { Result } from '@/lib/api/result'

/**
 * Picks an image and hands back the URL it was stored at.
 *
 * Uploading is separate from saving the row: a staff member picks a file, it
 * lands in the image store, and the editor holds the returned URL until they
 * save. That way a half-filled form does not need a draft row to hang an image
 * off, and re-picking simply overwrites.
 *
 * The file is checked here as well as on the server. Not instead of: the
 * browser check spares a staff member a five-megabyte upload that was going to
 * be refused, and the server check exists because nothing a browser says is
 * binding.
 */

export type UploadedImage = { readonly url: string; readonly path: string }

export type ImageUploadFieldProps = {
  readonly label: string
  readonly subject: CatalogSubject
  readonly subjectId: string
  /** The image currently on the row, if any. */
  readonly value: string | null
  readonly onUpload: (form: FormData) => Promise<Result<UploadedImage>>
  readonly onUploaded: (url: string) => void
}

const PREVIEW_SIZE = 96

export function ImageUploadField({
  label,
  subject,
  subjectId,
  value,
  onUpload,
  onUploaded,
}: ImageUploadFieldProps) {
  const inputId = useId()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const validated = validateImage(file)

    if (!validated.success) {
      setError(validated.error)
      return
    }

    setError(null)

    const form = new FormData()
    form.set('file', file)
    form.set('subject', subject)
    form.set('id', subjectId)

    startTransition(async () => {
      const result = await onUpload(form)

      if (!result.success) {
        setError(result.error)
        return
      }

      onUploaded(result.data.url)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-[13px] font-semibold text-ink">
        {label}
      </label>

      {value ? (
        <Image
          src={value}
          alt={label}
          width={PREVIEW_SIZE}
          height={PREVIEW_SIZE}
          className="rounded-lg border border-line object-cover"
        />
      ) : null}

      <input
        id={inputId}
        type="file"
        accept={IMAGE_ACCEPT_ATTRIBUTE}
        disabled={isPending}
        onChange={handleChange}
        className="text-[13px] text-slate file:mr-3 file:rounded-lg file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:text-[13px] file:font-semibold file:text-ink"
      />

      {isPending ? <p className="text-[12.5px] text-subtle">Uploading…</p> : null}

      {error ? (
        <p role="alert" className="text-[12.5px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

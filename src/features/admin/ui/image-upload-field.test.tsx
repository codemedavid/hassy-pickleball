import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImageUploadField } from './image-upload-field'

const SUBJECT_ID = '3f8a1c2e-0000-4000-8000-000000000002'
const UPLOADED = {
  url: 'https://ik.imagekit.io/testendpoint/catalog/club/product/racket.png',
  path: '/catalog/club/product/racket.png',
}

function pngFile(name = 'racket.png', type = 'image/png') {
  return new File([new Uint8Array(1024)], name, { type })
}

function renderField(overrides: Partial<Parameters<typeof ImageUploadField>[0]> = {}) {
  const onUpload = vi.fn().mockResolvedValue({ success: true, data: UPLOADED })
  const onUploaded = vi.fn()

  render(
    <ImageUploadField
      label="Product image"
      subject="product"
      subjectId={SUBJECT_ID}
      value={null}
      onUpload={onUpload}
      onUploaded={onUploaded}
      {...overrides}
    />,
  )

  return { onUpload, onUploaded }
}

describe('ImageUploadField', () => {
  it('uploads the chosen file and reports the stored URL', async () => {
    const user = userEvent.setup()
    const { onUpload, onUploaded } = renderField()

    await user.upload(screen.getByLabelText(/product image/i), pngFile())

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(UPLOADED.url))
    expect(onUpload).toHaveBeenCalledTimes(1)
  })

  it('sends the subject and id alongside the file', async () => {
    const user = userEvent.setup()
    const { onUpload } = renderField()

    await user.upload(screen.getByLabelText(/product image/i), pngFile())

    await waitFor(() => expect(onUpload).toHaveBeenCalled())
    const form = onUpload.mock.calls[0][0] as FormData
    expect(form.get('subject')).toBe('product')
    expect(form.get('id')).toBe(SUBJECT_ID)
    expect(form.get('file')).toBeInstanceOf(File)
  })

  /**
   * The browser check exists to spare a staff member an upload that was going
   * to be refused. It does not replace the server's — nothing a browser says
   * is binding.
   */
  it('refuses a file that is not an image without uploading anything', async () => {
    // applyAccept: false is the point of the test. The `accept` attribute is a
    // hint the OS file dialog offers to respect, and a staff member who
    // switches it to "All files" gets past it — so the check has to be in our
    // code too.
    const user = userEvent.setup({ applyAccept: false })
    const { onUpload } = renderField()

    await user.upload(
      screen.getByLabelText(/product image/i),
      pngFile('notes.pdf', 'application/pdf'),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(/image/i)
    expect(onUpload).not.toHaveBeenCalled()
  })

  it('surfaces a server-side rejection to the staff member', async () => {
    const user = userEvent.setup()
    const onUpload = vi.fn().mockResolvedValue({
      success: false,
      error: 'That image is too large. Please upload one smaller than 5 MB.',
      code: 'INVALID',
    })
    renderField({ onUpload })

    await user.upload(screen.getByLabelText(/product image/i), pngFile())

    expect(await screen.findByRole('alert')).toHaveTextContent(/too large/i)
  })

  it('shows the current image when one is already set', () => {
    renderField({ value: UPLOADED.url })

    expect(screen.getByRole('img', { name: /product image/i })).toHaveAttribute(
      'src',
      expect.stringContaining('racket.png'),
    )
  })

  it('shows nothing to remove when no image is set', () => {
    renderField({ value: null })

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})

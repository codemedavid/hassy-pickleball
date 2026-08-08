import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProductEditor } from './product-editor'
import { makeProduct } from '../../../../test/admin-fixtures'

const PRODUCT_ID = '77777777-7777-4777-7777-777777777777'

const paddle = makeProduct({
  id: PRODUCT_ID,
  name: 'Paddle rental',
  description: 'Loaner paddle for the session',
  type: 'addon',
  priceCents: 10_000,
  sortOrder: 3,
})

function renderEditor(overrides: Partial<React.ComponentProps<typeof ProductEditor>> = {}): {
  onSave: ReturnType<typeof vi.fn>
  onUpload: ReturnType<typeof vi.fn>
  onSaved: ReturnType<typeof vi.fn>
  onCancel: ReturnType<typeof vi.fn>
} {
  const onSave = vi.fn().mockResolvedValue({ success: true, data: paddle })
  const onUpload = vi.fn()
  const onSaved = vi.fn()
  const onCancel = vi.fn()

  render(
    <ProductEditor
      product={null}
      currency="PHP"
      onSave={onSave}
      onUpload={onUpload}
      onSaved={onSaved}
      onCancel={onCancel}
      {...overrides}
    />,
  )

  return { onSave, onUpload, onSaved, onCancel }
}

/** Fills the fields the schema requires, so a submit is expected to succeed. */
async function fillRequired(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByLabelText(/^product name/i), 'Flat white')
  await user.clear(screen.getByLabelText(/price/i))
  await user.type(screen.getByLabelText(/price/i), '150')
}

describe('ProductEditor — adding a product', () => {
  it('sends every field the staff member filled in', async () => {
    // Arrange
    const user = userEvent.setup()
    const { onSave } = renderEditor()

    // Act
    await fillRequired(user)
    await user.selectOptions(screen.getByLabelText(/type/i), 'cafe')
    await user.type(screen.getByLabelText(/description/i), 'Single origin')
    await user.clear(screen.getByLabelText(/sort order/i))
    await user.type(screen.getByLabelText(/sort order/i), '4')
    await user.click(screen.getByRole('button', { name: /save product/i }))

    // Assert
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Flat white',
          description: 'Single origin',
          type: 'cafe',
          priceCents: 15_000,
          sortOrder: 4,
        }),
      ),
    )
  })

  it('creates rather than patches, sending no id', async () => {
    const user = userEvent.setup()
    const { onSave } = renderEditor()

    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: /save product/i }))

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0][0]).not.toHaveProperty('id')
  })

  it('lets staff turn off the quantity picker for a one-per-booking item', async () => {
    // Arrange
    const user = userEvent.setup()
    const { onSave } = renderEditor()

    // Act
    await fillRequired(user)
    await user.click(screen.getByLabelText(/quantity/i))
    await user.click(screen.getByRole('button', { name: /save product/i }))

    // Assert
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ hasQuantity: false })),
    )
  })

  it('says the image can be added after saving, because there is no row to file it under yet', () => {
    renderEditor()

    expect(screen.queryByLabelText(/product image/i)).not.toBeInTheDocument()
    expect(screen.getByText(/add.*image.*after.*sav/i)).toBeInTheDocument()
  })
})

describe('ProductEditor — editing a product', () => {
  it('opens with the product’s current details already filled in', () => {
    renderEditor({ product: paddle })

    expect(screen.getByLabelText(/^product name/i)).toHaveValue('Paddle rental')
    expect(screen.getByLabelText(/description/i)).toHaveValue('Loaner paddle for the session')
    expect(screen.getByLabelText(/price/i)).toHaveValue('100')
  })

  it('patches the product it was opened for, carrying its id', async () => {
    const user = userEvent.setup()
    const { onSave } = renderEditor({ product: paddle })

    await user.clear(screen.getByLabelText(/price/i))
    await user.type(screen.getByLabelText(/price/i), '120')
    await user.click(screen.getByRole('button', { name: /save product/i }))

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ id: PRODUCT_ID, priceCents: 12_000 }),
      ),
    )
  })

  it('offers the image uploader, now that there is a row to attach one to', () => {
    renderEditor({ product: paddle })

    expect(screen.getByLabelText(/product image/i)).toBeInTheDocument()
  })

  it('uploads the image against the product it was opened for', async () => {
    // Arrange — the subject and id decide the ImageKit folder, so a wrong one
    // files a product image under some other row.
    const user = userEvent.setup()
    const uploaded = { url: 'https://ik.imagekit.io/test/paddle.png', path: '/x.png' }
    const onUpload = vi.fn().mockResolvedValue({ success: true, data: uploaded })
    renderEditor({ product: paddle, onUpload })

    // Act
    await user.upload(
      screen.getByLabelText(/product image/i),
      new File([new Uint8Array(1024)], 'paddle.png', { type: 'image/png' }),
    )

    // Assert
    await waitFor(() => expect(onUpload).toHaveBeenCalled())
    const form = onUpload.mock.calls[0][0] as FormData
    expect(form.get('subject')).toBe('product')
    expect(form.get('id')).toBe(PRODUCT_ID)
  })

  it('keeps the uploaded image URL for the save that follows', async () => {
    // Arrange
    const user = userEvent.setup()
    const uploaded = { url: 'https://ik.imagekit.io/test/paddle.png', path: '/x.png' }
    const onUpload = vi.fn().mockResolvedValue({ success: true, data: uploaded })
    const { onSave } = renderEditor({ product: paddle, onUpload })

    // Act
    await user.upload(
      screen.getByLabelText(/product image/i),
      new File([new Uint8Array(1024)], 'paddle.png', { type: 'image/png' }),
    )
    await waitFor(() => expect(onUpload).toHaveBeenCalled())
    await user.click(screen.getByRole('button', { name: /save product/i }))

    // Assert
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ imageUrl: uploaded.url })),
    )
  })
})

describe('ProductEditor — failure paths', () => {
  it('shows the reason the server refused the save', async () => {
    // Arrange
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue({
      success: false,
      error: 'Check the product details',
    })
    renderEditor({ onSave })

    // Act
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: /save product/i }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(/product details/i)
  })

  it('does not report success when the save was refused', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue({ success: false, error: 'Nope' })
    const { onSaved } = renderEditor({ onSave })

    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: /save product/i }))

    await screen.findByRole('alert')
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('surfaces a refused upload without claiming the image was stored', async () => {
    // Arrange
    const user = userEvent.setup()
    const onUpload = vi.fn().mockResolvedValue({ success: false, error: 'That file is too large' })
    renderEditor({ product: paddle, onUpload })

    // Act
    await user.upload(
      screen.getByLabelText(/product image/i),
      new File([new Uint8Array(1024)], 'paddle.png', { type: 'image/png' }),
    )

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(/too large/i)
  })

  it('reports the save as done once it succeeds', async () => {
    const user = userEvent.setup()
    const { onSaved } = renderEditor()

    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: /save product/i }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  })

  it('abandons the edit without saving when cancelled', async () => {
    const user = userEvent.setup()
    const { onSave, onCancel } = renderEditor({ product: paddle })

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
  })
})

import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PaymentMethodEditor } from './payment-method-editor'
import type { PaymentMethod } from '@/lib/repositories/mappers'

const METHOD_ID = '55555555-5555-4555-8555-555555555555'

const gcash: PaymentMethod = {
  id: METHOD_ID,
  clubId: 'club-1',
  method: 'gcash',
  label: 'GCash',
  accountName: 'Baseline Pickleball Club',
  accountNumber: '0917 123 4567',
  instructions: 'Send the exact total.',
  qrImageUrl: 'https://ik.imagekit.io/test/gcash.png',
  requiresProof: true,
  sortOrder: 1,
  isActive: true,
}

function renderEditor(paymentMethod: PaymentMethod | null = gcash) {
  const onSave = vi.fn().mockResolvedValue({ success: true, data: gcash })
  const onUpload = vi.fn()
  const onSaved = vi.fn()

  render(
    <PaymentMethodEditor
      paymentMethod={paymentMethod}
      onSave={onSave}
      onUpload={onUpload}
      onSaved={onSaved}
      onCancel={vi.fn()}
    />,
  )

  return { onSave, onUpload, onSaved }
}

describe('PaymentMethodEditor', () => {
  it('hydrates every customer-facing field for an existing method', () => {
    renderEditor()

    expect(screen.getByLabelText(/payment channel/i)).toHaveValue('gcash')
    expect(screen.getByLabelText(/display label/i)).toHaveValue('GCash')
    expect(screen.getByLabelText(/account name/i)).toHaveValue('Baseline Pickleball Club')
    expect(screen.getByLabelText(/account number/i)).toHaveValue('0917 123 4567')
    expect(screen.getByLabelText(/payment instructions/i)).toHaveValue('Send the exact total.')
    expect(screen.getByLabelText(/require payment proof/i)).toBeChecked()
  })

  it('explains that a new method must be saved before its QR image can be added', () => {
    renderEditor(null)

    expect(screen.getByText(/add a qr image after saving/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/qr image/i)).not.toBeInTheDocument()
  })

  it('sends trimmed, normalized form data to the save action', async () => {
    const user = userEvent.setup()
    const { onSave, onSaved } = renderEditor(null)

    await user.selectOptions(screen.getByLabelText(/payment channel/i), 'cash')
    await user.type(screen.getByLabelText(/display label/i), '  Pay at the desk  ')
    await user.type(screen.getByLabelText(/payment instructions/i), '  Arrive early.  ')
    await user.click(screen.getByRole('button', { name: /save payment method/i }))

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        method: 'cash',
        label: 'Pay at the desk',
        accountName: null,
        accountNumber: null,
        instructions: 'Arrive early.',
        qrImageUrl: null,
        requiresProof: false,
      }),
    )
    expect(onSaved).toHaveBeenCalledWith(gcash)
  })

  it('can remove a stored QR image before saving the edit', async () => {
    const user = userEvent.setup()
    const { onSave } = renderEditor()

    await user.click(screen.getByRole('button', { name: /remove qr image/i }))
    await user.click(screen.getByRole('button', { name: /save payment method/i }))

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ qrImageUrl: null })))
  })

  it('shows a server refusal without closing the editor', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue({ success: false, error: 'Add payment instructions' })

    render(
      <PaymentMethodEditor
        paymentMethod={gcash}
        onSave={onSave}
        onUpload={vi.fn()}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /save payment method/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/payment instructions/i)
    expect(screen.getByLabelText(/display label/i)).toBeInTheDocument()
  })
})


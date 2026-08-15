import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PaymentMethodsScreen } from './payment-methods-screen'
import type { PaymentMethod } from '@/lib/repositories/mappers'
import {
  expectCellsLabelledByColumn,
  expectExplicitTableRoles,
  expectNoPhoneMinimumWidth,
} from '../../../../test/responsive-table'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

const first: PaymentMethod = {
  id: '55555555-5555-4555-8555-555555555555',
  clubId: 'club-1',
  method: 'gcash',
  label: 'GCash',
  accountName: 'Baseline Pickleball Club',
  accountNumber: '0917 123 4567',
  instructions: 'Send the exact total.',
  qrImageUrl: null,
  requiresProof: true,
  sortOrder: 1,
  isActive: true,
}

const second: PaymentMethod = {
  ...first,
  id: '66666666-6666-4666-8666-666666666666',
  method: 'cash',
  label: 'Pay at the desk',
  accountName: null,
  accountNumber: null,
  instructions: 'Arrive ten minutes early.',
  requiresProof: false,
  sortOrder: 2,
  isActive: false,
}

function renderScreen(methods: readonly PaymentMethod[] = [first, second]) {
  const onSave = vi.fn().mockImplementation(async (payload: { id?: string }) => ({
    success: true,
    data: payload.id ? first : { ...first, id: '77777777-7777-4777-8777-777777777777' },
  }))
  const onMove = vi.fn().mockResolvedValue({ success: true, data: { id: first.id, direction: 'down' } })

  render(
    <PaymentMethodsScreen
      methods={methods}
      onSave={onSave}
      onMove={onMove}
      onUpload={vi.fn()}
    />,
  )

  return { onSave, onMove }
}

function rowFor(label: string): HTMLElement {
  return screen.getByRole('row', { name: new RegExp(label, 'i') })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PaymentMethodsScreen', () => {
  it('shows active and hidden methods with their proof behavior', () => {
    renderScreen()

    expect(within(rowFor('GCash')).getByText('Active')).toBeInTheDocument()
    expect(within(rowFor('GCash')).getByText(/required/i)).toBeInTheDocument()
    expect(within(rowFor('Pay at the desk')).getByText('Hidden')).toBeInTheDocument()
  })

  it('keeps only one inline editor open', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(within(rowFor('GCash')).getByRole('button', { name: /edit/i }))
    expect(screen.getByLabelText(/display label/i)).toHaveValue('GCash')

    await user.click(within(rowFor('Pay at the desk')).getByRole('button', { name: /edit/i }))
    expect(screen.getByLabelText(/display label/i)).toHaveValue('Pay at the desk')
    expect(screen.getAllByLabelText(/display label/i)).toHaveLength(1)
  })

  it('disables impossible boundary moves and moves an adjacent row', async () => {
    const user = userEvent.setup()
    const { onMove } = renderScreen()

    expect(within(rowFor('GCash')).getByRole('button', { name: /move gcash up/i })).toBeDisabled()
    expect(
      within(rowFor('Pay at the desk')).getByRole('button', { name: /move pay at the desk down/i }),
    ).toBeDisabled()

    await user.click(within(rowFor('GCash')).getByRole('button', { name: /move gcash down/i }))

    await waitFor(() => expect(onMove).toHaveBeenCalledWith({ id: first.id, direction: 'down' }))
    expect(refresh).toHaveBeenCalled()
  })

  it('restores a hidden method without a warning', async () => {
    const user = userEvent.setup()
    const { onSave } = renderScreen()

    await user.click(within(rowFor('Pay at the desk')).getByRole('button', { name: /restore/i }))

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ id: second.id, isActive: true }))
  })

  it('requires confirmation before hiding the final active method', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { onSave } = renderScreen([first])

    await user.click(within(rowFor('GCash')).getByRole('button', { name: /^hide$/i }))

    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/pause online checkout/i))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        id: first.id,
        isActive: false,
        acknowledgeCheckoutPause: true,
      }),
    )
  })

  it('does not hide the final method when confirmation is cancelled', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { onSave } = renderScreen([first])

    await user.click(within(rowFor('GCash')).getByRole('button', { name: /^hide$/i }))

    expect(onSave).not.toHaveBeenCalled()
  })

  it('keeps a newly created method open so its QR image can be attached', async () => {
    const user = userEvent.setup()
    renderScreen([])

    await user.click(screen.getByRole('button', { name: /add payment method/i }))
    await user.type(screen.getByLabelText(/display label/i), 'Pay at the desk')
    await user.type(screen.getByLabelText(/payment instructions/i), 'Arrive early.')
    await user.click(screen.getByRole('button', { name: /save payment method/i }))

    expect(await screen.findByLabelText(/qr image/i)).toBeInTheDocument()
    expect(refresh).toHaveBeenCalled()
  })

  it('shows mutation errors without refreshing stale data', async () => {
    const user = userEvent.setup()
    const onMove = vi.fn().mockResolvedValue({ success: false, error: 'Could not reorder' })
    render(
      <PaymentMethodsScreen methods={[first, second]} onSave={vi.fn()} onMove={onMove} onUpload={vi.fn()} />,
    )

    await user.click(within(rowFor('GCash')).getByRole('button', { name: /move gcash down/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reorder/i)
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('PaymentMethodsScreen on a phone', () => {
  it('stacks each row into a labelled card instead of scrolling sideways', () => {
    // Arrange & Act
    renderScreen()

    // Assert — the header row is off-screen in the stacked layout, so every
    // cell names its own column and the table keeps its roles.
    const table = screen.getByRole('table', { name: 'Payment methods' })
    expectCellsLabelledByColumn(table)
    expectExplicitTableRoles(table)
    expectNoPhoneMinimumWidth(table)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProductsScreen } from './products-screen'
import { makeProduct } from '../../../../test/admin-fixtures'

const refresh = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

const PADDLE_ID = '77777777-7777-4777-7777-777777777777'
const COFFEE_ID = '66666666-6666-4666-8666-666666666666'

const paddle = makeProduct({
  id: PADDLE_ID,
  name: 'Paddle rental',
  description: 'Loaner paddle for the session',
  type: 'addon',
  priceCents: 10_000,
  sortOrder: 1,
  isActive: true,
})

/** Hidden, so the list must still show it — that is the point of listAllProducts. */
const coffee = makeProduct({
  id: COFFEE_ID,
  name: 'Flat white',
  description: null,
  type: 'cafe',
  priceCents: 15_000,
  sortOrder: 2,
  isActive: false,
})

function renderScreen(overrides: Partial<React.ComponentProps<typeof ProductsScreen>> = {}) {
  const onSave = vi.fn().mockResolvedValue({ success: true, data: paddle })
  const onUpload = vi.fn()

  render(
    <ProductsScreen
      products={[paddle, coffee]}
      currency="PHP"
      onSave={onSave}
      onUpload={onUpload}
      {...overrides}
    />,
  )

  return { onSave, onUpload }
}

function rowFor(name: string): HTMLElement {
  return screen.getByRole('row', { name: new RegExp(name, 'i') })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ProductsScreen — the list', () => {
  it('lists each product with its type and price', () => {
    // Act
    renderScreen()

    // Assert
    const table = screen.getByRole('table', { name: 'Products' })
    expect(within(table).getByText('Paddle rental')).toBeInTheDocument()
    expect(within(table).getByText('Add-on')).toBeInTheDocument()
    expect(within(table).getByText('₱100')).toBeInTheDocument()
  })

  it('marks a product that is not on sale, so a hidden item is not mistaken for a live one', () => {
    // Act
    renderScreen()

    // Assert
    expect(screen.getByText('Hidden')).toBeInTheDocument()
    expect(screen.getByText('On sale')).toBeInTheDocument()
  })

  it('says the catalog is empty rather than showing bare column headings', () => {
    // Act
    renderScreen({ products: [] })

    // Assert
    expect(screen.getByText(/no products yet/i)).toBeInTheDocument()
  })
})

describe('ProductsScreen — adding a product', () => {
  it('opens a blank editor when adding', async () => {
    // Arrange
    const user = userEvent.setup()
    renderScreen()

    // Act
    await user.click(screen.getByRole('button', { name: /add product/i }))

    // Assert
    expect(screen.getByLabelText(/^product name/i)).toHaveValue('')
  })

  it('refreshes the list once the new product is saved', async () => {
    // Arrange
    const user = userEvent.setup()
    renderScreen()

    // Act
    await user.click(screen.getByRole('button', { name: /add product/i }))
    await user.type(screen.getByLabelText(/^product name/i), 'Flat white')
    await user.type(screen.getByLabelText(/price/i), '150')
    await user.click(screen.getByRole('button', { name: /save product/i }))

    // Assert
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })
})

describe('ProductsScreen — editing a product', () => {
  it('opens the editor filled in with the row it belongs to', async () => {
    // Arrange
    const user = userEvent.setup()
    renderScreen()

    // Act
    await user.click(within(rowFor('Paddle rental')).getByRole('button', { name: /edit/i }))

    // Assert
    expect(screen.getByLabelText(/^product name/i)).toHaveValue('Paddle rental')
  })

  it('offers the image uploader for an existing product, so staff can attach a photo', async () => {
    // Arrange
    const user = userEvent.setup()
    renderScreen()

    // Act
    await user.click(within(rowFor('Paddle rental')).getByRole('button', { name: /edit/i }))

    // Assert
    expect(screen.getByLabelText(/product image/i)).toBeInTheDocument()
  })

  it('hides a product rather than deleting it, because booking history references it', async () => {
    // Arrange
    const user = userEvent.setup()
    const { onSave } = renderScreen()

    // Act
    await user.click(within(rowFor('Paddle rental')).getByRole('button', { name: /hide/i }))

    // Assert
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ id: PADDLE_ID, isActive: false }),
    )
  })

  it('puts a hidden product back on sale', async () => {
    const user = userEvent.setup()
    const { onSave } = renderScreen()

    await user.click(within(rowFor('Flat white')).getByRole('button', { name: /on sale/i }))

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ id: COFFEE_ID, isActive: true }))
  })

  it('shows why a refused change did not take effect', async () => {
    // Arrange
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue({ success: false, error: 'Check the product details' })
    renderScreen({ onSave })

    // Act
    await user.click(within(rowFor('Paddle rental')).getByRole('button', { name: /hide/i }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(/product details/i)
    expect(refresh).not.toHaveBeenCalled()
  })
})

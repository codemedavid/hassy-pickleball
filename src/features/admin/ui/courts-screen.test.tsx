import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CourtsScreen } from './courts-screen'
import { makeCourt } from '../../../../test/admin-fixtures'

const refresh = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

const HARBOR_ID = '88888888-8888-4888-8888-888888888888'
const RIVERSIDE_ID = '77777777-7777-4777-8777-777777777777'

const harbor = makeCourt({
  id: HARBOR_ID,
  name: 'Harbor Court',
  slug: 'harbor-court',
  surface: 'Cushioned acrylic',
  environment: 'indoor',
  basePriceCents: 60_000,
  sortOrder: 1,
  minPlayers: 2,
  maxPlayers: 4,
  isActive: true,
})

/** Offline, so the list must still show it — that is the point of listAllCourts. */
const riverside = makeCourt({
  id: RIVERSIDE_ID,
  name: 'Riverside Court',
  slug: 'riverside-court',
  surface: 'Asphalt',
  environment: 'outdoor',
  basePriceCents: 45_000,
  sortOrder: 2,
  minPlayers: 2,
  maxPlayers: 8,
  isActive: false,
})

function renderScreen(overrides: Partial<React.ComponentProps<typeof CourtsScreen>> = {}) {
  const onSave = vi.fn().mockResolvedValue({ success: true, data: harbor })
  const onUpload = vi.fn()

  render(
    <CourtsScreen
      courts={[harbor, riverside]}
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

describe('CourtsScreen — the list', () => {
  it('lists courts that are offline alongside the ones on sale', () => {
    renderScreen()

    expect(screen.getByText('Harbor Court')).toBeInTheDocument()
    expect(screen.getByText('Riverside Court')).toBeInTheDocument()
  })

  it('says in words whether a court is bookable, not only in colour', () => {
    renderScreen()

    expect(within(rowFor('Harbor Court')).getByText(/bookable/i)).toBeInTheDocument()
    expect(within(rowFor('Riverside Court')).getByText(/offline/i)).toBeInTheDocument()
  })

  it('shows the capacity band, so staff can see what a court seats', () => {
    renderScreen()

    expect(within(rowFor('Riverside Court')).getByText(/2\D+8/)).toBeInTheDocument()
  })

  it('shows the base price in the club’s currency', () => {
    renderScreen()

    expect(within(rowFor('Harbor Court')).getByText(/600/)).toBeInTheDocument()
  })

  it('invites the first court when the club has none', () => {
    renderScreen({ courts: [] })

    expect(screen.getByText(/no courts yet/i)).toBeInTheDocument()
  })
})

describe('CourtsScreen — adding and editing', () => {
  it('opens a blank editor from the add button', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(screen.getByRole('button', { name: /add court/i }))

    expect(screen.getByLabelText(/^court name/i)).toHaveValue('')
  })

  it('opens the editor prefilled for the court whose Edit was clicked', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(within(rowFor('Riverside Court')).getByRole('button', { name: /edit/i }))

    expect(screen.getByLabelText(/^court name/i)).toHaveValue('Riverside Court')
  })

  it('closes the editor and reloads the list after a save', async () => {
    // Arrange
    const user = userEvent.setup()
    renderScreen()

    // Act
    await user.click(within(rowFor('Harbor Court')).getByRole('button', { name: /edit/i }))
    await user.click(screen.getByRole('button', { name: /save court/i }))

    // Assert — a fresh read is what shows the change in the table.
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(screen.queryByLabelText(/^court name/i)).not.toBeInTheDocument()
  })

  it('closes the add form when it is cancelled', async () => {
    const user = userEvent.setup()
    const { onSave } = renderScreen()

    await user.click(screen.getByRole('button', { name: /add court/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(screen.queryByLabelText(/^court name/i)).not.toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('leaves the list untouched when the edit is cancelled', async () => {
    const user = userEvent.setup()
    const { onSave } = renderScreen()

    await user.click(within(rowFor('Harbor Court')).getByRole('button', { name: /edit/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(screen.queryByLabelText(/^court name/i)).not.toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('edits only one court at a time', async () => {
    // Arrange
    const user = userEvent.setup()
    renderScreen()

    // Act
    await user.click(within(rowFor('Harbor Court')).getByRole('button', { name: /edit/i }))
    await user.click(within(rowFor('Riverside Court')).getByRole('button', { name: /edit/i }))

    // Assert
    expect(screen.getAllByLabelText(/^court name/i)).toHaveLength(1)
    expect(screen.getByLabelText(/^court name/i)).toHaveValue('Riverside Court')
  })
})

describe('CourtsScreen — taking a court offline', () => {
  it('takes a bookable court offline without deleting it', async () => {
    // Arrange — booking_courts uses `on delete restrict`, so deleting is not an
    // option the UI may offer.
    const user = userEvent.setup()
    const { onSave } = renderScreen()

    // Act
    await user.click(within(rowFor('Harbor Court')).getByRole('button', { name: /take offline/i }))

    // Assert
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ id: HARBOR_ID, isActive: false }))
  })

  it('brings an offline court back', async () => {
    const user = userEvent.setup()
    const { onSave } = renderScreen()

    await user.click(within(rowFor('Riverside Court')).getByRole('button', { name: /bring back/i }))

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ id: RIVERSIDE_ID, isActive: true }))
  })

  it('never offers to delete a court', () => {
    renderScreen()

    expect(screen.queryByRole('button', { name: /delete|remove/i })).not.toBeInTheDocument()
  })

  it('reloads the list once a court has changed availability', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(within(rowFor('Harbor Court')).getByRole('button', { name: /take offline/i }))

    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('explains why a court could not be taken offline', async () => {
    // Arrange
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue({
      success: false,
      error: 'We could not save that change. Please try again.',
    })
    renderScreen({ onSave })

    // Act
    await user.click(within(rowFor('Harbor Court')).getByRole('button', { name: /take offline/i }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not save/i)
    expect(refresh).not.toHaveBeenCalled()
  })
})

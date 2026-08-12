import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CourtEditor } from './court-editor'
import { makeCourt } from '../../../../test/admin-fixtures'

const COURT_ID = '88888888-8888-4888-8888-888888888888'

const harbor = makeCourt({
  id: COURT_ID,
  name: 'Harbor Court',
  slug: 'harbor-court',
  basePriceCents: 60_000,
  minPlayers: 2,
  includedPlayers: 4,
  maxPlayers: 6,
  extraPlayerFeeCents: 15_000,
})

function renderEditor(overrides: Partial<React.ComponentProps<typeof CourtEditor>> = {}): {
  onSave: ReturnType<typeof vi.fn>
  onUpload: ReturnType<typeof vi.fn>
  onSaved: ReturnType<typeof vi.fn>
  onCancel: ReturnType<typeof vi.fn>
} {
  const onSave = vi.fn().mockResolvedValue({ success: true, data: harbor })
  const onUpload = vi.fn()
  const onSaved = vi.fn()
  const onCancel = vi.fn()

  render(
    <CourtEditor
      court={null}
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
  await user.type(screen.getByLabelText(/^court name/i), 'Court 4 Riverside')
  await user.type(screen.getByLabelText(/surface/i), 'Cushioned acrylic')
  await user.clear(screen.getByLabelText(/base price/i))
  await user.type(screen.getByLabelText(/base price/i), '600')
}

describe('CourtEditor — adding a court', () => {
  it('sends every field the staff member filled in', async () => {
    // Arrange
    const user = userEvent.setup()
    const { onSave } = renderEditor()

    // Act
    await fillRequired(user)
    await user.selectOptions(screen.getByLabelText(/environment/i), 'outdoor')
    await user.click(screen.getByLabelText(/tournament grade/i))
    await user.type(screen.getByLabelText(/good to know/i), 'Non-marking shoes required')
    await user.clear(screen.getByLabelText(/fewest players/i))
    await user.type(screen.getByLabelText(/fewest players/i), '2')
    await user.clear(screen.getByLabelText(/most players/i))
    await user.type(screen.getByLabelText(/most players/i), '4')
    await user.click(screen.getByRole('button', { name: /save court/i }))

    // Assert
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Court 4 Riverside',
          surface: 'Cushioned acrylic',
          environment: 'outdoor',
          isTournamentGrade: true,
          notes: ['Non-marking shoes required'],
          basePriceCents: 60_000,
          minPlayers: 2,
          maxPlayers: 4,
        }),
      ),
    )
  })

  it('carries the descriptive fields through to the payload', async () => {
    // Arrange — these four are the easiest to wire up wrong and never notice,
    // because nothing else in the form depends on them.
    const user = userEvent.setup()
    const { onSave } = renderEditor()

    // Act
    await fillRequired(user)
    await user.type(screen.getByLabelText(/blurb/i), 'Sunset side')
    await user.type(screen.getByLabelText(/tags/i), 'Outdoor\nCovered')
    await user.type(screen.getByLabelText(/included/i), 'Net and posts')
    await user.clear(screen.getByLabelText(/sort order/i))
    await user.type(screen.getByLabelText(/sort order/i), '4')
    await user.click(screen.getByRole('button', { name: /save court/i }))

    // Assert
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          blurb: 'Sunset side',
          tags: ['Outdoor', 'Covered'],
          includes: ['Net and posts'],
          sortOrder: 4,
        }),
      ),
    )
  })

  it('creates rather than patches, sending no id', async () => {
    const user = userEvent.setup()
    const { onSave } = renderEditor()

    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: /save court/i }))

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0][0]).not.toHaveProperty('id')
  })

  it('fills the slug in from the name, so staff do not have to invent one', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.type(screen.getByLabelText(/^court name/i), 'Court 4 Riverside')

    expect(screen.getByLabelText(/url slug/i)).toHaveValue('court-4-riverside')
  })

  it('stops deriving the slug once the staff member edits it themselves', async () => {
    // Arrange
    const user = userEvent.setup()
    renderEditor()

    // Act — a deliberate slug must survive a later change to the name.
    await user.type(screen.getByLabelText(/^court name/i), 'Court 4')
    await user.clear(screen.getByLabelText(/url slug/i))
    await user.type(screen.getByLabelText(/url slug/i), 'riverside')
    await user.type(screen.getByLabelText(/^court name/i), ' Riverside')

    // Assert
    expect(screen.getByLabelText(/url slug/i)).toHaveValue('riverside')
  })

  it('says the image can be added after saving, because there is no row to file it under yet', () => {
    renderEditor()

    expect(screen.queryByLabelText(/hero image/i)).not.toBeInTheDocument()
    expect(screen.getByText(/add.*image.*after.*sav/i)).toBeInTheDocument()
  })
})

describe('CourtEditor — editing a court', () => {
  it('opens with the court’s current details already filled in', () => {
    renderEditor({ court: harbor })

    expect(screen.getByLabelText(/^court name/i)).toHaveValue('Harbor Court')
    expect(screen.getByLabelText(/url slug/i)).toHaveValue('harbor-court')
    expect(screen.getByLabelText(/base price/i)).toHaveValue('600')
  })

  it('patches the court it was opened for, carrying its id', async () => {
    const user = userEvent.setup()
    const { onSave } = renderEditor({ court: harbor })

    await user.clear(screen.getByLabelText(/base price/i))
    await user.type(screen.getByLabelText(/base price/i), '750')
    await user.click(screen.getByRole('button', { name: /save court/i }))

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ id: COURT_ID, basePriceCents: 75_000 }),
      ),
    )
  })

  it('never re-derives the slug from the name, because the old slug is a live URL', async () => {
    // Arrange
    const user = userEvent.setup()
    renderEditor({ court: harbor })

    // Act — renaming an existing court must not silently move its page.
    await user.clear(screen.getByLabelText(/^court name/i))
    await user.type(screen.getByLabelText(/^court name/i), 'Riverside Court')

    // Assert
    expect(screen.getByLabelText(/url slug/i)).toHaveValue('harbor-court')
  })

  it('offers the image uploader, now that there is a row to attach one to', () => {
    renderEditor({ court: harbor })

    expect(screen.getByLabelText(/hero image/i)).toBeInTheDocument()
  })

  it('keeps the uploaded image URL for the save that follows', async () => {
    // Arrange
    const user = userEvent.setup()
    const uploaded = { url: 'https://ik.imagekit.io/test/harbor.png', path: '/x.png' }
    const onUpload = vi.fn().mockResolvedValue({ success: true, data: uploaded })
    const { onSave } = renderEditor({ court: harbor, onUpload })

    // Act
    await user.upload(
      screen.getByLabelText(/hero image/i),
      new File([new Uint8Array(1024)], 'harbor.png', { type: 'image/png' }),
    )
    await waitFor(() => expect(onUpload).toHaveBeenCalled())
    await user.click(screen.getByRole('button', { name: /save court/i }))

    // Assert
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ heroImageUrl: uploaded.url })),
    )
  })
})

describe('CourtEditor — failure paths', () => {
  it('shows a recoverable error when the save action rejects', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockRejectedValue(new Error('connection lost'))
    const { onSaved } = renderEditor({ onSave })

    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: /save court/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not save.*try again/i)
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('shows the reason the server refused the save', async () => {
    // Arrange
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue({
      success: false,
      error: 'Use lowercase letters, numbers, and single hyphens',
    })
    renderEditor({ onSave })

    // Act
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: /save court/i }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(/lowercase letters/i)
  })

  it('does not report success when the save was refused', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue({ success: false, error: 'Nope' })
    const { onSaved } = renderEditor({ onSave })

    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: /save court/i }))

    await screen.findByRole('alert')
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('catches an inverted capacity band before spending a request on it', async () => {
    // Arrange
    const user = userEvent.setup()
    const { onSave } = renderEditor()

    // Act
    await fillRequired(user)
    await user.clear(screen.getByLabelText(/fewest players/i))
    await user.type(screen.getByLabelText(/fewest players/i), '6')
    await user.clear(screen.getByLabelText(/most players/i))
    await user.type(screen.getByLabelText(/most players/i), '4')
    await user.click(screen.getByRole('button', { name: /save court/i }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(/fewer than the fewest/i)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('reports the save as done once it succeeds', async () => {
    const user = userEvent.setup()
    const { onSaved } = renderEditor()

    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: /save court/i }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  })

  it('abandons the edit without saving when cancelled', async () => {
    const user = userEvent.setup()
    const { onSave, onCancel } = renderEditor({ court: harbor })

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
  })
})

describe('CourtEditor — pax pricing', () => {
  it('sends the covered player count and the per-head fee in cents', async () => {
    // Arrange
    const user = userEvent.setup()
    const { onSave } = renderEditor()

    // Act
    await fillRequired(user)
    await user.clear(screen.getByLabelText(/players covered by the price/i))
    await user.type(screen.getByLabelText(/players covered by the price/i), '4')
    await user.clear(screen.getByLabelText(/fee per extra player/i))
    await user.type(screen.getByLabelText(/fee per extra player/i), '150')
    await user.clear(screen.getByLabelText(/most players/i))
    await user.type(screen.getByLabelText(/most players/i), '6')
    await user.click(screen.getByRole('button', { name: /save court/i }))

    // Assert
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ includedPlayers: 4, extraPlayerFeeCents: 15_000 }),
      ),
    )
  })

  it('loads the stored pax pricing when editing an existing court', () => {
    renderEditor({ court: harbor })

    expect(screen.getByLabelText(/players covered by the price/i)).toHaveValue('4')
    expect(screen.getByLabelText(/fee per extra player/i)).toHaveValue('150')
  })

  it('refuses covering more players than the court seats, without a round trip', async () => {
    // Arrange
    const user = userEvent.setup()
    const { onSave } = renderEditor()

    // Act
    await fillRequired(user)
    await user.clear(screen.getByLabelText(/most players/i))
    await user.type(screen.getByLabelText(/most players/i), '4')
    await user.clear(screen.getByLabelText(/players covered by the price/i))
    await user.type(screen.getByLabelText(/players covered by the price/i), '9')
    await user.click(screen.getByRole('button', { name: /save court/i }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(/covered by the price/i)
    expect(onSave).not.toHaveBeenCalled()
  })
})

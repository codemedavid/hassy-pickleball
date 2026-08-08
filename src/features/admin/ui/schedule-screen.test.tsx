import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScheduleScreen } from './schedule-screen'
import { buildScheduleGrid } from '../view/schedule'
import { buildScheduleStats } from '../view/schedule-stats'
import { at, club, DAY, makeBlock, makeBooking, makeCourt } from '../../../../test/admin-fixtures'

const refresh = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

const harbor = makeCourt({ id: 'court-1', name: 'Harbor Court' })
const maple = makeCourt({ id: 'court-2', name: 'Maple Court', environment: 'outdoor' })

const bookings = [
  makeBooking({
    contactName: 'Maya Halvorsen',
    segments: [{ courtId: harbor.id, from: '17:00', to: '18:30' }],
  }),
]

const blocks = [
  makeBlock({
    id: 'block-7',
    courtId: harbor.id,
    kind: 'maintenance',
    reason: 'Net repair',
    from: '09:00',
    to: '10:00',
  }),
]

function renderScreen(overrides: Partial<React.ComponentProps<typeof ScheduleScreen>> = {}) {
  const onBlock = vi.fn().mockResolvedValue({ success: true, data: blocks[0] })
  const onRelease = vi.fn().mockResolvedValue({ success: true, data: { blockId: 'block-7' } })

  const courts = [harbor, maple]

  render(
    <ScheduleScreen
      day={DAY}
      dayLabel="Tue, 04 Aug 2026"
      club={club}
      courts={courts}
      grid={buildScheduleGrid({ club, courts, bookings, blocks, day: DAY })}
      stats={buildScheduleStats({ club, courts, bookings, day: DAY })}
      onBlock={onBlock}
      onRelease={onRelease}
      {...overrides}
    />,
  )

  return { onBlock, onRelease }
}

async function fillBlockForm(times: { readonly from: string; readonly to: string }): Promise<void> {
  const user = userEvent.setup()

  await user.selectOptions(screen.getByLabelText('Court'), 'court-2')
  await user.clear(screen.getByLabelText('From'))
  await user.type(screen.getByLabelText('From'), times.from)
  await user.clear(screen.getByLabelText('To'))
  await user.type(screen.getByLabelText('To'), times.to)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ScheduleScreen', () => {
  it('heads the page with the day being viewed', () => {
    // Act
    renderScreen()

    // Assert
    expect(screen.getByRole('heading', { level: 1, name: 'Court schedule' })).toBeInTheDocument()
    expect(screen.getByText(/Tue, 04 Aug 2026/)).toBeInTheDocument()
  })

  it('shows the four stat cards above the grid', () => {
    // Act
    renderScreen()

    // Assert
    expect(screen.getByText('Utilization')).toBeInTheDocument()
    expect(screen.getByText('Revenue today')).toBeInTheDocument()
  })

  it('gives each court a column headed by its name and rate', () => {
    // Act
    renderScreen()
    const grid = screen.getByRole('table', { name: 'Court schedule' })

    // Assert
    expect(within(grid).getByText('Harbor Court')).toBeInTheDocument()
    expect(within(grid).getByText('Indoor · ₱600/hr')).toBeInTheDocument()
  })

  it('places every booking and block on the grid with its time range', () => {
    // Act
    renderScreen()
    const grid = screen.getByRole('table', { name: 'Court schedule' })

    // Assert
    expect(within(grid).getByText('Maya Halvorsen')).toBeInTheDocument()
    expect(within(grid).getByText('5:00 PM – 6:30 PM')).toBeInTheDocument()
    expect(within(grid).getByText('Net repair')).toBeInTheDocument()
  })

  it('explains what each colour on the grid means', () => {
    // Act
    renderScreen()

    // Assert — the legend is what keeps the tones from being colour-only meaning.
    const legend = screen.getByRole('list', { name: 'Schedule legend' })
    expect(within(legend).getByText('Confirmed')).toBeInTheDocument()
    expect(within(legend).getByText('Maintenance or blocked')).toBeInTheDocument()
  })

  it('says the club is closed rather than drawing an empty grid with no courts', () => {
    // Arrange
    const empty = buildScheduleGrid({ club, courts: [], bookings: [], blocks: [], day: DAY })

    // Act
    renderScreen({
      courts: [],
      grid: empty,
      stats: buildScheduleStats({ club, courts: [], bookings: [], day: DAY }),
    })

    // Assert
    expect(screen.getByText('No active courts to schedule yet.')).toBeInTheDocument()
  })
})

describe('ScheduleScreen availability', () => {
  it('states how much of the day each court still has open', () => {
    // Act
    renderScreen()
    const grid = screen.getByRole('table', { name: 'Court schedule' })

    // Assert — Harbor holds 90 booked and 60 blocked minutes; Maple is untouched.
    expect(within(grid).getByText('12.5 hrs open')).toBeInTheDocument()
    expect(within(grid).getByText('15 hrs open')).toBeInTheDocument()
  })

  it('links to the day before and the day after, so any date can be reached', () => {
    // Act
    renderScreen()

    // Assert
    expect(screen.getByRole('link', { name: /previous day/i })).toHaveAttribute(
      'href',
      '/admin?day=2026-08-03',
    )
    expect(screen.getByRole('link', { name: /next day/i })).toHaveAttribute(
      'href',
      '/admin?day=2026-08-05',
    )
  })

  it('offers a way back to today from another date', () => {
    // Act
    renderScreen()

    // Assert
    expect(screen.getByRole('link', { name: /today/i })).toHaveAttribute('href', '/admin')
  })
})

describe('ScheduleScreen blocking time', () => {
  it('holds the chosen window on the chosen court, in the club’s timezone', async () => {
    // Arrange
    const { onBlock } = renderScreen()

    // Act
    await fillBlockForm({ from: '13:00', to: '15:00' })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Block time' }))

    // Assert
    await waitFor(() => expect(onBlock).toHaveBeenCalledTimes(1))
    expect(onBlock).toHaveBeenCalledWith({
      courtId: 'court-2',
      kind: 'maintenance',
      reason: null,
      startsAt: at('13:00'),
      endsAt: at('15:00'),
    })
  })

  it('sends the reason the staff member typed', async () => {
    // Arrange
    const { onBlock } = renderScreen()
    const user = userEvent.setup()

    // Act
    await fillBlockForm({ from: '13:00', to: '15:00' })
    await user.type(screen.getByLabelText('Reason'), 'Resurfacing')
    await user.click(screen.getByRole('button', { name: 'Block time' }))

    // Assert
    await waitFor(() => expect(onBlock).toHaveBeenCalledTimes(1))
    expect(onBlock.mock.calls[0][0]).toMatchObject({ reason: 'Resurfacing' })
  })

  it('blocks the day being viewed, not today', async () => {
    // Arrange
    const { onBlock } = renderScreen({ day: '2026-08-09', dayLabel: 'Sun, 09 Aug 2026' })

    // Act
    await fillBlockForm({ from: '13:00', to: '15:00' })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Block time' }))

    // Assert
    await waitFor(() => expect(onBlock).toHaveBeenCalledTimes(1))
    expect(onBlock.mock.calls[0][0].startsAt).toEqual(at('13:00', '2026-08-09'))
  })

  it('refuses an inverted window without spending a round trip on it', async () => {
    // Arrange
    const { onBlock } = renderScreen()

    // Act
    await fillBlockForm({ from: '15:00', to: '13:00' })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Block time' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(/end after it starts/i)
    expect(onBlock).not.toHaveBeenCalled()
  })

  it('shows the clash the database reported instead of silently doing nothing', async () => {
    // Arrange
    const onBlock = vi
      .fn()
      .mockResolvedValue({ success: false, error: 'That clashes with a booking', code: 'CONFLICT' })
    renderScreen({ onBlock })

    // Act
    await fillBlockForm({ from: '13:00', to: '15:00' })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Block time' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent('That clashes with a booking')
  })

  it('reloads the schedule once the block is saved, so the grid shows it', async () => {
    // Arrange
    renderScreen()

    // Act
    await fillBlockForm({ from: '13:00', to: '15:00' })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Block time' }))

    // Assert
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  })
})

describe('ScheduleScreen releasing time', () => {
  it('releases a block by its id and reloads the schedule', async () => {
    // Arrange
    const { onRelease } = renderScreen()

    // Act
    await userEvent.setup().click(screen.getByRole('button', { name: /release net repair/i }))

    // Assert
    await waitFor(() => expect(onRelease).toHaveBeenCalledWith({ blockId: 'block-7' }))
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  })

  it('offers no release on a booking — those are cancelled, not released', () => {
    // Act
    renderScreen()

    // Assert
    expect(screen.getAllByRole('button', { name: /release/i })).toHaveLength(1)
  })

  it('reports a failed release rather than leaving the block on the grid unexplained', async () => {
    // Arrange
    const onRelease = vi.fn().mockResolvedValue({ success: false, error: 'Could not release that' })
    renderScreen({ onRelease })

    // Act
    await userEvent.setup().click(screen.getByRole('button', { name: /release net repair/i }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not release that')
  })
})

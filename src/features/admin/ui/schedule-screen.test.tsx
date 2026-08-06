import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScheduleScreen } from './schedule-screen'
import { buildScheduleGrid } from '../view/schedule'
import { buildScheduleStats } from '../view/schedule-stats'
import { club, DAY, makeBlock, makeBooking, makeCourt } from '../../../../test/admin-fixtures'

const harbor = makeCourt({ id: 'court-1', name: 'Harbor Court' })

const bookings = [
  makeBooking({
    contactName: 'Maya Halvorsen',
    segments: [{ courtId: harbor.id, from: '17:00', to: '18:30' }],
  }),
]

const blocks = [
  makeBlock({
    courtId: harbor.id,
    kind: 'maintenance',
    reason: 'Net repair',
    from: '9:00',
    to: '10:00',
  }),
]

function renderScreen() {
  return render(
    <ScheduleScreen
      dayLabel="Tue, 04 Aug 2026"
      grid={buildScheduleGrid({ club, courts: [harbor], bookings, blocks, day: DAY })}
      stats={buildScheduleStats({ club, courts: [harbor], bookings, day: DAY })}
    />,
  )
}

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

    // Assert
    expect(screen.getByText('Harbor Court')).toBeInTheDocument()
    expect(screen.getByText('Indoor · ₱600/hr')).toBeInTheDocument()
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
    render(
      <ScheduleScreen
        dayLabel="Tue, 04 Aug 2026"
        grid={empty}
        stats={buildScheduleStats({ club, courts: [], bookings: [], day: DAY })}
      />,
    )

    // Assert
    expect(screen.getByText('No active courts to schedule yet.')).toBeInTheDocument()
  })
})

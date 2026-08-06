import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ReportsScreen } from './reports-screen'
import { buildReports } from '../view/reports'
import { club, DAY, makeBooking, makeCourt } from '../../../../test/admin-fixtures'

const harbor = makeCourt({ id: 'court-1', name: 'Harbor Court' })
const maple = makeCourt({ id: 'court-2', name: 'Maple Court' })

const report = buildReports({
  club,
  courts: [harbor, maple],
  bookings: [
    makeBooking({
      segments: [{ courtId: harbor.id, from: '10:00', to: '11:00', priceCents: 80_000 }],
      items: [{ name: 'Flat white', unitPriceCents: 15_000, quantity: 1 }],
    }),
  ],
  days: 30,
  day: DAY,
})

describe('ReportsScreen', () => {
  it('heads the page with the range the numbers cover', () => {
    // Act
    render(<ReportsScreen report={report} rangeLabel="Last 30 days" />)

    // Assert
    expect(screen.getByRole('heading', { level: 1, name: 'Reports' })).toBeInTheDocument()
    expect(screen.getByText('Last 30 days')).toBeInTheDocument()
  })

  it('summarises revenue, bookings, and utilization in the stat row', () => {
    // Act
    render(<ReportsScreen report={report} rangeLabel="Last 30 days" />)

    // Assert
    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('₱950')).toBeInTheDocument()
    expect(screen.getByText('Avg utilization')).toBeInTheDocument()
  })

  it('states each hour’s utilization as text, so the bar chart is not the only source', () => {
    // Act
    render(<ReportsScreen report={report} rangeLabel="Last 30 days" />)

    // Assert — a bar height is invisible to a screen reader; the label is not.
    const chart = screen.getByRole('list', { name: 'Utilization by hour' })
    expect(within(chart).getByText('10am')).toBeInTheDocument()
    expect(within(chart).getAllByRole('listitem')).toHaveLength(15)
  })

  it('ranks revenue by court with the amount next to each bar', () => {
    // Act
    render(<ReportsScreen report={report} rangeLabel="Last 30 days" />)
    const panel = screen.getByRole('region', { name: 'Revenue by court' })

    // Assert
    expect(within(panel).getByText('Harbor Court')).toBeInTheDocument()
    expect(within(panel).getByText('₱800')).toBeInTheDocument()
  })

  it('reports the café attach rate as a share of bookings', () => {
    // Act
    render(<ReportsScreen report={report} rangeLabel="Last 30 days" />)

    // Assert
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('of bookings added a café or add-on item')).toBeInTheDocument()
  })
})

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AdminPageHeader, Cell, DataTable, Row, StatCards, TABLE_SHELL } from './primitives'
import {
  expectCellsLabelledByColumn,
  expectExplicitTableRoles,
  expectNoPhoneMinimumWidth,
} from '../../../../test/responsive-table'

const COLUMNS = ['Reference', 'Customer', ''] as const

function renderTable() {
  return render(
    <DataTable label="Bookings" columns={COLUMNS} wideClassName="sm:min-w-[1040px]">
      <Row>
        <Cell label="Reference" mobile="title">
          PB-4821
        </Cell>
        <Cell label="Customer">Ana Cruz</Cell>
        <Cell label="" mobile="actions">
          <button type="button">Edit</button>
        </Cell>
      </Row>
    </DataTable>,
  )
}

describe('DataTable', () => {
  it('renders the columns it was given as a labelled table', () => {
    // Arrange & Act
    renderTable()

    // Assert
    const table = screen.getByRole('table', { name: 'Bookings' })
    expect([...table.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual([
      ...COLUMNS,
    ])
  })

  it('names each cell by its column, for the stacked phone layout', () => {
    // Arrange & Act
    renderTable()

    // Assert — on a phone the header row is off-screen, so the cell carries the
    // column name itself.
    expectCellsLabelledByColumn(screen.getByRole('table', { name: 'Bookings' }))
  })

  it('spells out table roles so the stacked layout stays a table', () => {
    // Arrange & Act
    renderTable()

    // Assert
    expectExplicitTableRoles(screen.getByRole('table', { name: 'Bookings' }))
  })

  it('asks for a minimum width only from the sm breakpoint up', () => {
    // Arrange & Act
    renderTable()

    // Assert — an unconditional min-width is what makes a phone scroll sideways.
    expectNoPhoneMinimumWidth(screen.getByRole('table', { name: 'Bookings' }))
  })

  it('keeps the header available to screen readers when it is visually hidden', () => {
    // Arrange & Act
    renderTable()

    // Assert — sr-only, not hidden: the column names still announce on a phone.
    const head = screen.getByRole('table', { name: 'Bookings' }).querySelector('thead')
    expect(head).not.toHaveAttribute('hidden')
    expect(head?.className).toContain('max-sm:sr-only')
  })
})

/**
 * The stacked layout used to print every column as one more label-and-value
 * line, so a nine-column booking read as nine identical rows of small grey
 * text. A cell now says what part it plays in the card, and the card is a card
 * — separated, padded, and led by the value staff actually scan for.
 */
describe('DataTable cards on a phone', () => {
  it('separates each row into its own card rather than a hairline rule', () => {
    // Arrange & Act
    renderTable()

    // Assert
    const table = screen.getByRole('table', { name: 'Bookings' })
    const body = table.querySelector('tbody')
    const row = table.querySelector('tbody tr')
    expect(body?.className).toContain('max-sm:flex-col')
    expect(body?.className).toContain('max-sm:gap-3')
    expect(row?.className).toContain('max-sm:rounded-2xl')
    expect(row?.className).toContain('max-sm:bg-surface')
  })

  it('lets the leading cell head its card without repeating the column name', () => {
    // Arrange & Act
    renderTable()

    // Assert — the value is the heading, so printing "REFERENCE" above it is noise.
    const cell = screen.getByRole('cell', { name: 'PB-4821' })
    expect(cell).toHaveAttribute('data-mobile', 'title')
    expect(cell.className).not.toContain('before:content')
  })

  it('still names the column on the cells that stay label-and-value pairs', () => {
    // Arrange & Act
    renderTable()

    // Assert
    const cell = screen.getByRole('cell', { name: 'Ana Cruz' })
    expect(cell).toHaveAttribute('data-mobile', 'inline')
    expect(cell.className).toContain('before:content-[attr(data-label)]')
  })

  it('gives the action cell the full width of the card, so buttons are tappable', () => {
    // Arrange & Act
    renderTable()

    // Assert
    const cell = screen.getByRole('button', { name: 'Edit' }).closest('td')
    expect(cell).toHaveAttribute('data-mobile', 'actions')
    expect(cell?.className).toContain('max-sm:basis-full')
  })

  it('drops the table frame on a phone, where the cards carry their own', () => {
    // Assert — a card inside a card is two borders and no hierarchy.
    expect(TABLE_SHELL).toContain('max-sm:border-0')
    expect(TABLE_SHELL).toContain('max-sm:bg-transparent')
  })
})

describe('StatCards', () => {
  const stats = [
    { label: 'Utilization', value: '62%', detail: 'of open court time' },
    { label: 'Revenue', value: '₱12,400', detail: 'booked today' },
  ]

  it('fits two stats to a row on a phone instead of one tall column', () => {
    // Arrange & Act
    const { container } = render(<StatCards stats={stats} />)

    // Assert — four stacked cards push the day's work below the fold.
    expect(container.firstElementChild?.className).toContain('grid-cols-2')
    expect(container.firstElementChild?.className).not.toContain('grid-cols-1')
  })

  it('prints each stat’s label, value, and detail', () => {
    // Arrange & Act
    render(<StatCards stats={stats} />)

    // Assert
    expect(screen.getByText('Utilization')).toBeInTheDocument()
    expect(screen.getByText('62%')).toBeInTheDocument()
    expect(screen.getByText('of open court time')).toBeInTheDocument()
  })
})

describe('AdminPageHeader', () => {
  it('stretches its actions across the card on a phone', () => {
    // Arrange & Act
    render(
      <AdminPageHeader title="Courts" subtitle="What guests can book">
        <button type="button">Add court</button>
      </AdminPageHeader>,
    )

    // Assert — a 90px button in the corner of a 375px screen is a miss waiting
    // to happen.
    const actions = screen.getByRole('button', { name: 'Add court' }).parentElement
    expect(actions?.className).toContain('max-sm:w-full')
  })
})

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Cell, DataTable, Row } from './primitives'
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
        <Cell label="Reference">PB-4821</Cell>
        <Cell label="Customer">Ana Cruz</Cell>
        <Cell label="">
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

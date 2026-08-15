import { expect } from 'vitest'

/**
 * Shared assertions for the admin console's tables, which reflow into stacked
 * cards on a phone. The header row is off-screen there, so a cell that does not
 * name its own column reads as a bare, unattributable value.
 */

/** Every data cell names its column, in the header's order. */
export function expectCellsLabelledByColumn(table: HTMLElement): void {
  const headers = [...table.querySelectorAll('thead th')].map((header) => header.textContent ?? '')
  const rows = [...table.querySelectorAll('tbody tr')]
  let checked = 0

  for (const row of rows) {
    const cells = [...row.querySelectorAll(':scope > td')]

    // Editor rows span the whole table: they carry a form, not column values.
    if (cells.length !== headers.length) continue

    expect(cells.map((cell) => cell.getAttribute('data-label'))).toEqual(headers)
    checked += 1
  }

  expect(checked).toBeGreaterThan(0)
}

/**
 * Table semantics survive the phone layout. The stacked view overrides `display`
 * on the table, which drops the implicit roles in most browsers unless they are
 * spelled out.
 */
export function expectExplicitTableRoles(table: HTMLElement): void {
  expect(table).toHaveAttribute('role', 'table')

  for (const header of table.querySelectorAll('thead th')) {
    expect(header).toHaveAttribute('role', 'columnheader')
  }

  for (const row of table.querySelectorAll('tr')) {
    expect(row).toHaveAttribute('role', 'row')
  }

  for (const cell of table.querySelectorAll('tbody td')) {
    expect(cell).toHaveAttribute('role', 'cell')
  }
}

/**
 * The table may only demand a minimum width from the `sm` breakpoint up. An
 * unconditional `min-w-[...]` is what forces a phone to scroll sideways.
 */
export function expectNoPhoneMinimumWidth(table: HTMLElement): void {
  const widthClasses = [...table.classList].filter((name) => name.includes('min-w-'))

  for (const name of widthClasses) {
    expect(name).toMatch(/^sm:/)
  }
}

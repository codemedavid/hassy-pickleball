import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function reportClubTotalsColumns(migration: string): readonly string[] {
  const sql = readFileSync(resolve(process.cwd(), migration), 'utf8')
  const match = sql.match(
    /(?:create or replace function|create function) report_club_totals[\s\S]*?returns table \(([\s\S]*?)\)\s*language/i,
  )

  if (!match?.[1]) {
    throw new Error(`report_club_totals return contract not found in ${migration}`)
  }

  return match[1]
    .split(',')
    .map((column) => column.trim().split(/\s+/)[0])
    .filter((column): column is string => Boolean(column))
}

describe('database migration contracts', () => {
  it('keeps the report_club_totals row type when replacing the function', () => {
    const original = reportClubTotalsColumns(
      'supabase/migrations/20260102000200_reporting.sql',
    )
    const replacement = reportClubTotalsColumns(
      'supabase/migrations/20260106000000_pax_pricing_and_players.sql',
    )

    expect(replacement).toEqual(original)
  })
})

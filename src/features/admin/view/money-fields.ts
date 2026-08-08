/**
 * Money and whole numbers as a text input carries them.
 *
 * Shared by the court and product editors so the two cannot drift: a price
 * shown as "600" in one form and "600.00" in the other would be the same row
 * rendered two ways.
 */

const CENTS_PER_UNIT = 100

export function toCents(value: string): number {
  return Math.round(Number(value.trim()) * CENTS_PER_UNIT)
}

export function toInteger(value: string): number {
  return Math.round(Number(value.trim()))
}

/** Trailing zeros dropped, so a whole price shows as "600" rather than "600.00". */
export function toMajorUnits(cents: number): string {
  const hasFraction = cents % CENTS_PER_UNIT !== 0
  const units = cents / CENTS_PER_UNIT

  return hasFraction ? units.toFixed(2) : String(units)
}

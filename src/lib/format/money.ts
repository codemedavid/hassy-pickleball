/**
 * Display formatting for the integer-centavo amounts used everywhere else.
 * Kept as pure functions so both Server and Client Components can call them.
 */

const CENTS_PER_UNIT = 100
const MINUTES_PER_HOUR = 60

/**
 * Whole amounts render without decimals — the design shows "₱600", not
 * "₱600.00" — but a price with centavos keeps them rather than rounding away
 * money the customer will actually be charged.
 */
export function formatMoney(cents: number, currency: string): string {
  const hasFraction = cents % CENTS_PER_UNIT !== 0

  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(cents / CENTS_PER_UNIT)
}

/** "1 hr 30 min" — the duration wording used on the slot picker chips. */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR)
  const rest = minutes % MINUTES_PER_HOUR

  const parts = [
    ...(hours > 0 ? [`${hours} ${hours === 1 ? 'hr' : 'hrs'}`] : []),
    ...(rest > 0 ? [`${rest} min`] : []),
  ]

  return parts.length > 0 ? parts.join(' ') : '0 min'
}

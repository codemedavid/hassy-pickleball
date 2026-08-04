/**
 * Club-local rendering of UTC instants.
 *
 * Every timestamp in the system is stored and passed around in UTC; the club's
 * timezone is the only correct lens for showing one to a customer. A viewer in
 * another country must still see the club's 6:00 AM, so none of these helpers
 * fall back to the runtime's local zone.
 */

export function formatTimeInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

export function formatDayInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
    .format(date)
    .replace(/,?\s+/g, ' ')
    .replace(/^(\w{3}) /, '$1, ')
}

/**
 * The club-local calendar day as "YYYY-MM-DD" — the format
 * `enumerateStartTimes` and the availability query both expect.
 */
export function toDayStringInZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const lookup = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? ''

  return `${lookup('year')}-${lookup('month')}-${lookup('day')}`
}

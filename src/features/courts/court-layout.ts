/**
 * The Gallery/Compact toggle above the catalog.
 *
 * Layout is a search param rather than client state for the same reason the
 * filter is: it keeps the catalog a Server Component and makes every view
 * linkable. Both params share one href builder so switching either one never
 * silently drops the other.
 */

export type CourtLayoutId = 'gallery' | 'compact'

export type CourtLayout = {
  readonly id: CourtLayoutId
  readonly label: string
}

const DEFAULT_LAYOUT: CourtLayoutId = 'gallery'
const DEFAULT_FILTER = 'all'

export const COURT_LAYOUTS: readonly CourtLayout[] = [
  { id: 'gallery', label: 'Gallery' },
  { id: 'compact', label: 'Compact' },
]

/** An unrecognised value falls back to the default rather than blanking the grid. */
export function parseCourtLayout(value: string | undefined): CourtLayoutId {
  return COURT_LAYOUTS.some((layout) => layout.id === value)
    ? (value as CourtLayoutId)
    : DEFAULT_LAYOUT
}

export type CatalogHrefInput = {
  readonly filter: string
  readonly layout: CourtLayoutId
}

/**
 * The catalog URL for a filter/layout pair. Defaults are omitted so the
 * canonical catalog stays a bare `/` — one URL, not four that render the same
 * page.
 */
export function buildCatalogHref({ filter, layout }: CatalogHrefInput): string {
  const params = new URLSearchParams()

  if (filter !== DEFAULT_FILTER) {
    params.set('filter', filter)
  }

  if (layout !== DEFAULT_LAYOUT) {
    params.set('layout', layout)
  }

  const query = params.toString()

  return query ? `/?${query}` : '/'
}

import { describe, expect, it } from 'vitest'
import { buildCatalogHref, COURT_LAYOUTS, parseCourtLayout } from './court-layout'

describe('parseCourtLayout', () => {
  it('defaults to the gallery layout when no layout is requested', () => {
    expect(parseCourtLayout(undefined)).toBe('gallery')
  })

  it('falls back to the gallery layout for an unrecognised value', () => {
    expect(parseCourtLayout('mosaic')).toBe('gallery')
  })

  it('honours an explicit compact request', () => {
    expect(parseCourtLayout('compact')).toBe('compact')
  })
})

describe('COURT_LAYOUTS', () => {
  it('offers exactly the two layouts the design draws', () => {
    expect(COURT_LAYOUTS.map((layout) => layout.id)).toEqual(['gallery', 'compact'])
  })

  it('labels each layout for the toggle', () => {
    expect(COURT_LAYOUTS.map((layout) => layout.label)).toEqual(['Gallery', 'Compact'])
  })
})

describe('buildCatalogHref', () => {
  it('is the bare storefront root at the default filter and layout', () => {
    expect(buildCatalogHref({ filter: 'all', layout: 'gallery' })).toBe('/')
  })

  it('carries a non-default filter', () => {
    expect(buildCatalogHref({ filter: 'indoor', layout: 'gallery' })).toBe('/?filter=indoor')
  })

  it('carries a non-default layout', () => {
    expect(buildCatalogHref({ filter: 'all', layout: 'compact' })).toBe('/?layout=compact')
  })

  it('carries both so switching one does not discard the other', () => {
    expect(buildCatalogHref({ filter: 'outdoor', layout: 'compact' })).toBe(
      '/?filter=outdoor&layout=compact',
    )
  })
})

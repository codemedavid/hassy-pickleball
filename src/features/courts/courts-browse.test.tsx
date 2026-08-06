import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CourtsBrowse } from './courts-browse'
import type { Club, Court } from '@/lib/repositories/mappers'

function club(overrides: Partial<Club> = {}): Club {
  return {
    id: 'club-1',
    name: 'Baseline',
    slug: 'baseline',
    timeZone: 'Asia/Manila',
    currency: 'PHP',
    opensAt: '07:00:00',
    closesAt: '22:00:00',
    slotMinutes: 30,
    minDurationMinutes: 60,
    maxDurationMinutes: 180,
    ...overrides,
  }
}

function court(overrides: Partial<Court> = {}): Court {
  return {
    id: 'court-1',
    clubId: 'club-1',
    name: 'Court 1 — Center',
    slug: 'court-1',
    surface: 'Cushioned acrylic',
    environment: 'indoor',
    isTournamentGrade: false,
    blurb: 'Our show court.',
    notes: null,
    tags: [],
    includes: [],
    heroImageUrl: null,
    basePriceCents: 90000,
    sortOrder: 1,
    isActive: true,
    ...overrides,
  }
}

describe('CourtsBrowse', () => {
  it('headlines the catalog with the court count and the club opening hours', () => {
    render(<CourtsBrowse club={club()} courts={[court(), court({ id: 'c2', slug: 'c2' })]} />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      '2 courts. Open 07:00 to 22:00.',
    )
  })

  it('links filter chips at the storefront root so the catalog has one canonical URL', () => {
    render(<CourtsBrowse club={club()} courts={[court()]} />)

    expect(screen.getByRole('link', { name: 'All courts' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Indoor' })).toHaveAttribute('href', '/?filter=indoor')
  })

  it('marks the active filter as the current page for assistive tech', () => {
    render(<CourtsBrowse club={club()} courts={[court()]} filter="indoor" />)

    expect(screen.getByRole('link', { name: 'Indoor' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'All courts' })).not.toHaveAttribute('aria-current')
  })

  it('renders only the courts matching the active filter', () => {
    const courts = [
      court({ id: 'indoor-1', slug: 'indoor-1', name: 'Indoor One', environment: 'indoor' }),
      court({ id: 'outdoor-1', slug: 'outdoor-1', name: 'Outdoor One', environment: 'outdoor' }),
    ]

    render(<CourtsBrowse club={club()} courts={courts} filter="outdoor" />)

    expect(screen.getByRole('heading', { name: 'Outdoor One' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Indoor One' })).not.toBeInTheDocument()
  })

  it('explains an empty result instead of showing a blank grid', () => {
    render(
      <CourtsBrowse club={club()} courts={[court({ environment: 'indoor' })]} filter="outdoor" />,
    )

    expect(screen.getByText('No courts match that filter.')).toBeInTheDocument()
  })

  it('prices courts in the club currency', () => {
    render(<CourtsBrowse club={club({ currency: 'USD' })} courts={[court()]} />)

    expect(screen.getByText(/\$900/)).toBeInTheDocument()
  })
})

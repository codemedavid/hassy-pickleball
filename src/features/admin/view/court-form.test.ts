import { describe, expect, it } from 'vitest'
import { toCourtPayload, toFormState, toSlug, BLANK_COURT_FORM } from './court-form'
import { makeCourt } from '../../../../test/admin-fixtures'

const COURT_ID = '88888888-8888-4888-8888-888888888888'

const harbor = makeCourt({
  id: COURT_ID,
  name: 'Harbor Court',
  slug: 'harbor-court',
  surface: 'Cushioned acrylic',
  environment: 'indoor',
  isTournamentGrade: true,
  blurb: 'The show court',
  notes: ['Non-marking shoes required', 'Bring your own paddle'],
  tags: ['Indoor', 'Tournament'],
  includes: ['Net and posts'],
  heroImageUrl: 'https://ik.imagekit.io/test/harbor.png',
  basePriceCents: 60_000,
  sortOrder: 3,
  minPlayers: 2,
  maxPlayers: 4,
})

describe('toFormState', () => {
  it('fills every field from the court being edited', () => {
    // Act
    const state = toFormState(harbor)

    // Assert
    expect(state.name).toBe('Harbor Court')
    expect(state.slug).toBe('harbor-court')
    expect(state.surface).toBe('Cushioned acrylic')
    expect(state.environment).toBe('indoor')
    expect(state.isTournamentGrade).toBe(true)
    expect(state.blurb).toBe('The show court')
    expect(state.heroImageUrl).toBe('https://ik.imagekit.io/test/harbor.png')
    expect(state.sortOrder).toBe('3')
    expect(state.minPlayers).toBe('2')
    expect(state.maxPlayers).toBe('4')
  })

  it('shows the price in major units, because that is how staff think about it', () => {
    // Arrange — the row stores 60000 centavos.
    // Act & Assert — the field shows 600, not 60000.
    expect(toFormState(harbor).basePrice).toBe('600')
  })

  it('keeps centavos on a price that has them', () => {
    const odd = makeCourt({ id: COURT_ID, basePriceCents: 60_050 })

    expect(toFormState(odd).basePrice).toBe('600.50')
  })

  it('puts each list entry on its own line, so the textarea is editable', () => {
    const state = toFormState(harbor)

    expect(state.notes).toBe('Non-marking shoes required\nBring your own paddle')
    expect(state.tags).toBe('Indoor\nTournament')
    expect(state.includes).toBe('Net and posts')
  })

  it('renders a missing blurb as an empty field rather than the string "null"', () => {
    const bare = makeCourt({ id: COURT_ID, blurb: null })

    expect(toFormState(bare).blurb).toBe('')
  })

  it('starts blank for a court that does not exist yet', () => {
    expect(toFormState(null)).toEqual(BLANK_COURT_FORM)
  })
})

describe('toCourtPayload', () => {
  it('round-trips a court through the form without changing it', () => {
    // Arrange
    const state = toFormState(harbor)

    // Act
    const payload = toCourtPayload(state)

    // Assert — every field comes back as the repository stored it.
    expect(payload).toEqual({
      name: 'Harbor Court',
      slug: 'harbor-court',
      surface: 'Cushioned acrylic',
      environment: 'indoor',
      isTournamentGrade: true,
      blurb: 'The show court',
      notes: ['Non-marking shoes required', 'Bring your own paddle'],
      tags: ['Indoor', 'Tournament'],
      includes: ['Net and posts'],
      heroImageUrl: 'https://ik.imagekit.io/test/harbor.png',
      basePriceCents: 60_000,
      sortOrder: 3,
      minPlayers: 2,
      maxPlayers: 4,
    })
  })

  it('carries the id when editing, so the server patches instead of creating', () => {
    const payload = toCourtPayload(toFormState(harbor), COURT_ID)

    expect(payload).toMatchObject({ id: COURT_ID })
  })

  it('omits the id when creating, so the server inserts', () => {
    const payload = toCourtPayload(BLANK_COURT_FORM)

    expect('id' in payload).toBe(false)
  })

  it('converts the typed price back to centavos', () => {
    const state = { ...BLANK_COURT_FORM, basePrice: '750.25' }

    expect(toCourtPayload(state).basePriceCents).toBe(75_025)
  })

  it('drops blank lines and surrounding spaces from the lists', () => {
    // Arrange — what a staff member actually leaves behind while editing.
    const state = { ...BLANK_COURT_FORM, notes: '  Shoes required  \n\n\n  Paddle provided\n' }

    // Act & Assert
    expect(toCourtPayload(state).notes).toEqual(['Shoes required', 'Paddle provided'])
  })

  it('sends an empty list rather than a list containing nothing', () => {
    const state = { ...BLANK_COURT_FORM, tags: '   \n  \n' }

    expect(toCourtPayload(state).tags).toEqual([])
  })

  it('sends a blank blurb as null, matching the nullable column', () => {
    const state = { ...BLANK_COURT_FORM, blurb: '   ' }

    expect(toCourtPayload(state).blurb).toBeNull()
  })

  it('reports a price that is not a number as NaN, so validation rejects it', () => {
    // Arrange — zod is the gate; the mapper must not silently coerce to zero,
    // which would publish a free court.
    const state = { ...BLANK_COURT_FORM, basePrice: 'six hundred' }

    // Act & Assert
    expect(toCourtPayload(state).basePriceCents).toBeNaN()
  })

  it('rounds a sub-centavo price rather than emitting a fractional centavo', () => {
    const state = { ...BLANK_COURT_FORM, basePrice: '600.005' }

    expect(Number.isInteger(toCourtPayload(state).basePriceCents)).toBe(true)
  })
})

describe('toSlug', () => {
  it('turns a court name into a URL-safe slug', () => {
    expect(toSlug('Harbor Court 2')).toBe('harbor-court-2')
  })

  it('collapses punctuation and runs of spaces into single hyphens', () => {
    expect(toSlug('Court 4 — Riverside!!  Pro')).toBe('court-4-riverside-pro')
  })

  it('does not leave a leading or trailing hyphen, which the slug pattern rejects', () => {
    expect(toSlug('  —Riverside—  ')).toBe('riverside')
  })
})

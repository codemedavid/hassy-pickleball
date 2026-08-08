import type { Court } from '@/lib/repositories/mappers'
import type { CourtEnvironment } from '@/lib/repositories/rows'

/**
 * The court editor's form state, and its translation to and from a court row.
 *
 * Every field is held as the string the input actually carries, because that is
 * what a text input has: a half-typed price is "6", not a number, and forcing it
 * through `number` mid-edit fights the staff member's cursor. Conversion happens
 * once, on submit.
 *
 * Kept out of the component so the mapping is testable without a DOM, matching
 * the other modules under ../view.
 */

const CENTS_PER_UNIT = 100

export type CourtFormState = {
  readonly name: string
  readonly slug: string
  readonly surface: string
  readonly environment: CourtEnvironment
  readonly isTournamentGrade: boolean
  readonly blurb: string
  /** One entry per line — a textarea is the honest control for a short list. */
  readonly notes: string
  readonly tags: string
  readonly includes: string
  readonly heroImageUrl: string | null
  /** Major units, as shown to staff. ₱600, not 60000. */
  readonly basePrice: string
  readonly sortOrder: string
  readonly minPlayers: string
  readonly maxPlayers: string
  /** How many players the slot price covers before the per-head fee starts. */
  readonly includedPlayers: string
  /** Major units, like basePrice. ₱150 per extra head, not 15000. */
  readonly extraPlayerFee: string
}

/** A doubles court is the common case, so a new court starts there. */
export const BLANK_COURT_FORM: CourtFormState = {
  name: '',
  slug: '',
  surface: '',
  environment: 'indoor',
  isTournamentGrade: false,
  blurb: '',
  notes: '',
  tags: '',
  includes: '',
  heroImageUrl: null,
  basePrice: '',
  sortOrder: '0',
  minPlayers: '2',
  maxPlayers: '4',
  includedPlayers: '4',
  extraPlayerFee: '0',
}

export function toFormState(court: Court | null): CourtFormState {
  if (!court) {
    return BLANK_COURT_FORM
  }

  return {
    name: court.name,
    slug: court.slug,
    surface: court.surface,
    environment: court.environment,
    isTournamentGrade: court.isTournamentGrade,
    blurb: court.blurb ?? '',
    notes: court.notes.join('\n'),
    tags: court.tags.join('\n'),
    includes: court.includes.join('\n'),
    heroImageUrl: court.heroImageUrl,
    basePrice: toMajorUnits(court.basePriceCents),
    sortOrder: String(court.sortOrder),
    minPlayers: String(court.minPlayers),
    maxPlayers: String(court.maxPlayers),
    includedPlayers: String(court.includedPlayers),
    extraPlayerFee: toMajorUnits(court.extraPlayerFeeCents),
  }
}

export type CourtPayload = {
  readonly id?: string
  readonly name: string
  readonly slug: string
  readonly surface: string
  readonly environment: CourtEnvironment
  readonly isTournamentGrade: boolean
  readonly blurb: string | null
  readonly notes: readonly string[]
  readonly tags: readonly string[]
  readonly includes: readonly string[]
  readonly heroImageUrl: string | null
  readonly basePriceCents: number
  readonly sortOrder: number
  readonly minPlayers: number
  readonly maxPlayers: number
  readonly includedPlayers: number
  readonly extraPlayerFeeCents: number
}

/**
 * Form state as the save action expects it.
 *
 * `courtId` decides create versus patch, matching saveCourt, which keys off the
 * presence of an id. Numbers are left as NaN when unparseable rather than
 * defaulted to zero — a price that failed to parse must be refused by the
 * schema, not quietly published as a free court.
 */
export function toCourtPayload(state: CourtFormState, courtId?: string): CourtPayload {
  const fields = {
    name: state.name.trim(),
    slug: state.slug.trim(),
    surface: state.surface.trim(),
    environment: state.environment,
    isTournamentGrade: state.isTournamentGrade,
    blurb: state.blurb.trim() || null,
    notes: toList(state.notes),
    tags: toList(state.tags),
    includes: toList(state.includes),
    heroImageUrl: state.heroImageUrl,
    basePriceCents: toCents(state.basePrice),
    sortOrder: toInteger(state.sortOrder),
    minPlayers: toInteger(state.minPlayers),
    maxPlayers: toInteger(state.maxPlayers),
    includedPlayers: toInteger(state.includedPlayers),
    extraPlayerFeeCents: toCents(state.extraPlayerFee),
  }

  return courtId === undefined ? fields : { id: courtId, ...fields }
}

/** Lines, minus the blanks and stray spacing an edit session leaves behind. */
function toList(value: string): string[] {
  return value
    .split('\n')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

function toCents(value: string): number {
  return Math.round(Number(value.trim()) * CENTS_PER_UNIT)
}

function toInteger(value: string): number {
  return Math.round(Number(value.trim()))
}

/** Trailing zeros dropped, so a whole price shows as "600" rather than "600.00". */
function toMajorUnits(cents: number): string {
  const hasFraction = cents % CENTS_PER_UNIT !== 0
  const units = cents / CENTS_PER_UNIT

  return hasFraction ? units.toFixed(2) : String(units)
}

/**
 * A court name as a slug.
 *
 * Only ever a starting point the staff member can overwrite: the slug is the
 * court's public URL, so it is a deliberate choice, not a derived value.
 */
export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

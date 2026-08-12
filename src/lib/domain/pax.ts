/**
 * Player capacity ("pax") and what it costs.
 *
 * A court is still sold by the slot, but the slot price only covers so many
 * heads. Beyond `includedPlayers` the club charges per extra player, up to the
 * `maxPlayers` the court physically seats.
 *
 * This is the single source of truth for that arithmetic. The checkout screen
 * uses it to show a guest what they are about to pay, and the server uses it to
 * quote what they actually pay — sharing the module is what stops the two from
 * drifting apart.
 */

export type CourtCapacity = {
  readonly minPlayers: number
  /** How many players the slot price already covers. */
  readonly includedPlayers: number
  readonly maxPlayers: number
  /** Charged per head beyond `includedPlayers`. */
  readonly extraPlayerFeeCents: number
}

export type CapacityBand = CourtCapacity

/**
 * The seating terms for a booking, across every court it covers.
 *
 * A booking spanning two courts seats as many as the roomier one and needs at
 * least as many as the emptier one asks for — the same widest-band rule
 * `create_booking` applies. Where the courts disagree on price, the guest gets
 * the better of the two: booking a second court must never cost more per head
 * than booking the first alone.
 */
export function capacityBand(courts: readonly CourtCapacity[]): CapacityBand {
  const [first] = courts

  if (!first) {
    throw new Error('a capacity band needs at least one court')
  }

  return courts.reduce<CapacityBand>(
    (band, court) => ({
      minPlayers: Math.min(band.minPlayers, court.minPlayers),
      maxPlayers: Math.max(band.maxPlayers, court.maxPlayers),
      includedPlayers: Math.max(band.includedPlayers, court.includedPlayers),
      extraPlayerFeeCents: Math.min(band.extraPlayerFeeCents, court.extraPlayerFeeCents),
    }),
    first,
  )
}

/** What the heads beyond the included count add to the booking. */
export function extraPlayerFeeCents(partySize: number, band: CapacityBand): number {
  const extraPlayers = Math.max(0, partySize - band.includedPlayers)

  return extraPlayers * band.extraPlayerFeeCents
}

/**
 * Whether a party may be booked onto these courts at all.
 *
 * Mirrors the `check_violation` `create_booking` raises, so the guest is told
 * before they submit rather than after the transaction rolls back.
 */
export function isPartySizeAllowed(partySize: number, band: CapacityBand): boolean {
  return Number.isInteger(partySize) && partySize >= band.minPlayers && partySize <= band.maxPlayers
}

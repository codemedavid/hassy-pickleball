import { describe, expect, it } from 'vitest'
import { capacityBand, extraPlayerFeeCents, isPartySizeAllowed, type CourtCapacity } from './pax'

const DOUBLES: CourtCapacity = {
  minPlayers: 2,
  includedPlayers: 4,
  maxPlayers: 6,
  extraPlayerFeeCents: 15_000,
}

const COACHING: CourtCapacity = {
  minPlayers: 1,
  includedPlayers: 2,
  maxPlayers: 8,
  extraPlayerFeeCents: 20_000,
}

describe('capacityBand', () => {
  it('returns the court unchanged when only one is booked', () => {
    // Arrange / Act
    const band = capacityBand([DOUBLES])

    // Assert
    expect(band).toEqual({
      minPlayers: 2,
      includedPlayers: 4,
      maxPlayers: 6,
      extraPlayerFeeCents: 15_000,
    })
  })

  it('spans the widest seating across every court booked', () => {
    const band = capacityBand([DOUBLES, COACHING])

    expect(band.minPlayers).toBe(1)
    expect(band.maxPlayers).toBe(8)
  })

  it('resolves differing terms in the guest favour', () => {
    // The roomier included count and the cheaper per-head fee both win, so a
    // guest is never charged more for booking two courts than for one.
    const band = capacityBand([DOUBLES, COACHING])

    expect(band.includedPlayers).toBe(4)
    expect(band.extraPlayerFeeCents).toBe(15_000)
  })

  it('refuses to describe a band for no courts at all', () => {
    expect(() => capacityBand([])).toThrow('at least one court')
  })
})

describe('extraPlayerFeeCents', () => {
  it('charges nothing when the party fits the included count', () => {
    expect(extraPlayerFeeCents(4, capacityBand([DOUBLES]))).toBe(0)
  })

  it('charges nothing for a party smaller than the included count', () => {
    expect(extraPlayerFeeCents(2, capacityBand([DOUBLES]))).toBe(0)
  })

  it('charges the fee for every head beyond the included count', () => {
    expect(extraPlayerFeeCents(6, capacityBand([DOUBLES]))).toBe(30_000)
  })

  it('charges nothing when the court has no extra-player fee', () => {
    const free = { ...DOUBLES, extraPlayerFeeCents: 0 }

    expect(extraPlayerFeeCents(6, capacityBand([free]))).toBe(0)
  })
})

describe('isPartySizeAllowed', () => {
  it('accepts a party inside the band', () => {
    expect(isPartySizeAllowed(4, capacityBand([DOUBLES]))).toBe(true)
  })

  it('accepts the boundaries themselves', () => {
    const band = capacityBand([DOUBLES])

    expect(isPartySizeAllowed(2, band)).toBe(true)
    expect(isPartySizeAllowed(6, band)).toBe(true)
  })

  it('rejects a party smaller than the court seats', () => {
    expect(isPartySizeAllowed(1, capacityBand([DOUBLES]))).toBe(false)
  })

  it('rejects a party larger than the court seats', () => {
    expect(isPartySizeAllowed(7, capacityBand([DOUBLES]))).toBe(false)
  })

  it('rejects a fractional party size', () => {
    expect(isPartySizeAllowed(3.5, capacityBand([DOUBLES]))).toBe(false)
  })
})

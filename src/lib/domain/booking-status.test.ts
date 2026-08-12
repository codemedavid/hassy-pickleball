import { describe, expect, it } from 'vitest'
import { canTransition, nextStatuses } from './booking-status'

/**
 * One transition table, shared. The console offers exactly the buttons the
 * server would accept, so a staff member never clicks something that comes
 * back refused.
 */

describe('nextStatuses', () => {
  it('lets a fresh booking be taken to payment, confirmed, or cancelled', () => {
    expect(nextStatuses('pending')).toEqual(['awaiting_payment', 'confirmed', 'cancelled'])
  })

  it('lets one awaiting payment be confirmed or cancelled', () => {
    expect(nextStatuses('awaiting_payment')).toEqual(['confirmed', 'cancelled'])
  })

  it('lets a confirmed booking be completed or cancelled', () => {
    expect(nextStatuses('confirmed')).toEqual(['completed', 'cancelled'])
  })

  it('offers nothing from a cancelled booking, whose slot may have been resold', () => {
    expect(nextStatuses('cancelled')).toEqual([])
  })

  it('offers nothing from a completed booking', () => {
    expect(nextStatuses('completed')).toEqual([])
  })
})

describe('canTransition', () => {
  it('agrees with the table it is built from', () => {
    expect(canTransition('awaiting_payment', 'confirmed')).toBe(true)
    expect(canTransition('pending', 'completed')).toBe(false)
    expect(canTransition('cancelled', 'confirmed')).toBe(false)
  })

  it('refuses a move to the status the booking already holds', () => {
    expect(canTransition('confirmed', 'confirmed')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { err, isOk, ok } from './result'

describe('ok', () => {
  it('wraps a value as a success result', () => {
    expect(ok({ id: '1' })).toEqual({ success: true, data: { id: '1' } })
  })
})

describe('err', () => {
  it('wraps a message as a failure result', () => {
    expect(err('Court unavailable')).toEqual({ success: false, error: 'Court unavailable' })
  })

  it('omits the code key entirely when no code is given', () => {
    expect('code' in err('boom')).toBe(false)
  })

  it('carries a machine-readable code when given one', () => {
    expect(err('Court unavailable', 'SLOT_TAKEN')).toEqual({
      success: false,
      error: 'Court unavailable',
      code: 'SLOT_TAKEN',
    })
  })
})

describe('isOk', () => {
  it('narrows a success result', () => {
    const result = ok(42)

    expect(isOk(result)).toBe(true)
  })

  it('rejects a failure result', () => {
    expect(isOk(err('nope'))).toBe(false)
  })
})

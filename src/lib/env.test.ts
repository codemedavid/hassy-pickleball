import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readPublicEnv, readServerEnv } from './env'

const ORIGINAL_ENV = process.env

const VALID = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, ...VALID }
})

afterEach(() => {
  process.env = ORIGINAL_ENV
})

describe('readPublicEnv', () => {
  it('returns the parsed public values', () => {
    expect(readPublicEnv()).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: VALID.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: VALID.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    })
  })

  it('does not expose the service-role key', () => {
    expect(readPublicEnv()).not.toHaveProperty('SUPABASE_SERVICE_ROLE_KEY')
  })

  it('throws when the URL is missing rather than returning undefined', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL

    expect(() => readPublicEnv()).toThrow(/invalid public environment/i)
  })

  it('throws when the URL is not a URL', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'localhost:54321'

    expect(() => readPublicEnv()).toThrow(/invalid public environment/i)
  })

  it('names the offending variable in the error', () => {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ''

    expect(() => readPublicEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/)
  })
})

describe('readServerEnv', () => {
  it('returns the public values plus the service-role key', () => {
    expect(readServerEnv()).toEqual(VALID)
  })

  it('throws when the service-role key is missing', () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    expect(() => readServerEnv()).toThrow(/invalid server environment/i)
  })

  it('names the offending variable in the error', () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    expect(() => readServerEnv()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/)
  })
})

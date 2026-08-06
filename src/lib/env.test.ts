import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readPublicEnv, readServerEnv } from './env'

const ORIGINAL_ENV = process.env

const VALID = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT: 'https://ik.imagekit.io/testendpoint',
  IMAGEKIT_PRIVATE_KEY: 'private-key',
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
      NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT: VALID.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT,
    })
  })

  it('does not expose the service-role key', () => {
    expect(readPublicEnv()).not.toHaveProperty('SUPABASE_SERVICE_ROLE_KEY')
  })

  it('does not expose the ImageKit private key', () => {
    expect(readPublicEnv()).not.toHaveProperty('IMAGEKIT_PRIVATE_KEY')
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

/**
 * ImageKit holds both the catalog images and the payment proofs, so a
 * deployment missing its keys cannot take a booking that requires a
 * screenshot. Better to refuse to boot than to discover it at checkout.
 */
describe('ImageKit configuration', () => {
  it('throws when the private key is missing', () => {
    delete process.env.IMAGEKIT_PRIVATE_KEY

    expect(() => readServerEnv()).toThrow(/IMAGEKIT_PRIVATE_KEY/)
  })

  it('throws when the URL endpoint is missing', () => {
    delete process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT

    expect(() => readServerEnv()).toThrow(/NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT/)
  })

  it('rejects a URL endpoint that is not an http(s) URL', () => {
    process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT = 'ik.imagekit.io/testendpoint'

    expect(() => readPublicEnv()).toThrow(/NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT/)
  })
})

/**
 * Supabase's newer key naming. A project created today issues
 * `sb_publishable_…` / `sb_secret_…` keys under PUBLISHABLE/SECRET names, while
 * older projects issue JWT anon/service-role keys. Both must work, or the app
 * refuses to start against whichever project it is pointed at.
 */
describe('new-style Supabase key names', () => {
  it('accepts a publishable key in place of an anon key', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_abc'

    expect(readPublicEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('sb_publishable_abc')
  })

  it('accepts a secret key in place of a service-role key', () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    process.env.SUPABASE_SECRET_KEY = 'sb_secret_abc'

    expect(readServerEnv().SUPABASE_SERVICE_ROLE_KEY).toBe('sb_secret_abc')
  })

  it('prefers the explicit anon key when a project sets both', () => {
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_abc'

    expect(readPublicEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('anon-key')
  })

  it('still throws when neither name is set, naming what is missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

    expect(() => readPublicEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/)
  })
})

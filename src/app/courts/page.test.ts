import { describe, expect, it, vi } from 'vitest'

const permanentRedirect = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({ permanentRedirect }))

const { default: LegacyCourtsPage } = await import('./page')

describe('legacy /courts catalog route', () => {
  it('permanently redirects to the storefront root', async () => {
    await LegacyCourtsPage({ searchParams: Promise.resolve({}) })

    expect(permanentRedirect).toHaveBeenCalledWith('/')
  })

  it('carries an active filter across the redirect so old links keep working', async () => {
    await LegacyCourtsPage({ searchParams: Promise.resolve({ filter: 'indoor' }) })

    expect(permanentRedirect).toHaveBeenCalledWith('/?filter=indoor')
  })
})

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The checkout route's two branches.
 *
 * Worth testing at the page level because the interesting logic here is not
 * rendering — it is what the server decides to hand the browser. A club with no
 * published payment method must not get a form it cannot submit, and a club with
 * one must not have its settlement channel leak into the client bundle.
 */

const findClubBySlug = vi.fn()
const listActivePaymentMethods = vi.fn()
const notFound = vi.hoisted(() => vi.fn())

/** Captures the props the client island is handed, without rendering it. */
const experienceProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }))

vi.mock('next/navigation', () => ({ notFound }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: () => ({}) }))
vi.mock('@/lib/repositories/clubs', () => ({ findClubBySlug }))
vi.mock('@/lib/repositories/payment-methods', () => ({ listActivePaymentMethods }))
vi.mock('@/features/checkout/actions', () => ({ submitCheckoutAction: vi.fn() }))
vi.mock('@/features/checkout/ui/checkout-experience', () => ({
  CheckoutExperience: (props: Record<string, unknown>) => {
    experienceProps.current = props

    return <div data-testid="checkout-experience" />
  },
}))

const { default: CheckoutPage } = await import('./page')

const CLUB = { id: 'club-1', slug: 'baseline', currency: 'PHP' }

const GCASH = {
  id: 'method-1',
  clubId: 'club-1',
  method: 'gcash' as const,
  label: 'GCash',
  accountName: 'Baseline Pickleball Club',
  accountNumber: '0917 123 4567',
  instructions: 'Send the exact total.',
  qrImageUrl: null,
  requiresProof: true,
  sortOrder: 1,
  isActive: true,
}

async function renderPage() {
  render(await CheckoutPage())
}

beforeEach(() => {
  vi.clearAllMocks()
  experienceProps.current = null
  findClubBySlug.mockResolvedValue(CLUB)
  listActivePaymentMethods.mockResolvedValue([GCASH])
})

describe('checkout page', () => {
  it('renders the checkout form when the club has published a way to pay', async () => {
    await renderPage()

    expect(screen.getByTestId('checkout-experience')).toBeInTheDocument()
  })

  it('says booking is paused rather than showing a form nobody could submit', async () => {
    listActivePaymentMethods.mockResolvedValue([])

    await renderPage()

    expect(screen.getByText(/online booking is paused/i)).toBeInTheDocument()
    expect(screen.queryByTestId('checkout-experience')).not.toBeInTheDocument()
  })

  it('keeps the settlement channel and the club id off the client', async () => {
    await renderPage()

    const [method] = experienceProps.current?.paymentMethods as Record<string, unknown>[]

    // The browser names a method by id; the server resolves what it settles as.
    expect(method).not.toHaveProperty('method')
    expect(method).not.toHaveProperty('clubId')
    expect(method).toMatchObject({ id: 'method-1', label: 'GCash', requiresProof: true })
  })

  it('passes the account details a guest has to read to pay', async () => {
    await renderPage()

    const [method] = experienceProps.current?.paymentMethods as Record<string, unknown>[]

    expect(method).toMatchObject({
      accountName: 'Baseline Pickleball Club',
      accountNumber: '0917 123 4567',
      instructions: 'Send the exact total.',
    })
  })

  it('prices the order in the club currency', async () => {
    await renderPage()

    expect(experienceProps.current).toMatchObject({ currency: 'PHP', clubId: 'club-1' })
  })

  it('404s when the club does not exist, rather than rendering an empty checkout', async () => {
    findClubBySlug.mockResolvedValue(null)
    // notFound() never returns in Next; the mock does, so the page runs on.
    notFound.mockImplementation(() => {
      throw new Error('NEXT_NOT_FOUND')
    })

    await expect(renderPage()).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })
})

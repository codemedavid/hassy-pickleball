import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LoadingScreen, Skeleton } from './skeleton'

describe('Skeleton', () => {
  it('is hidden from assistive tech, so a screen reader hears one loading message rather than a wall of empty boxes', () => {
    const { container } = render(<Skeleton />)

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('takes its size from the caller, so one primitive covers headings, cards, and rows', () => {
    const { container } = render(<Skeleton className="h-10 w-20" />)

    expect(container.firstElementChild).toHaveClass('h-10', 'w-20')
  })
})

describe('LoadingScreen', () => {
  it('names what is loading, so the wait is announced rather than silent', () => {
    render(
      <LoadingScreen label="Loading courts">
        <Skeleton />
      </LoadingScreen>,
    )

    expect(screen.getByRole('status', { name: 'Loading courts' })).toBeInTheDocument()
  })

  it('marks the region busy while placeholders stand in for real content', () => {
    render(
      <LoadingScreen label="Loading courts">
        <Skeleton />
      </LoadingScreen>,
    )

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })

  it('renders the placeholders it was given', () => {
    const { container } = render(
      <LoadingScreen label="Loading courts">
        <Skeleton className="marker" />
      </LoadingScreen>,
    )

    expect(container.querySelector('.marker')).toBeInTheDocument()
  })
})

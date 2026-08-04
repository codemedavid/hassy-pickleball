import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './button'

describe('Button', () => {
  it('renders its label', () => {
    render(<Button>Add to cart</Button>)

    expect(screen.getByRole('button', { name: 'Add to cart' })).toBeInTheDocument()
  })

  it('calls onClick when pressed', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Book</Button>)

    await userEvent.click(screen.getByRole('button'))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not fire onClick while disabled', async () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Book
      </Button>,
    )

    await userEvent.click(screen.getByRole('button'))

    expect(onClick).not.toHaveBeenCalled()
  })

  /**
   * A double-submitted checkout is a double booking. The pending state must
   * disable the control, not merely restyle it.
   */
  it('is disabled while pending, so a slow checkout cannot be submitted twice', async () => {
    const onClick = vi.fn()
    render(
      <Button isPending onClick={onClick}>
        Place order
      </Button>,
    )

    const button = screen.getByRole('button')

    expect(button).toBeDisabled()
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('announces the pending state to assistive technology', () => {
    render(<Button isPending>Place order</Button>)

    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true')
  })

  it('defaults to type="button" so it cannot accidentally submit a form', () => {
    render(<Button>Filter</Button>)

    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('still allows an explicit submit button', () => {
    render(<Button type="submit">Save</Button>)

    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
  })
})

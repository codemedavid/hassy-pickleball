import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuantityStepper } from './quantity-stepper'

describe('QuantityStepper', () => {
  it('shows the current quantity', () => {
    render(<QuantityStepper label="Paddle rental" quantity={2} onChange={vi.fn()} />)

    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('increments by one', async () => {
    const onChange = vi.fn()
    render(<QuantityStepper label="Paddle rental" quantity={2} onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: /increase/i }))

    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('decrements by one', async () => {
    const onChange = vi.fn()
    render(<QuantityStepper label="Paddle rental" quantity={2} onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: /decrease/i }))

    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('cannot go below zero, which would price a negative line', async () => {
    const onChange = vi.fn()
    render(<QuantityStepper label="Paddle rental" quantity={0} onChange={onChange} />)

    const decrease = screen.getByRole('button', { name: /decrease/i })

    expect(decrease).toBeDisabled()
    await userEvent.click(decrease)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('stops at the maximum quantity the schema accepts', async () => {
    const onChange = vi.fn()
    render(<QuantityStepper label="Paddle rental" quantity={99} onChange={onChange} max={99} />)

    const increase = screen.getByRole('button', { name: /increase/i })

    expect(increase).toBeDisabled()
    await userEvent.click(increase)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('names the product in each control, so the buttons are distinguishable', () => {
    render(<QuantityStepper label="Paddle rental" quantity={1} onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Increase Paddle rental' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Decrease Paddle rental' })).toBeInTheDocument()
  })
})

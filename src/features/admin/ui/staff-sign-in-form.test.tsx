import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StaffSignInForm } from './staff-sign-in-form'
import { ok, err } from '@/lib/api/result'

describe('StaffSignInForm', () => {
  it('asks for an email address with a real label', async () => {
    // Act
    render(<StaffSignInForm onSubmit={vi.fn()} />)

    // Assert
    expect(screen.getByLabelText('Work email')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send sign-in link' })).toBeInTheDocument()
  })

  it('sends the address to the action when submitted', async () => {
    // Arrange
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(ok({ sent: true as const }))
    render(<StaffSignInForm onSubmit={onSubmit} />)

    // Act
    await user.type(screen.getByLabelText('Work email'), 'priya@club.example')
    await user.click(screen.getByRole('button', { name: 'Send sign-in link' }))

    // Assert
    expect(onSubmit).toHaveBeenCalledWith({ email: 'priya@club.example' })
  })

  it('confirms the link was sent without saying whether the address is staff', async () => {
    // Arrange — confirming an address exists would let anyone enumerate staff.
    const user = userEvent.setup()
    render(<StaffSignInForm onSubmit={vi.fn().mockResolvedValue(ok({ sent: true as const }))} />)

    // Act
    await user.type(screen.getByLabelText('Work email'), 'priya@club.example')
    await user.click(screen.getByRole('button', { name: 'Send sign-in link' }))

    // Assert
    expect(
      await screen.findByText(
        'If that address belongs to a staff member, a sign-in link is on its way.',
      ),
    ).toBeInTheDocument()
  })

  it('surfaces the failure instead of silently doing nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    const onSubmit = vi
      .fn()
      .mockResolvedValue(err('We could not send that link right now', 'AUTH_ERROR'))
    render(<StaffSignInForm onSubmit={onSubmit} />)

    // Act
    await user.type(screen.getByLabelText('Work email'), 'priya@club.example')
    await user.click(screen.getByRole('button', { name: 'Send sign-in link' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not send that link right now',
    )
  })
})

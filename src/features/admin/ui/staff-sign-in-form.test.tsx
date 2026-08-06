import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StaffSignInForm } from './staff-sign-in-form'
import { err } from '@/lib/api/result'

const CREDENTIALS = { email: 'priya@club.example', password: 'correct-horse' }

describe('StaffSignInForm', () => {
  it('asks for an email and a password with real labels', async () => {
    // Act
    render(<StaffSignInForm onSubmit={vi.fn()} />)

    // Assert
    expect(screen.getByLabelText('Work email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('masks the password as it is typed', async () => {
    // Act
    render(<StaffSignInForm onSubmit={vi.fn()} />)

    // Assert
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
  })

  it('sends both credentials to the action when submitted', async () => {
    // Arrange
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<StaffSignInForm onSubmit={onSubmit} />)

    // Act
    await user.type(screen.getByLabelText('Work email'), CREDENTIALS.email)
    await user.type(screen.getByLabelText('Password'), CREDENTIALS.password)
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    // Assert
    expect(onSubmit).toHaveBeenCalledWith(CREDENTIALS)
  })

  it('surfaces the failure instead of silently doing nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(err('Email or password is incorrect', 'AUTH_ERROR'))
    render(<StaffSignInForm onSubmit={onSubmit} />)

    // Act
    await user.type(screen.getByLabelText('Work email'), CREDENTIALS.email)
    await user.type(screen.getByLabelText('Password'), CREDENTIALS.password)
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect')
  })
})

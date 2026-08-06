'use client'

import { useState } from 'react'
import type { Err } from '@/lib/api/result'

/**
 * Staff sign-in with an email address and password.
 *
 * The error copy is deliberately non-committal: saying "no such account" only
 * for unknown addresses would turn this form into a staff directory. The action
 * is passed in rather than imported so the component stays testable without a
 * Supabase session.
 *
 * A successful sign-in redirects server-side, so there is no success state.
 */

export interface StaffSignInCredentials {
  readonly email: string
  readonly password: string
}

export interface StaffSignInFormProps {
  readonly onSubmit: (credentials: StaffSignInCredentials) => Promise<Err | void>
}

type FormState =
  | { readonly status: 'idle' | 'signing-in' }
  | { readonly status: 'error'; readonly message: string }

const FIELD_CLASS = 'rounded-[9px] border border-line-strong bg-surface px-3.5 py-2.5 text-[14px]'
const LABEL_CLASS = 'text-[13px] font-bold text-muted'

export function StaffSignInForm({ onSubmit }: StaffSignInFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [state, setState] = useState<FormState>({ status: 'idle' })

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState({ status: 'signing-in' })

    // Only a failure comes back — success redirects out of this component.
    const failure = await onSubmit({ email, password })

    setState(failure ? { status: 'error', message: failure.error } : { status: 'idle' })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label htmlFor="staff-email" className={LABEL_CLASS}>
        Work email
      </label>
      <input
        id="staff-email"
        name="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className={FIELD_CLASS}
      />

      <label htmlFor="staff-password" className={LABEL_CLASS}>
        Password
      </label>
      <input
        id="staff-password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className={FIELD_CLASS}
      />

      <button
        type="submit"
        disabled={state.status === 'signing-in'}
        className="rounded-[9px] bg-navy px-4 py-3 text-[14px] font-bold text-white disabled:opacity-60"
      >
        {state.status === 'signing-in' ? 'Signing in…' : 'Sign in'}
      </button>

      {state.status === 'error' ? (
        <p role="alert" className="m-0 text-[13.5px] font-semibold text-danger">
          {state.message}
        </p>
      ) : null}
    </form>
  )
}

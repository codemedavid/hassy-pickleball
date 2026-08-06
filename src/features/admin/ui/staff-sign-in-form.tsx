'use client'

import { useState } from 'react'
import type { Result } from '@/lib/api/result'

/**
 * Staff sign-in by magic link.
 *
 * The confirmation is deliberately non-committal: saying "we sent it" only for
 * real staff addresses would turn this form into a staff directory. The action
 * is passed in rather than imported so the component stays testable without a
 * Supabase session.
 */

const SENT_MESSAGE = 'If that address belongs to a staff member, a sign-in link is on its way.'

export interface StaffSignInFormProps {
  readonly onSubmit: (input: { readonly email: string }) => Promise<Result<{ sent: true }>>
}

type FormState =
  | { readonly status: 'idle' | 'sending' | 'sent' }
  | { readonly status: 'error'; readonly message: string }

export function StaffSignInForm({ onSubmit }: StaffSignInFormProps) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<FormState>({ status: 'idle' })

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState({ status: 'sending' })

    const result = await onSubmit({ email })

    setState(result.success ? { status: 'sent' } : { status: 'error', message: result.error })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label htmlFor="staff-email" className="text-[13px] font-bold text-muted">
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
        className="rounded-[9px] border border-line-strong bg-surface px-3.5 py-2.5 text-[14px]"
      />

      <button
        type="submit"
        disabled={state.status === 'sending'}
        className="rounded-[9px] bg-navy px-4 py-3 text-[14px] font-bold text-white disabled:opacity-60"
      >
        {state.status === 'sending' ? 'Sending…' : 'Send sign-in link'}
      </button>

      {state.status === 'sent' ? (
        <p role="status" className="m-0 text-[13.5px] text-muted">
          {SENT_MESSAGE}
        </p>
      ) : null}

      {state.status === 'error' ? (
        <p role="alert" className="m-0 text-[13.5px] font-semibold text-danger">
          {state.message}
        </p>
      ) : null}
    </form>
  )
}

import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * The one button in the system. Variants match the design's three weights:
 * navy primary, outlined secondary, and a bare ghost for toolbar toggles.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  readonly variant?: ButtonVariant
  readonly size?: ButtonSize
  /** In flight. Disables the control — a resubmitted checkout is a double booking. */
  readonly isPending?: boolean
  readonly isFullWidth?: boolean
  readonly className?: string
  readonly children: ReactNode
}

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition ' +
  'disabled:cursor-not-allowed disabled:opacity-55 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-mid'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-navy text-white hover:bg-navy-deep',
  secondary: 'border border-line-strong bg-surface text-ink hover:border-line-heavy',
  ghost: 'text-muted hover:bg-surface-sunken hover:text-ink',
  danger: 'bg-danger text-white hover:opacity-90',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-[15px]',
}

export function Button({
  variant = 'primary',
  size = 'md',
  isPending = false,
  isFullWidth = false,
  className = '',
  disabled,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      // Explicit type: an untyped button inside a form submits it.
      type={type}
      disabled={disabled || isPending}
      aria-busy={isPending || undefined}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${isFullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

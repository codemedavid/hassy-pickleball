/**
 * Loading placeholders.
 *
 * A skeleton is decoration: it stands in for content that has not arrived yet.
 * Announcing each grey box would give a screen reader a wall of noise, so every
 * `Skeleton` is hidden from assistive tech and the single `LoadingScreen`
 * wrapper carries the one message worth hearing — what is being waited on.
 */

export interface SkeletonProps {
  /** Sizing and shape come from the caller so one primitive covers every case. */
  readonly className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-surface-sunken motion-reduce:animate-none ${className}`}
    />
  )
}

export interface LoadingScreenProps {
  /** Named for the reader, e.g. "Loading courts" — not a generic "Loading". */
  readonly label: string
  readonly children: React.ReactNode
  readonly className?: string
}

export function LoadingScreen({ label, children, className = '' }: LoadingScreenProps) {
  return (
    <div role="status" aria-label={label} aria-busy="true" className={className}>
      {children}
    </div>
  )
}

'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * Where the console stops being a phone.
 *
 * Most of the console serves both widths from one DOM, which is what stops the
 * two layouts drifting. Two screens cannot: the nav is a scrolling rail below
 * `lg` and a row of links above it, and the schedule is a list below and a grid
 * above. Those choose here, from one definition of the breakpoint, so they
 * cannot disagree about what a desktop is.
 *
 * The server snapshot is `false` on purpose. Whichever width the server picks
 * is the one the other width sees flash on hydration, and the club's staff are
 * on phones.
 */

export const DESKTOP_MEDIA_QUERY = '(min-width: 64rem)'

export function matchesMediaQuery(query: string): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(query).matches
  )
}

export function prefersReducedMotion(): boolean {
  return matchesMediaQuery('(prefers-reduced-motion: reduce)')
}

/**
 * `beforeStoreChange` runs before the change is published, which is the only
 * moment a caller can still read the DOM the old width produced — the nav uses
 * it to remember which link had focus.
 */
export function subscribeToDesktopViewport(
  onStoreChange: () => void,
  beforeStoreChange?: () => void,
): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}

  const query = window.matchMedia(DESKTOP_MEDIA_QUERY)
  const handleChange = (): void => {
    beforeStoreChange?.()
    onStoreChange()
  }

  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }

  query.addListener(handleChange)
  return () => query.removeListener(handleChange)
}

export function getDesktopSnapshot(): boolean {
  return matchesMediaQuery(DESKTOP_MEDIA_QUERY)
}

export function getDesktopServerSnapshot(): boolean {
  return false
}

/** Whether the console is being read at desktop width. */
export function useIsDesktop(): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeToDesktopViewport(onStoreChange),
    [],
  )

  return useSyncExternalStore(subscribe, getDesktopSnapshot, getDesktopServerSnapshot)
}

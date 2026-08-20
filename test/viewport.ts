import { vi } from 'vitest'

/**
 * Puts a test on a phone or on a desktop.
 *
 * Screens that cannot serve both widths from one DOM — the court schedule is a
 * grid on a desktop and a list on a phone — choose between them with
 * `matchMedia`. jsdom answers every query with `false`, which would silently
 * pin every test to the narrow layout, so the width under test is stated.
 */

const DESKTOP_MEDIA_QUERY = '(min-width: 64rem)'

export function installViewport(isDesktop: boolean): () => void {
  const original = Object.getOwnPropertyDescriptor(window, 'matchMedia')

  const query = (media: string): MediaQueryList =>
    ({
      matches: media === DESKTOP_MEDIA_QUERY ? isDesktop : false,
      media,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as unknown as MediaQueryList

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn(query),
  })

  return () => {
    if (original) {
      Object.defineProperty(window, 'matchMedia', original)
      return
    }

    Reflect.deleteProperty(window, 'matchMedia')
  }
}

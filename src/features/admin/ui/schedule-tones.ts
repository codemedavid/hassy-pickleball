import type { ScheduleTone } from '../view/schedule'

/**
 * How a schedule entry is filled, shared by the desktop grid and the phone
 * agenda so the same booking is never two different colours.
 *
 * Colour is never the meaning: the grid prints a legend underneath, and the
 * agenda names the tone on every entry.
 */
export const SCHEDULE_TONE_STYLES: Record<ScheduleTone, string> = {
  confirmed: 'bg-navy text-white',
  awaiting: 'bg-lime text-navy',
  blocked: 'border border-line-strong bg-surface-sunken text-muted',
  event: 'bg-navy-mid text-white',
}

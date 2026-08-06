import 'server-only'

import { notFound } from 'next/navigation'
import { zonedTimeToUtc } from '@/lib/domain/time'
import { toDayStringInZone } from '@/lib/format/time'
import { getCurrentStaff, type StaffMember } from '@/lib/auth/staff'
import { findClubById } from '@/lib/repositories/clubs'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Client } from '@/lib/repositories/support'
import type { Club } from '@/lib/repositories/mappers'

/**
 * The context every admin page starts from.
 *
 * The layout has already redirected anyone without a staff record, so reaching
 * here without one means the session ended mid-navigation; that is a 404 rather
 * than a crash. Reads use the anon-key server client so RLS stays the boundary
 * — the staff policies are what actually decide what these screens can see.
 */

export type AdminConsole = {
  readonly staff: StaffMember
  readonly client: Client
  readonly club: Club
}

export async function loadConsole(): Promise<AdminConsole> {
  const staff = await getCurrentStaff()

  if (!staff) {
    notFound()
  }

  const client = (await createSupabaseServerClient()) as unknown as Client
  const club = await findClubById(client, staff.clubId)

  if (!club) {
    notFound()
  }

  return { staff, client, club }
}

export type DayWindow = {
  /** Club-local calendar day, "YYYY-MM-DD". */
  readonly day: string
  readonly from: Date
  readonly to: Date
  readonly days: number
}

const MINUTES_PER_DAY = 1440

/** The club-local day containing `now`, as a UTC half-open interval. */
export function todayWindow(club: Club, now: Date = new Date()): DayWindow {
  const day = toDayStringInZone(now, club.timeZone)

  return {
    day,
    from: zonedTimeToUtc(day, 0, club.timeZone),
    to: zonedTimeToUtc(day, MINUTES_PER_DAY, club.timeZone),
    days: 1,
  }
}

/** The `days`-long club-local window ending at the end of today. */
export function trailingWindow(club: Club, days: number, now: Date = new Date()): DayWindow {
  const today = todayWindow(club, now)
  const from = new Date(today.to.getTime() - days * MINUTES_PER_DAY * 60_000)

  return { day: today.day, from, to: today.to, days }
}

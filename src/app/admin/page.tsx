import { loadConsole, todayWindow } from './console-data'
import { ScheduleScreen } from '@/features/admin/ui/schedule-screen'
import { buildScheduleGrid } from '@/features/admin/view/schedule'
import { buildScheduleStats } from '@/features/admin/view/schedule-stats'
import { formatDayInZone } from '@/lib/format/time'
import { listBlocksInWindow } from '@/lib/repositories/blocks'
import { listBookingsInWindow } from '@/lib/repositories/bookings'
import { listActiveCourts } from '@/lib/repositories/courts'

/** The console lands on today's schedule — the screen the desk lives in. */
export default async function AdminSchedulePage() {
  const { client, club } = await loadConsole()
  const window = todayWindow(club)

  const courts = await listActiveCourts(client, club.id)

  const [bookings, blocks] = await Promise.all([
    listBookingsInWindow(client, { clubId: club.id, from: window.from, to: window.to }),
    listBlocksInWindow(client, {
      courtIds: courts.map((court) => court.id),
      from: window.from,
      to: window.to,
    }),
  ])

  return (
    <ScheduleScreen
      dayLabel={formatDayInZone(window.from, club.timeZone)}
      grid={buildScheduleGrid({ club, courts, bookings, blocks, day: window.day })}
      stats={buildScheduleStats({ club, courts, bookings, day: window.day })}
    />
  )
}

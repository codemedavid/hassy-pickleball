import { loadConsole, trailingWindow } from '../console-data'
import { ReportsScreen } from '@/features/admin/ui/reports-screen'
import { buildReports } from '@/features/admin/view/reports'
import { formatDayInZone } from '@/lib/format/time'
import { listBookingsInWindow } from '@/lib/repositories/bookings'
import { listActiveCourts } from '@/lib/repositories/courts'

const RANGE_DAYS = 30

export default async function AdminReportsPage() {
  const { client, club } = await loadConsole()
  const window = trailingWindow(club, RANGE_DAYS)

  const [courts, bookings] = await Promise.all([
    listActiveCourts(client, club.id),
    listBookingsInWindow(client, { clubId: club.id, from: window.from, to: window.to }),
  ])

  const report = buildReports({ club, courts, bookings, days: RANGE_DAYS, day: window.day })
  const rangeLabel = `Last ${RANGE_DAYS} days · ${formatDayInZone(window.from, club.timeZone)} to ${formatDayInZone(window.to, club.timeZone)}`

  return <ReportsScreen report={report} rangeLabel={rangeLabel} />
}

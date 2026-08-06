import { loadConsole, trailingWindow } from '../console-data'
import { BookingsScreen } from '@/features/admin/ui/bookings-screen'
import { toBookingRows } from '@/features/admin/view/bookings'
import { listBookingsInWindow } from '@/lib/repositories/bookings'

/** A week back and a week forward: what the desk is chasing and preparing for. */
const WINDOW_DAYS = 7
const MS_PER_DAY = 86_400_000

export default async function AdminBookingsPage() {
  const { client, club } = await loadConsole()
  const past = trailingWindow(club, WINDOW_DAYS)

  const bookings = await listBookingsInWindow(client, {
    clubId: club.id,
    from: past.from,
    to: new Date(past.to.getTime() + WINDOW_DAYS * MS_PER_DAY),
  })

  return <BookingsScreen rows={toBookingRows(bookings, club)} />
}

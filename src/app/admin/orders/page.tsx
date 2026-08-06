import { loadConsole, trailingWindow } from '../console-data'
import { OrdersScreen } from '@/features/admin/ui/orders-screen'
import { toOrderDetail, toOrderRows } from '@/features/admin/view/orders'
import { listBookingsInWindow } from '@/lib/repositories/bookings'

const WINDOW_DAYS = 30

type OrdersPageProps = {
  searchParams: Promise<{ order?: string }>
}

/**
 * The payments ledger. The selected order travels in the query string so the
 * detail panel is linkable — staff pass these around when reconciling.
 */
export default async function AdminOrdersPage({ searchParams }: OrdersPageProps) {
  const [{ client, club }, { order }] = await Promise.all([loadConsole(), searchParams])
  const window = trailingWindow(club, WINDOW_DAYS)

  const bookings = await listBookingsInWindow(client, {
    clubId: club.id,
    from: window.from,
    to: window.to,
  })

  // An unknown or absent id falls back to the newest order rather than an
  // empty panel, so the screen is useful the moment it loads.
  const selected =
    bookings.find((booking) => booking.booking.id === order) ?? bookings.at(-1) ?? null

  return (
    <OrdersScreen
      rows={toOrderRows(bookings, club)}
      detail={selected ? toOrderDetail(selected, club) : null}
    />
  )
}

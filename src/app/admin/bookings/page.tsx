import { loadConsole, trailingWindow } from '../console-data'
import { BookingsScreen } from '@/features/admin/ui/bookings-screen'
import { toBookingDetailView, toBookingRows } from '@/features/admin/view/bookings'
import {
  markBookingPaidAction,
  refundPaymentAction,
  setBookingStatusAction,
} from '@/features/admin/actions'
import { signPaymentProofUrl } from '@/features/checkout/server/proof-storage'
import { listBookingsInWindow, type BookingDetail } from '@/lib/repositories/bookings'
import type { SignedProofUrls } from '@/features/admin/view/bookings'

/**
 * The console's one ledger. Thirty days back covers reconciling a transfer
 * that landed late; a week forward is what the desk is preparing for. The
 * Orders screen used to own the first half of that range on its own.
 */
const DAYS_BACK = 30
const DAYS_FORWARD = 7
const MS_PER_DAY = 86_400_000

type BookingsPageProps = {
  searchParams: Promise<{ booking?: string }>
}

/**
 * Proofs live in a private bucket, so a link is signed per request and expires.
 * Signing happens here rather than in the view layer because it needs a server;
 * a path that fails to sign is simply left out, and the panel renders no link
 * rather than one that 403s.
 */
function signProofs(bookings: readonly BookingDetail[]): SignedProofUrls {
  const paths = bookings.flatMap((detail) =>
    detail.payments.flatMap((payment) => (payment.proofUrl ? [payment.proofUrl] : [])),
  )

  return Object.fromEntries(
    [...new Set(paths)].flatMap((path) => {
      const signed = signPaymentProofUrl(path)

      return signed.success ? [[path, signed.data] as const] : []
    }),
  )
}

export default async function AdminBookingsPage({ searchParams }: BookingsPageProps) {
  const [{ client, club }, { booking }] = await Promise.all([loadConsole(), searchParams])
  const past = trailingWindow(club, DAYS_BACK)

  const bookings = await listBookingsInWindow(client, {
    clubId: club.id,
    from: past.from,
    to: new Date(past.to.getTime() + DAYS_FORWARD * MS_PER_DAY),
  })

  // An unknown or absent id falls back to the newest booking rather than an
  // empty panel, so the screen is useful the moment it loads.
  const selected = bookings.find((detail) => detail.booking.id === booking) ?? bookings.at(-1)

  return (
    <BookingsScreen
      rows={toBookingRows(bookings, club)}
      detail={selected ? toBookingDetailView(selected, club, signProofs([selected])) : null}
      currency={club.currency}
      onSetStatus={setBookingStatusAction}
      onMarkPaid={markBookingPaidAction}
      onRefund={refundPaymentAction}
    />
  )
}

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CourtBookingPanel } from '@/features/booking/ui/court-booking-panel'
import { getAvailability } from '@/features/booking/server/availability'
import { findClubBySlug } from '@/lib/repositories/clubs'
import { findCourtBySlug } from '@/lib/repositories/courts'
import { formatDayInZone, toDayStringInZone } from '@/lib/format/time'
import { formatMinutes, formatMoney } from '@/lib/format/money'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const CLUB_SLUG = 'baseline'
const DEFAULT_DURATION_MINUTES = 60
const DURATION_CHOICES = [60, 90, 120] as const

type CourtPageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ day?: string; duration?: string }>
}

function parseDuration(raw: string | undefined): number {
  const parsed = Number(raw)

  return DURATION_CHOICES.includes(parsed as (typeof DURATION_CHOICES)[number])
    ? parsed
    : DEFAULT_DURATION_MINUTES
}

export default async function CourtPage({ params, searchParams }: CourtPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const client = await createSupabaseServerClient()

  const club = await findClubBySlug(client, CLUB_SLUG)

  if (!club) {
    notFound()
  }

  const court = await findCourtBySlug(client, club.id, slug)

  if (!court) {
    notFound()
  }

  const day = query.day ?? toDayStringInZone(new Date(), club.timeZone)
  const durationMinutes = parseDuration(query.duration)

  const availability = await getAvailability({
    clubId: club.id,
    day,
    durationMinutes,
    courtId: court.id,
  })

  const slots = availability.success ? (availability.data[0]?.slots ?? []) : []

  return (
    <main className="mx-auto max-w-[1280px] px-7 pb-20 pt-8">
      <Link href="/courts" className="text-[13px] font-bold text-muted hover:text-olive">
        ← Back to courts
      </Link>

      <div className="mt-4 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-[36px] font-bold leading-[1.05] tracking-[-0.03em]">
            {court.name}
          </h1>
          <p className="mt-2 text-[15px] text-muted">
            {court.surface} · {court.environment} ·{' '}
            {formatMoney(court.basePriceCents, club.currency)} / hr
          </p>

          {court.blurb ? <p className="mt-4 text-[15px] text-muted">{court.blurb}</p> : null}

          {court.includes.length > 0 ? (
            <>
              <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-bold">
                Included
              </h2>
              <ul className="mt-2 flex flex-col gap-1.5 text-[14px] text-muted">
                {court.includes.map((item) => (
                  <li key={item}>· {item}</li>
                ))}
              </ul>
            </>
          ) : null}

          {court.notes ? (
            <>
              <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-bold">
                Good to know
              </h2>
              <p className="mt-2 text-[14px] text-muted">{court.notes}</p>
            </>
          ) : null}
        </div>

        <div className="flex flex-col gap-6 rounded-[18px] border border-line bg-surface p-6">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-olive">
              {formatDayInZone(new Date(`${day}T12:00:00Z`), 'UTC')}
            </p>
            <nav aria-label="Session length" className="mt-3 flex gap-2">
              {DURATION_CHOICES.map((choice) => {
                const isActive = choice === durationMinutes

                return (
                  <Link
                    key={choice}
                    href={`/courts/${court.slug}?day=${day}&duration=${choice}`}
                    aria-current={isActive ? 'page' : undefined}
                    className={
                      isActive
                        ? 'rounded-[10px] bg-navy px-3.5 py-2 text-[13px] font-bold text-white'
                        : 'rounded-[10px] border border-line px-3.5 py-2 text-[13px] font-bold text-muted hover:border-line-heavy'
                    }
                  >
                    {formatMinutes(choice)}
                  </Link>
                )
              })}
            </nav>
          </div>

          {availability.success ? (
            <CourtBookingPanel
              courtId={court.id}
              courtName={court.name}
              slots={slots}
              timeZone={club.timeZone}
              currency={club.currency}
            />
          ) : (
            <p className="rounded-[12px] border border-danger-line bg-danger-bg px-4 py-3 text-[14px] text-danger">
              {availability.error}
            </p>
          )}
        </div>
      </div>
    </main>
  )
}

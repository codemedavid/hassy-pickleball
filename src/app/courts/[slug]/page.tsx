import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CourtBookingExperience } from '@/features/booking/ui/court-booking-experience'
import { buildDateStrip, buildDurationOptions } from '@/features/booking/view/court-detail'
import { getAvailability } from '@/features/booking/server/availability'
import { findClubBySlug } from '@/lib/repositories/clubs'
import { findCourtBySlug } from '@/lib/repositories/courts'
import { listActiveProducts } from '@/lib/repositories/products'
import { parseDayString, toDayStringInZone } from '@/lib/format/time'
import { formatMoney } from '@/lib/format/money'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const CLUB_SLUG = 'baseline'
const DEFAULT_DURATION_MINUTES = 60
const DATE_STRIP_DAYS = 7

type CourtPageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ day?: string; duration?: string }>
}

/**
 * The duration a raw search param asks for, clamped to what the club sells.
 *
 * `getAvailability` validates the same bounds and would fail with an error the
 * customer cannot act on, so an out-of-range param falls back rather than
 * rendering a dead page.
 */
function parseDuration(
  raw: string | undefined,
  club: { readonly minDurationMinutes: number; readonly maxDurationMinutes: number },
): number {
  const parsed = Number(raw)

  if (!Number.isInteger(parsed) || parsed < club.minDurationMinutes) {
    return Math.max(DEFAULT_DURATION_MINUTES, club.minDurationMinutes)
  }

  return Math.min(parsed, club.maxDurationMinutes)
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

  const day = parseDayString(query.day, toDayStringInZone(new Date(), club.timeZone))
  const durationMinutes = parseDuration(query.duration, club)

  const [availability, products] = await Promise.all([
    getAvailability({ clubId: club.id, day, durationMinutes, courtId: court.id }),
    listActiveProducts(client, club.id),
  ])

  const slots = availability.success ? (availability.data[0]?.slots ?? []) : []

  // Café items belong to the shop, not to a court session.
  const addons = products
    .filter((product) => product.type === 'addon')
    .map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      priceCents: product.priceCents,
    }))

  const dates = buildDateStrip({ selectedDay: day, timeZone: club.timeZone, days: DATE_STRIP_DAYS })
  const durations = buildDurationOptions({ club, durationMinutes })

  const hrefFor = (next: { day?: string; duration?: number }): string =>
    `/courts/${court.slug}?day=${next.day ?? day}&duration=${next.duration ?? durationMinutes}`

  return (
    <main className="mx-auto max-w-[1280px] px-7 pb-20 pt-7">
      {/* The catalog lives at the root; /courts only 308s here. */}
      <Link href="/" className="text-[14px] font-medium text-muted hover:text-olive">
        ← All courts
      </Link>

      <div className="mt-4 flex flex-col gap-5">
        <article className="overflow-hidden rounded-[18px] border border-line bg-surface">
          <div className="relative h-[300px] bg-surface-sunken">
            {court.heroImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- court photos are remote and no image loader domain is configured yet
              <img
                src={court.heroImageUrl}
                alt={`${court.name} seen from the sideline`}
                className="h-full w-full object-cover"
              />
            ) : (
              <p className="grid h-full place-items-center text-[14px] text-subtle">
                Photo coming soon
              </p>
            )}
          </div>

          <div className="p-6">
            <div className="mb-4 flex items-start justify-between gap-5">
              <div>
                <h1 className="font-[family-name:var(--font-display)] text-[32px] font-bold leading-[1.05] tracking-[-0.03em]">
                  {court.name}
                </h1>
                {court.blurb ? <p className="mt-1.5 text-[14px] text-muted">{court.blurb}</p> : null}
              </div>
              <p className="flex-none text-right">
                <span className="block font-[family-name:var(--font-display)] text-[26px] font-bold">
                  {formatMoney(court.basePriceCents, club.currency)}
                </span>
                <span className="block text-[12px] text-muted">per hour, off-peak</span>
              </p>
            </div>

            {court.tags.length > 0 ? (
              <ul className="mb-5 flex flex-wrap gap-2">
                {court.tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-[8px] border border-line bg-surface-alt px-2.5 py-1.5 text-[12.5px] font-medium text-slate"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            ) : null}

            {court.includes.length > 0 || court.notes.length > 0 ? (
              <div className="grid gap-6 border-t border-surface-sunken pt-5 sm:grid-cols-2">
                {court.includes.length > 0 ? (
                  <section>
                    <h2 className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.12em] text-olive">
                      Included
                    </h2>
                    <ul className="flex flex-col gap-2">
                      {court.includes.map((item) => (
                        <li key={item} className="flex gap-2.5 text-[14px] text-slate">
                          <span aria-hidden className="font-bold text-olive">
                            ✓
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {court.notes.length > 0 ? (
                  <section>
                    <h2 className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.12em] text-olive">
                      Good to know
                    </h2>
                    <ul className="flex flex-col gap-2">
                      {court.notes.map((note) => (
                        <li key={note} className="text-[14px] text-muted">
                          {note}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>
            ) : null}
          </div>
        </article>

        <div className="rounded-[18px] border border-line bg-surface p-6">
          <nav aria-label="Booking day" className="flex gap-2.5 overflow-x-auto pb-1">
            {dates.map((date) => (
              <Link
                key={date.day}
                href={hrefFor({ day: date.day })}
                aria-current={date.isSelected ? 'date' : undefined}
                className={`flex-none rounded-[11px] border px-4 py-2.5 text-center ${
                  date.isSelected
                    ? 'border-navy bg-navy text-white'
                    : 'border-line bg-surface text-slate hover:border-line-heavy'
                }`}
              >
                <span className="block text-[11px] uppercase tracking-[0.08em] opacity-70">
                  {date.weekday}
                </span>
                <span className="mt-0.5 block font-[family-name:var(--font-display)] text-[19px] font-bold">
                  {date.dayOfMonth}
                </span>
              </Link>
            ))}
          </nav>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <span className="mr-1 text-[13px] font-medium text-muted">Duration</span>
            <nav aria-label="Session length" className="flex flex-wrap gap-2.5">
              {durations.map((option) => (
                <Link
                  key={option.minutes}
                  href={hrefFor({ duration: option.minutes })}
                  aria-current={option.isSelected ? 'page' : undefined}
                  className={`rounded-[8px] border px-3.5 py-2 text-[13.5px] font-semibold ${
                    option.isSelected
                      ? 'border-navy bg-navy text-white'
                      : 'border-line bg-surface text-slate hover:border-line-heavy'
                  }`}
                >
                  {option.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        {availability.success ? (
          <CourtBookingExperience
            courtId={court.id}
            courtName={court.name}
            slots={slots}
            addons={addons}
            durationMinutes={durationMinutes}
            timeZone={club.timeZone}
            currency={club.currency}
            cancellationWindowHours={club.cancellationWindowHours}
          />
        ) : (
          <p className="rounded-[12px] border border-danger-line bg-danger-bg px-4 py-3 text-[14px] text-danger">
            {availability.error}
          </p>
        )}

        {club.groupBookingNote ? (
          <aside className="rounded-[18px] bg-navy px-6 py-5 text-white lg:max-w-[420px] lg:self-end">
            <h2 className="font-[family-name:var(--font-display)] text-[16px] font-bold">
              Playing with a group?
            </h2>
            <p className="mt-1.5 text-pretty text-[13.5px] text-white/72">
              {club.groupBookingNote}
              {club.phone ? ` Call the desk on ${club.phone}.` : null}
            </p>
          </aside>
        ) : null}
      </div>
    </main>
  )
}

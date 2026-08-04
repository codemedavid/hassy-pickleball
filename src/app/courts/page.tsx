import { notFound } from 'next/navigation'
import { CourtCard } from '@/features/courts/court-card'
import { COURT_FILTERS, filterCourts } from '@/features/courts/court-filters'
import { listActiveCourts } from '@/lib/repositories/courts'
import { findClubBySlug } from '@/lib/repositories/clubs'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import Link from 'next/link'

/** Single-club deployment for now; the schema is multi-club ready. */
const CLUB_SLUG = 'baseline'

type CourtsPageProps = {
  searchParams: Promise<{ filter?: string }>
}

/**
 * Server Component: courts are public catalog data, readable under the
 * `courts_public_read` policy with the anon key, so no client fetch is needed.
 *
 * Filtering is a link-driven search param rather than client state — it keeps
 * the grid a Server Component and makes each filtered view linkable.
 */
export default async function CourtsPage({ searchParams }: CourtsPageProps) {
  const { filter = 'all' } = await searchParams
  const client = await createSupabaseServerClient()

  const club = await findClubBySlug(client, CLUB_SLUG)

  if (!club) {
    notFound()
  }

  const courts = await listActiveCourts(client, club.id)
  const visible = filterCourts(courts, filter)

  return (
    <main className="mx-auto max-w-[1280px] px-7 pb-20 pt-8">
      <header className="mb-6">
        <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.14em] text-olive">
          Book a court
        </p>
        <h1 className="mb-2.5 font-[family-name:var(--font-display)] text-[40px] font-bold leading-[1.05] tracking-[-0.03em]">
          {courts.length} courts. Open {club.opensAt.slice(0, 5)} to {club.closesAt.slice(0, 5)}.
        </h1>
        <p className="max-w-[52ch] text-[16px] text-muted">
          Pick a court, choose how long you want to play, and add paddles or café items at checkout.
        </p>
      </header>

      <nav aria-label="Filter courts" className="mb-6 flex flex-wrap gap-2.5">
        {COURT_FILTERS.map((option) => {
          const isActive = option.id === filter

          return (
            <Link
              key={option.id}
              href={option.id === 'all' ? '/courts' : `/courts?filter=${option.id}`}
              aria-current={isActive ? 'page' : undefined}
              className={
                isActive
                  ? 'rounded-[10px] bg-navy px-3.5 py-2 text-[13px] font-bold text-white'
                  : 'rounded-[10px] border border-line bg-surface px-3.5 py-2 text-[13px] font-bold text-muted hover:border-line-heavy'
              }
            >
              {option.label}
            </Link>
          )
        })}
      </nav>

      {visible.length === 0 ? (
        <p className="rounded-[14px] border border-line bg-surface px-5 py-8 text-center text-muted">
          No courts match that filter.
        </p>
      ) : (
        <div className="grid gap-[22px] md:grid-cols-2">
          {visible.map((court) => (
            <CourtCard key={court.id} court={court} currency={club.currency} />
          ))}
        </div>
      )}
    </main>
  )
}

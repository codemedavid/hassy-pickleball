import Link from 'next/link'
import { CourtCard } from './court-card'
import { COURT_FILTERS, filterCourts } from './court-filters'
import type { Club, Court } from '@/lib/repositories/mappers'

type CourtsBrowseProps = {
  readonly club: Club
  readonly courts: readonly Court[]
  readonly filter?: string
}

const CHIP_BASE = 'rounded-[10px] px-3.5 py-2 text-[13px] font-bold'
const CHIP_ACTIVE = `${CHIP_BASE} bg-navy text-white`
const CHIP_IDLE = `${CHIP_BASE} border border-line bg-surface text-muted hover:border-line-heavy`

/** "07:00:00" from Postgres, "07:00" in the headline. */
function toClockTime(time: string): string {
  return time.slice(0, 5)
}

/**
 * The storefront catalog: filter chips over a grid of court cards.
 *
 * Filtering is a link-driven search param rather than client state — it keeps
 * this a Server Component and makes each filtered view linkable. The links
 * point at `/`, which is the canonical catalog URL; `/courts` redirects here.
 */
export function CourtsBrowse({ club, courts, filter = 'all' }: CourtsBrowseProps) {
  const visible = filterCourts(courts, filter)

  return (
    <main className="mx-auto w-full max-w-[1280px] px-7 pb-20 pt-8">
      <header className="mb-6">
        <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.14em] text-olive">
          Book a court
        </p>
        <h1 className="mb-2.5 font-[family-name:var(--font-display)] text-[40px] font-bold leading-[1.05] tracking-[-0.03em]">
          {courts.length} courts. Open {toClockTime(club.opensAt)} to {toClockTime(club.closesAt)}.
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
              href={option.id === 'all' ? '/' : `/?filter=${option.id}`}
              aria-current={isActive ? 'page' : undefined}
              className={isActive ? CHIP_ACTIVE : CHIP_IDLE}
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

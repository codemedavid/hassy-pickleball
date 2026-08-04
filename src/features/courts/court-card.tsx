import Image from 'next/image'
import Link from 'next/link'
import { formatMoney } from '@/lib/format/money'
import type { Court } from '@/lib/repositories/mappers'

type CourtCardProps = {
  court: Court
  currency?: string
}

const CHIP =
  'rounded-full px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] leading-none'

export function CourtCard({ court, currency = 'PHP' }: CourtCardProps) {
  return (
    <article className="flex flex-col overflow-hidden rounded-[18px] border border-line bg-surface">
      <div className="relative h-[220px] bg-[#E9EEF4]">
        {court.heroImageUrl ? (
          <Image
            src={court.heroImageUrl}
            alt={court.name}
            fill
            sizes="(max-width: 900px) 100vw, 50vw"
            className="object-cover"
          />
        ) : null}

        <div className="pointer-events-none absolute left-3.5 top-3.5 flex gap-2">
          <span className={`${CHIP} bg-navy text-white`}>{court.environment}</span>
          {court.isTournamentGrade ? (
            <span className={`${CHIP} bg-lime text-navy`}>Tournament grade</span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3.5 px-5 pb-5 pt-5">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-[22px] font-bold tracking-[-0.02em]">
              {court.name}
            </h2>
            <p className="mt-1 text-[13px] text-muted">{court.surface}</p>
          </div>
          <p className="whitespace-nowrap text-[15px] font-bold">
            {formatMoney(court.basePriceCents, currency)}
            <span className="text-[13px] font-normal text-muted"> / hr</span>
          </p>
        </div>

        {court.blurb ? <p className="text-[14px] text-muted">{court.blurb}</p> : null}

        {court.tags.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {court.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-line bg-surface-sunken px-2.5 py-1 text-[12px] text-muted"
              >
                {tag}
              </li>
            ))}
          </ul>
        ) : null}

        <Link
          href={`/courts/${court.slug}`}
          className="mt-auto rounded-[10px] bg-navy px-4 py-3 text-center text-[14px] font-bold text-white hover:bg-navy-mid"
        >
          View &amp; book
        </Link>
      </div>
    </article>
  )
}

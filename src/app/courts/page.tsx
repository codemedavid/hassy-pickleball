import { permanentRedirect } from 'next/navigation'

type LegacyCourtsPageProps = {
  searchParams: Promise<{ filter?: string }>
}

/**
 * The catalog moved to the storefront root. This keeps old links and indexed
 * URLs working, carrying the active filter across so a bookmarked filtered
 * view lands on the same set of courts.
 *
 * Court detail pages stay at /courts/[slug] and are unaffected.
 */
export default async function LegacyCourtsPage({ searchParams }: LegacyCourtsPageProps) {
  const { filter } = await searchParams

  permanentRedirect(filter ? `/?filter=${encodeURIComponent(filter)}` : '/')
}

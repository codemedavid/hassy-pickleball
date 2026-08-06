import { notFound } from 'next/navigation'
import { CourtsBrowse } from '@/features/courts/courts-browse'
import { findClubBySlug } from '@/lib/repositories/clubs'
import { listActiveCourts } from '@/lib/repositories/courts'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/** Single-club deployment for now; the schema is multi-club ready. */
const CLUB_SLUG = 'baseline'

type HomePageProps = {
  searchParams: Promise<{ filter?: string }>
}

/**
 * The storefront, served at the root so the catalog is the first thing a
 * visitor sees. Courts are public catalog data, readable under the
 * `courts_public_read` policy with the anon key, so this stays a Server
 * Component with no client fetch.
 */
export default async function HomePage({ searchParams }: HomePageProps) {
  const { filter } = await searchParams
  const client = await createSupabaseServerClient()

  const club = await findClubBySlug(client, CLUB_SLUG)

  if (!club) {
    notFound()
  }

  const courts = await listActiveCourts(client, club.id)

  return <CourtsBrowse club={club} courts={courts} filter={filter} />
}

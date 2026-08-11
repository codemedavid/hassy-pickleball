import { LoadingScreen, Skeleton } from '@/components/ui/skeleton'

/**
 * Streams the storefront shell while the catalog and today's open-slot counts
 * are read. Without this boundary the browser holds the previous page until the
 * slowest query returns.
 */
export default function Loading() {
  return (
    <LoadingScreen label="Loading courts" className="mx-auto w-full max-w-6xl px-4 py-8">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-3 h-5 w-80" />
      <Skeleton className="mt-6 h-10 w-full max-w-md" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-64 w-full" />
        ))}
      </div>
    </LoadingScreen>
  )
}

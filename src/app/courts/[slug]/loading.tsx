import { LoadingScreen, Skeleton } from '@/components/ui/skeleton'

/**
 * The court detail page waits on the court record and its availability grid.
 * The grid is the slow half, so the boundary covers the whole page rather than
 * letting the header paint against an empty body.
 */
export default function Loading() {
  return (
    <LoadingScreen label="Loading court" className="mx-auto w-full max-w-5xl px-4 py-8">
      <Skeleton className="h-72 w-full" />
      <Skeleton className="mt-6 h-8 w-72" />
      <Skeleton className="mt-3 h-5 w-full max-w-xl" />
      <div className="mt-8 grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    </LoadingScreen>
  )
}

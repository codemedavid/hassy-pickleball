import { LoadingScreen, Skeleton } from '@/components/ui/skeleton'

/**
 * The admin console aggregates several reads before its first paint. Staff open
 * this repeatedly through a shift, so the wait is announced rather than silent.
 */
export default function Loading() {
  return (
    <LoadingScreen label="Loading console" className="w-full px-4 py-8">
      <Skeleton className="h-8 w-56" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>
      <Skeleton className="mt-8 h-96 w-full" />
    </LoadingScreen>
  )
}

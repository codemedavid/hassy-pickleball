import { LoadingScreen, Skeleton } from '@/components/ui/skeleton'

/**
 * Checkout re-prices the cart on the server before it can render. Showing the
 * form shell early keeps the step from feeling like a dropped click.
 */
export default function Loading() {
  return (
    <LoadingScreen label="Loading checkout" className="mx-auto w-full max-w-3xl px-4 py-8">
      <Skeleton className="h-8 w-48" />
      <div className="mt-6 space-y-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
      <Skeleton className="mt-8 h-32 w-full" />
      <Skeleton className="mt-6 h-12 w-full sm:w-48" />
    </LoadingScreen>
  )
}

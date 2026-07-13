import { cn } from '@/lib/utils'

// Skeleton loaders — preferred over spinners. They hold the page's shape while
// data loads, so the layout doesn't jump and the wait feels shorter and calmer.
// One quiet shimmer (via `animate-pulse`) everywhere; no bright spinners.

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-surface-sunken', className)} />
}

// A block of fake text lines; last line is shorter for a natural ragged edge.
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3.5', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  )
}

// Table placeholder matching DataTable's rhythm: header strip + N rows.
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-surface-line">
      <div className="flex gap-4 border-b border-surface-line bg-surface-sunken px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => <Skeleton key={i} className="h-3 flex-1" />)}
      </div>
      <div className="divide-y divide-surface-line">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-3.5">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className={cn('h-3.5 flex-1', c === 0 && 'max-w-[40%]')} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// Card grid placeholder for dashboards / KPI rows.
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('fiori-card p-5', className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-20" />
      <Skeleton className="mt-3 h-3 w-16" />
    </div>
  )
}

import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Unified status badge — ONE source of truth for how every workflow status
// renders across the whole ERP/WMS. Every module used to keep its own
// tone() / STATUS_TONE map, so "Pending" was orange here, red there, and the
// padding/height drifted per screen. This maps the raw DB status string to a
// single semantic colour + a clean humanised label, so every status chip is
// identical in height, radius, padding, font-size, dot-size and spacing.
//
// Palette is deliberately small (enterprise-calm): slate = inert/draft,
// blue = in progress, amber = waiting on someone, green = done/good,
// red = failed/overdue, gold(brand) = reserved for genuine emphasis only.
// ---------------------------------------------------------------------------

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand'

// Chip shell + dot colour per tone. Light + dark. Quiet fills, hairline ring.
const TONE_CLASS: Record<StatusTone, string> = {
  neutral: 'bg-surface-sunken text-ink-soft ring-surface-line',
  info: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/30',
  success: 'bg-green-50 text-green-700 ring-green-200 dark:bg-green-500/15 dark:text-green-400 dark:ring-green-500/30',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:ring-amber-500/30',
  danger: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/15 dark:text-red-400 dark:ring-red-500/30',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30'
}
const DOT_CLASS: Record<StatusTone, string> = {
  neutral: 'bg-ink-faint/60', info: 'bg-blue-500', success: 'bg-green-500',
  warning: 'bg-amber-500', danger: 'bg-red-500', brand: 'bg-brand-500'
}

// Canonical status → tone. Keys are normalised (lowercase, underscores).
// Grouped by lifecycle stage so new statuses land in the obvious bucket.
const STATUS_TONE: Record<string, StatusTone> = {
  // Inert / not-started
  draft: 'neutral', new: 'neutral', inactive: 'neutral', scrapped: 'neutral', unknown: 'neutral',
  // Waiting on an action / overdue-risk
  pending: 'warning', pending_collection: 'warning', awaiting: 'warning', waiting: 'warning',
  open: 'warning', on_hold: 'warning', hold: 'warning', quarantine: 'warning', unpaid: 'warning',
  requested: 'warning', submitted: 'warning',
  // In progress / moving
  in_progress: 'info', processing: 'info', picking: 'info', picked: 'info', packing: 'info',
  packed: 'info', loading: 'info', loaded: 'info', allocated: 'info', booked: 'info',
  assigned: 'info', in_transit: 'info', dispatched: 'info', issued: 'info', posted: 'info',
  reserved: 'info', collected: 'info', partial: 'info', partially_delivered: 'info', ready: 'info',
  // Done / good
  approved: 'success', verified: 'success', received: 'success', completed: 'success',
  delivered: 'success', fully_delivered: 'success', closed: 'success', paid: 'success',
  active: 'success', good: 'success', in_stock: 'success', done: 'success', success: 'success',
  // Failed / negative
  rejected: 'danger', cancelled: 'danger', canceled: 'danger', lost: 'danger', failed: 'danger',
  void: 'danger', voided: 'danger', overdue: 'danger', returned: 'danger', damaged: 'danger'
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, '_')
// "in_transit" → "In Transit". Used when no explicit label is supplied.
const humanise = (s: string) =>
  norm(s).split('_').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

export const statusTone = (status: string | null | undefined): StatusTone =>
  (status && STATUS_TONE[norm(status)]) || 'neutral'

interface Props {
  status: string | null | undefined
  /** Override the auto-humanised label (module-specific wording). */
  label?: React.ReactNode
  /** Override the resolved tone in the rare case a screen needs to. */
  tone?: StatusTone
  className?: string
}

export function StatusBadge({ status, label, tone, className }: Props) {
  if (!status && !label) return <span className="text-ink-faint">—</span>
  const t = tone ?? statusTone(status)
  return (
    <span className={cn(
      'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ring-1 ring-inset whitespace-nowrap',
      TONE_CLASS[t], className
    )}>
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT_CLASS[t])} />
      {label ?? humanise(String(status))}
    </span>
  )
}

import { Icon } from './Icon'
import { cn } from '@/lib/utils'

export interface BulkAction { icon: string; label: string; onClick: () => void; tone?: string; disabled?: boolean }

// Appears above the list once rows are checked (Masters, Operations registers…):
// a count, a clear link, and the actions that apply to the current selection.
export function BulkActionBar({ count, onClear, actions }: { count: number; onClear: () => void; actions: BulkAction[] }) {
  if (count === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-brand-500/10 px-3.5 py-2 ring-1 ring-brand-500/20">
      <span className="text-sm font-semibold text-ink">{count} selected</span>
      <button onClick={onClear} className="text-xs font-medium text-ink-soft underline-offset-2 hover:text-ink hover:underline">Clear</button>
      <div className="ml-auto flex flex-wrap gap-2">
        {actions.map(a => (
          <button key={a.label} type="button" onClick={a.onClick} disabled={a.disabled}
            className={cn('inline-flex items-center gap-1.5 rounded-lg border border-surface-line bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50', a.tone)}>
            <Icon name={a.icon} className="text-[16px]" /> {a.label}
          </button>
        ))}
      </div>
    </div>
  )
}

import { cn } from '@/lib/utils'

// Segmented control — the one style for inline "pick one of a few views"
// toggles (By Customer / By Salesman, All / Transport / Courier, …). A sunken
// track with a raised active thumb, matching the calm design language instead
// of the assorted gold-filled toggles each screen used to roll its own.
export interface SegmentedOption<T extends string> { value: T; label: string; icon?: string }

export function Segmented<T extends string>({ options, value, onChange, size = 'md', className }: {
  options: SegmentedOption<T>[]
  value: T
  onChange: (v: T) => void
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div className={cn('inline-flex items-center gap-0.5 rounded-lg bg-surface-sunken p-0.5 ring-1 ring-inset ring-surface-line', className)}>
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn('rounded-md font-medium transition-colors whitespace-nowrap',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
            value === o.value ? 'bg-surface text-ink shadow-soft' : 'text-ink-soft hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

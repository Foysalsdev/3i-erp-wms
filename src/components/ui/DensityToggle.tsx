import { useUI, type Density } from '@/store/ui'
import { Icon } from './Icon'
import { cn } from '@/lib/utils'

const OPTIONS: { mode: Density; icon: string; label: string }[] = [
  { mode: 'comfortable', icon: 'density_medium', label: 'Comfortable' },
  { mode: 'compact', icon: 'density_small', label: 'Compact' }
]

// Row-height preference for every list in the app (DataTable reads it directly),
// so switching once here changes Masters, Operations, Inventory etc. together.
export function DensityToggle({ className }: { className?: string }) {
  const { density, setDensity } = useUI()
  return (
    <div className={cn('inline-flex items-center gap-0.5 rounded-lg border border-brand-200/70 bg-surface p-0.5', className)}>
      {OPTIONS.map(o => (
        <button key={o.mode} type="button" title={o.label} onClick={() => setDensity(o.mode)}
          className={cn('flex h-7 w-7 items-center justify-center rounded-md transition-colors',
            density === o.mode ? 'bg-brand-500 text-coal-900' : 'text-ink-faint hover:bg-surface-sunken hover:text-ink-soft')}>
          <Icon name={o.icon} className="text-[16px]" />
        </button>
      ))}
    </div>
  )
}

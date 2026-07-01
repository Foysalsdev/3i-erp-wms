import { useUI, type ThemeMode } from '@/store/ui'
import { Icon } from './Icon'
import { cn } from '@/lib/utils'

const OPTIONS: { mode: ThemeMode; icon: string; label: string }[] = [
  { mode: 'light', icon: 'light_mode', label: 'Light' },
  { mode: 'dark', icon: 'dark_mode', label: 'Dark' },
  { mode: 'system', icon: 'brightness_auto', label: 'System' }
]

export function ThemeToggle({ className }: { className?: string }) {
  const { themeMode, setThemeMode } = useUI()
  return (
    <div className={cn('inline-flex items-center gap-0.5 rounded-lg border border-brand-200/70 bg-surface p-0.5', className)}>
      {OPTIONS.map(o => (
        <button key={o.mode} type="button" title={o.label} onClick={() => setThemeMode(o.mode)}
          className={cn('flex h-7 w-7 items-center justify-center rounded-md transition-colors',
            themeMode === o.mode ? 'bg-brand-500 text-coal-900' : 'text-ink-faint hover:bg-surface-sunken hover:text-ink-soft')}>
          <Icon name={o.icon} className="text-[16px]" />
        </button>
      ))}
    </div>
  )
}

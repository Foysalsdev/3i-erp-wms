import { cn } from '@/lib/utils'
export function Tabs({ tabs, active, onChange }:
  { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-surface-line">
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={cn('relative whitespace-nowrap px-3.5 py-2.5 text-sm font-medium transition-colors',
            active === t.key ? 'text-ink' : 'text-ink-faint hover:text-ink-soft')}>
          {t.label}
          {active === t.key && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-500" />}
        </button>
      ))}
    </div>
  )
}

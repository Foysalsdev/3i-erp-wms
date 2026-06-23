import { cn } from '@/lib/utils'
export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('fiori-card', className)}>{children}</div>
}
export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between border-b border-surface-line px-5 py-3.5">
      <div>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

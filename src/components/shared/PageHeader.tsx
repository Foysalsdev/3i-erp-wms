import { Icon } from '@/components/ui/Icon'
export function PageHeader({ icon, title, subtitle, actions }:
  { icon?: string; title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {icon && <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100"><Icon name={icon} className="text-[21px]" /></div>}
        <div>
          <h1 className="font-display text-lg font-bold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="text-xs text-ink-soft">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

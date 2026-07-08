import { Icon } from './Icon'
import { LoadingRing } from './LoadingRing'
export const Spinner = ({ label }: { label?: string }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-16 text-horizon-muted">
    <LoadingRing className="h-7 w-7 border-[3px] text-brand-500" />
    {label && <span className="text-sm">{label}</span>}
  </div>
)
export const EmptyState = ({ icon = 'inbox', title, hint }: { icon?: string; title: string; hint?: string }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
    <div className="rounded-full bg-surface-sunken p-4"><Icon name={icon} className="text-[28px] text-ink-faint" /></div>
    <p className="text-sm font-medium text-horizon-text">{title}</p>
    {hint && <p className="max-w-xs text-xs text-horizon-muted">{hint}</p>}
  </div>
)

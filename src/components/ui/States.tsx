import { Icon } from './Icon'
import { LoadingRing } from './LoadingRing'

export const Spinner = ({ label }: { label?: string }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-16 text-ink-soft">
    <LoadingRing className="h-7 w-7 border-[3px] text-brand-500" />
    {label && <span className="text-sm">{label}</span>}
  </div>
)

// Meaningful empty state — an icon, a headline, an optional hint and an
// optional primary action, so a blank screen always tells the user what to do
// next instead of just showing nothing.
export const EmptyState = ({ icon = 'inbox', title, hint, action }: {
  icon?: string; title: string; hint?: string; action?: React.ReactNode
}) => (
  <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
    <div className="mb-1 grid h-14 w-14 place-items-center rounded-2xl bg-surface-sunken ring-1 ring-surface-line">
      <Icon name={icon} className="text-[26px] text-ink-faint" />
    </div>
    <p className="text-sm font-semibold text-ink">{title}</p>
    {hint && <p className="max-w-sm text-xs text-ink-soft">{hint}</p>}
    {action && <div className="mt-3">{action}</div>}
  </div>
)

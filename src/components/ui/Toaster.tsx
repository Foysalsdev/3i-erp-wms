import { useUI } from '@/store/ui'
import { Icon } from './Icon'
import { cn } from '@/lib/utils'

// Each toast is a solid card with a coloured accent bar down the left, a tone
// icon and a soft pop shadow — visible at a glance, not a faint hairline box.
const cfg = {
  success: { icon: 'check_circle', bar: 'bg-ok', fg: 'text-ok' },
  error: { icon: 'error', bar: 'bg-bad', fg: 'text-bad' },
  info: { icon: 'info', bar: 'bg-brand-500', fg: 'text-brand-700' }
} as const

export function Toaster() {
  const { toasts, dismiss } = useUI()
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex w-[min(92vw,26rem)] flex-col gap-2">
      {toasts.map(t => {
        const c = cfg[t.type]
        return (
          <div key={t.id}
            className="animate-fade-up flex items-stretch gap-0 overflow-hidden rounded-xl bg-surface shadow-pop ring-1 ring-surface-line">
            <span className={cn('w-1.5 shrink-0', c.bar)} />
            <div className="flex flex-1 items-start gap-2.5 py-3 pl-3 pr-2.5">
              <Icon name={c.icon} className={cn('mt-px shrink-0 text-[20px]', c.fg)} />
              <span className="flex-1 pt-0.5 text-sm font-medium text-ink">{t.message}</span>
              {t.action && (
                <button onClick={() => { t.action!.onClick(); dismiss(t.id) }}
                  className="shrink-0 pt-0.5 text-sm font-semibold text-brand-700 hover:underline">
                  {t.action.label}
                </button>
              )}
              <button onClick={() => dismiss(t.id)} className="shrink-0 rounded p-0.5 text-ink-faint hover:bg-surface-sunken hover:text-ink">
                <Icon name="close" className="text-[18px]" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

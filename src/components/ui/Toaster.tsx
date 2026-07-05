import { useUI } from '@/store/ui'
import { Icon } from './Icon'
import { cn } from '@/lib/utils'
const icon = { success: 'check_circle', error: 'error', info: 'info' }
const tone = { success: 'border-green-200 text-green-700', error: 'border-red-200 text-red-700', info: 'border-blue-200 text-blue-700' }
export function Toaster() {
  const { toasts, dismiss } = useUI()
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      {toasts.map(t => (
        <div key={t.id} className={cn('flex items-center gap-3 rounded-xl border bg-surface px-4 py-3 text-sm shadow-fiori-lg', tone[t.type])}>
          <Icon name={icon[t.type]} className="text-[20px]" />
          <span className="text-horizon-text">{t.message}</span>
          {t.action && (
            <button onClick={() => { t.action!.onClick(); dismiss(t.id) }} className="font-semibold text-brand-700 hover:underline">
              {t.action.label}
            </button>
          )}
          <button onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-slate-600"><Icon name="close" className="text-[18px]" /></button>
        </div>
      ))}
    </div>
  )
}

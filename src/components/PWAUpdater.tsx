import { useRegisterSW } from 'virtual:pwa-register/react'
import { Icon } from '@/components/ui/Icon'

// Periodically checks for a freshly deployed build and prompts the user to reload.
const UPDATE_CHECK_INTERVAL = 5 * 60 * 1000 // 5 minutes

export function PWAUpdater() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegisteredSW(_swUrl, r) {
      if (r) setInterval(() => { r.update() }, UPDATE_CHECK_INTERVAL)
    }
  })

  if (!needRefresh) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="flex w-full max-w-md items-center gap-3 rounded-xl border border-surface-line bg-surface px-4 py-3 shadow-pop">
        <Icon name="rocket_launch" className="text-[20px] text-brand-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">New version available</p>
          <p className="text-xs text-ink-soft">Reload to get the latest update.</p>
        </div>
        <button onClick={() => setNeedRefresh(false)}
          className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-soft hover:bg-surface-sunken">
          Later
        </button>
        <button onClick={() => updateServiceWorker(true)}
          className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-semibold text-coal-900 hover:bg-brand-400">
          Reload
        </button>
      </div>
    </div>
  )
}

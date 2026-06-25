import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Icon } from '@/components/ui/Icon'
import { OPERATIONS } from '@/features/operations/registry'
import { formatNumber } from '@/lib/utils'

// A notification surfaces something that needs attention right now. With no
// dedicated notifications table, we derive them from the same live operational
// data the dashboard already reads: pending documents per module plus
// low-stock items. Each one is permission-aware and links to its register.
interface Notice {
  id: string
  icon: string
  title: string
  detail: string
  count: number
  to: string
  tone: 'warn' | 'info'
}

// Per-user/client memory of which alert levels the user has already seen, so a
// notification only counts as "unread" when it first appears or its count grows.
type SeenMap = Record<string, number>

function seenKey(uid: string | undefined, clientId: string | null) {
  return `3i_notif_seen:${uid ?? 'anon'}:${clientId ?? 'none'}`
}
function loadSeen(key: string): SeenMap {
  try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} }
}

export function NotificationBell() {
  const { currentClientId, session, can } = useAuth()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notices, setNotices] = useState<Notice[]>([])
  const [seen, setSeen] = useState<SeenMap>({})

  const uid = session?.user.id
  const storeKey = seenKey(uid, currentClientId)

  const load = useCallback(async () => {
    if (!currentClientId) { setNotices([]); return }
    setLoading(true)
    try {
      const items: Notice[] = []

      // Open/pending documents per accessible operational module.
      const opDefs = Object.values(OPERATIONS).filter(def => can(`${def.permission}.view`))
      const counts = await Promise.all(opDefs.map(async def => {
        const { count } = await supabase.from(def.table as any)
          .select('id', { count: 'exact', head: true })
          .eq('client_id', currentClientId)
          .in('status', def.openStatuses)
        return count ?? 0
      }))
      opDefs.forEach((def, i) => {
        const count = counts[i]
        if (count > 0) items.push({
          id: `op:${def.key}`,
          icon: def.icon,
          title: `${formatNumber(count)} pending ${def.title}${count > 1 ? 's' : ''}`,
          detail: 'Awaiting action',
          count,
          to: `/${def.module}/${def.key}`,
          tone: 'warn'
        })
      })

      // Low-stock alert (items at or below their restock level).
      if (can('inventory.view')) {
        const [{ data: products }, { data: stock }] = await Promise.all([
          supabase.from('products').select('id, restock_level').eq('client_id', currentClientId),
          supabase.from('inventory_stock').select('product_id, quantity').eq('client_id', currentClientId)
        ])
        const perProduct: Record<string, number> = {}
        ;(stock ?? []).forEach((s: any) => { perProduct[s.product_id] = (perProduct[s.product_id] ?? 0) + Number(s.quantity) })
        const low = (products ?? []).filter((p: any) => (perProduct[p.id] ?? 0) <= Number(p.restock_level)).length
        if (low > 0) items.push({
          id: 'lowstock',
          icon: 'warning',
          title: `${formatNumber(low)} item${low > 1 ? 's' : ''} below restock level`,
          detail: 'Reorder recommended',
          count: low,
          to: '/inventory/stock',
          tone: 'warn'
        })
      }

      setNotices(items)
    } finally {
      setLoading(false)
    }
  }, [currentClientId, can])

  // Refresh alerts and the seen-map whenever the active client changes.
  useEffect(() => { setSeen(loadSeen(storeKey)); load() }, [storeKey, load])

  const unread = notices.filter(n => n.count > (seen[n.id] ?? 0))
  const markAllRead = () => {
    const next: SeenMap = {}
    notices.forEach(n => { next[n.id] = n.count })
    localStorage.setItem(storeKey, JSON.stringify(next))
    setSeen(next)
  }

  const go = (to: string) => { setOpen(false); nav(to) }

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(o => !o); if (!open) load() }}
        title="Notifications"
        className="relative rounded-lg p-2 text-ink-soft hover:bg-surface-sunken"
      >
        <Icon name="notifications" />
        {unread.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-surface">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-xl bg-surface shadow-pop ring-1 ring-surface-line">
            <div className="flex items-center justify-between border-b border-surface-line px-4 py-2.5">
              <p className="text-sm font-semibold text-ink">Notifications</p>
              {notices.length > 0 && unread.length > 0 && (
                <button onClick={markAllRead} className="text-[11px] font-semibold text-brand-600 hover:underline">Mark all read</button>
              )}
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-ink-soft">
                  <Icon name="progress_activity" className="animate-spin text-[18px] text-brand-500" /> Loading…
                </div>
              ) : notices.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                  <div className="rounded-full bg-surface-sunken p-3"><Icon name="notifications_off" className="text-[22px] text-ink-faint" /></div>
                  <p className="text-sm font-medium text-ink">You're all caught up</p>
                  <p className="text-xs text-ink-soft">No pending tasks or alerts right now.</p>
                </div>
              ) : (
                <ul className="divide-y divide-surface-line">
                  {notices.map(n => {
                    const isUnread = n.count > (seen[n.id] ?? 0)
                    return (
                      <li key={n.id}>
                        <button onClick={() => go(n.to)}
                          className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-surface-sunken">
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                            <Icon name={n.icon} className="text-[18px]" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-ink">{n.title}</span>
                            <span className="block text-xs text-ink-soft">{n.detail}</span>
                          </span>
                          {isUnread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

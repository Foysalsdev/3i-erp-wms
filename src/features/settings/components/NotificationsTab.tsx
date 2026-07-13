import { useEffect, useState } from 'react'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { SkeletonText } from '@/components/ui/Skeleton'
import {
  loadSettings, saveSettings, DEFAULT_NOTIFICATIONS, type NotificationSettings
} from '@/lib/settings'

const ROWS: { key: keyof NotificationSettings; icon: string; label: string; hint: string }[] = [
  { key: 'pendingDocs', icon: 'pending_actions', label: 'Pending documents', hint: 'Open GRNs, pick lists, transport requests and other documents awaiting action.' },
  { key: 'overdueOrders', icon: 'schedule', label: 'Overdue sales orders', hint: 'Sales orders past their expected completion date.' },
  { key: 'awaitingApproval', icon: 'how_to_reg', label: 'Orders awaiting approval', hint: 'New sales orders that must be approved before the warehouse can pick them.' },
  { key: 'awaitingPick', icon: 'shopping_cart_checkout', label: 'Orders awaiting pick & scan', hint: 'Approved orders that are ready to be picked.' },
  { key: 'lowStock', icon: 'warning', label: 'Low-stock alerts', hint: 'Products at or below their restock level.' }
]

function Toggle({ on, disabled, onChange }: { on: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-600'} disabled:opacity-50`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

// Controls which alert families surface in the topbar notification bell.
export function NotificationsTab({ canEdit }: { canEdit: boolean }) {
  const { currentClientId } = useAuth()
  const notify = useUI(s => s.notify)
  const [form, setForm] = useState<NotificationSettings>(DEFAULT_NOTIFICATIONS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!currentClientId) return
    setLoading(true)
    loadSettings<NotificationSettings>(currentClientId, 'notifications').then(c => { setForm(c); setLoading(false) })
  }, [currentClientId])

  const save = async () => {
    if (!currentClientId) return
    setSaving(true)
    try {
      await saveSettings(currentClientId, 'notifications', form)
      notify('success', 'Notification settings saved')
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not save notification settings')
    } finally { setSaving(false) }
  }

  if (loading) return <Card className="p-5"><SkeletonText lines={6} /></Card>

  return (
    <Card className="p-5">
      <p className="mb-4 text-sm text-ink-soft">Choose which alerts appear in the notification bell. Disabled alerts are hidden for every user of this client.</p>
      <ul className="divide-y divide-surface-line">
        {ROWS.map(r => (
          <li key={r.key} className="flex items-center gap-4 py-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"><Icon name={r.icon} className="text-[20px]" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{r.label}</p>
              <p className="text-xs text-ink-soft">{r.hint}</p>
            </div>
            <Toggle on={form[r.key]} disabled={!canEdit} onChange={() => setForm(f => ({ ...f, [r.key]: !f[r.key] }))} />
          </li>
        ))}
      </ul>
      {canEdit && (
        <div className="mt-5 flex justify-end border-t border-surface-line pt-4">
          <Button icon="save" loading={saving} onClick={save}>Save Notification Settings</Button>
        </div>
      )}
    </Card>
  )
}

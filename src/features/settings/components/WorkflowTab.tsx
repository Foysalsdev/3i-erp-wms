import { useEffect, useState } from 'react'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/States'
import { OUTBOUND_STAGES, setWorkflowSla } from '@/features/outbound/workflow'
import {
  loadSettings, saveSettings, DEFAULT_WORKFLOW, type WorkflowSettings
} from '@/lib/settings'

// SLA (days) allowed per outbound workflow stage. Drives the "expected
// completion" and "overdue" logic on sales orders and the notification bell.
export function WorkflowTab({ canEdit }: { canEdit: boolean }) {
  const { currentClientId } = useAuth()
  const notify = useUI(s => s.notify)
  const [sla, setSla] = useState<Record<string, number>>(
    Object.fromEntries(DEFAULT_WORKFLOW.stages.map(s => [s.key, s.slaDays])))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!currentClientId) return
    setLoading(true)
    loadSettings<WorkflowSettings>(currentClientId, 'workflow').then(wf => {
      setSla(Object.fromEntries(wf.stages.map(s => [s.key, s.slaDays])))
      setLoading(false)
    })
  }, [currentClientId])

  const total = OUTBOUND_STAGES.reduce((sum, st) => sum + (Number(sla[st.key]) || 0), 0)

  const save = async () => {
    if (!currentClientId) return
    setSaving(true)
    try {
      const payload: WorkflowSettings = { stages: OUTBOUND_STAGES.map(st => ({ key: st.key, slaDays: Number(sla[st.key]) || 0 })) }
      await saveSettings(currentClientId, 'workflow', payload)
      setWorkflowSla(Object.fromEntries(payload.stages.map(s => [s.key, s.slaDays])))  // live refresh
      notify('success', 'Workflow SLAs saved')
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not save workflow settings')
    } finally { setSaving(false) }
  }

  if (loading) return <Card className="p-2"><Spinner label="Loading…" /></Card>

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-soft">Set the target days for each stage of the outbound order workflow. An order with no explicit required date is expected to complete within the total SLA.</p>
        <span className="rounded-lg bg-surface-sunken px-3 py-1.5 text-sm font-semibold text-ink">Total SLA: {total} day{total === 1 ? '' : 's'}</span>
      </div>
      <ul className="space-y-2">
        {OUTBOUND_STAGES.map((st, i) => (
          <li key={st.key} className="flex items-center gap-3 rounded-lg border border-surface-line px-3 py-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Icon name={st.icon} className="text-[20px]" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{i + 1}. {st.label}</p>
              <p className="truncate text-xs text-ink-soft">{st.action} · {st.role}</p>
            </div>
            <div className="flex items-center gap-2">
              <Input type="number" min={0} className="w-20 text-right" disabled={!canEdit}
                value={sla[st.key] ?? 0}
                onChange={e => setSla(s => ({ ...s, [st.key]: Number(e.target.value) }))} />
              <span className="text-xs text-ink-soft">days</span>
            </div>
          </li>
        ))}
      </ul>
      {canEdit && (
        <div className="mt-5 flex justify-end border-t border-surface-line pt-4">
          <Button icon="save" loading={saving} onClick={save}>Save Workflow SLAs</Button>
        </div>
      )}
    </Card>
  )
}

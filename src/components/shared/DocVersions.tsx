import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTimeline } from '@/hooks/useTimeline'
import { Icon } from '@/components/ui/Icon'
import { Badge } from '@/components/ui/Badge'
import { formatDateTime } from '@/lib/utils'
import type { Tables, Json } from '@/types/database.types'

// WES principle #8 "Version Controlled": every save of a document is preserved
// as an immutable, numbered version (reconstructed from audit_logs, which stores
// a full row snapshot on every write — nothing is ever overwritten). Old
// versions stay viewable for audit.

type AuditLog = Tables<'audit_logs'>

const SKIP = new Set(['updated_at', 'created_at', 'id', 'client_id', 'created_by'])
const show = (v: Json | undefined) => v === null || v === undefined || v === '' ? '—' : String(v)
const label = (f: string) => f.replace(/_id$/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

function snapshot(row: AuditLog): Record<string, Json> {
  const data = ((row.action === 'DELETE' ? row.old_data : row.new_data) || {}) as Record<string, Json>
  const out: Record<string, Json> = {}
  Object.keys(data).forEach(k => { if (!SKIP.has(k)) out[k] = data[k] })
  return out
}

export function DocVersions({ table, recordId }: { table: string; recordId?: string }) {
  const { rows, loading } = useTimeline(table, recordId)
  const [names, setNames] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<number | null>(null)

  useEffect(() => {
    supabase.from('profiles').select('id,full_name').then(({ data }) => {
      const m: Record<string, string> = {}; (data ?? []).forEach(r => { m[r.id] = r.full_name || '—' }); setNames(m)
    })
  }, [])

  const versions = [...rows].reverse() // oldest first → version 1, 2, 3 …

  if (loading) return <p className="rounded-xl border border-surface-line p-3.5 text-sm text-ink-faint">Loading versions…</p>
  if (versions.length === 0) return <p className="rounded-xl border border-surface-line p-3.5 text-sm text-ink-faint">No versions yet.</p>

  return (
    <div className="overflow-hidden rounded-xl border border-surface-line">
      {versions.map((e, i) => {
        const isCurrent = i === versions.length - 1 && e.action !== 'DELETE'
        const snap = snapshot(e)
        const opened = open === i
        const action = e.action === 'INSERT' ? 'Created' : e.action === 'DELETE' ? 'Deleted' : 'Edited'
        return (
          <div key={e.id} className={i ? 'border-t border-surface-line' : ''}>
            <button type="button" onClick={() => setOpen(opened ? null : i)}
              className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm hover:bg-surface-sunken">
              <span className="flex h-7 w-12 shrink-0 items-center justify-center rounded-md bg-surface-sunken font-mono text-xs font-semibold text-ink">v{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-medium text-ink">{action}{isCurrent && <Badge tone="positive">Current</Badge>}</span>
                <span className="block text-[11px] text-ink-faint">{formatDateTime(e.changed_at)} · by {names[e.changed_by ?? ''] ?? '—'}</span>
              </span>
              <Icon name={opened ? 'expand_less' : 'expand_more'} className="text-[18px] text-ink-faint" />
            </button>
            {opened && (
              <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 bg-surface-sunken/40 px-3.5 py-3 sm:grid-cols-2">
                {Object.keys(snap).length === 0 ? <p className="text-xs text-ink-faint">No stored fields.</p> :
                  Object.entries(snap).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 text-xs">
                      <span className="text-ink-faint">{label(k)}</span>
                      <span className="truncate text-right font-medium text-ink">{show(v)}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

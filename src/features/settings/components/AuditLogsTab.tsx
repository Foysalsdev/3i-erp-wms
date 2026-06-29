import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useCollection } from '@/hooks/useCollection'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Field'
import { SearchBar } from '@/components/shared/SearchBar'
import { formatDateTime } from '@/lib/utils'

const actionTone = (a: string) => a === 'INSERT' ? 'positive' : a === 'DELETE' ? 'negative' : 'info'

// Read-only viewer over the generic public.audit_logs trail (every master /
// transaction insert/update/delete with before & after snapshots).
export function AuditLogsTab() {
  const { data, loading } = useCollection('audit_logs', { order: 'changed_at' })
  const { currentClientId } = useAuth()
  const [q, setQ] = useState('')
  const [action, setAction] = useState('')
  const [table, setTable] = useState('')
  const [detail, setDetail] = useState<any>(null)
  const [people, setPeople] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!currentClientId) return
    supabase.from('profiles').select('id, full_name, email').then(({ data }) => {
      const m: Record<string, string> = {}
      ;(data ?? []).forEach((p: any) => { m[p.id] = p.full_name || p.email || p.id })
      setPeople(m)
    })
  }, [currentClientId])

  const tables = useMemo(() => Array.from(new Set((data as any[]).map(r => r.table_name))).sort(), [data])

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (data as any[]).filter(r =>
      (!action || r.action === action) &&
      (!table || r.table_name === table) &&
      (!t || String(r.table_name).toLowerCase().includes(t) || String(r.record_id).toLowerCase().includes(t)))
  }, [data, q, action, table])

  const columns = [
    { key: 'changed_at', header: 'When', render: (r: any) => formatDateTime(r.changed_at), sortable: true },
    { key: 'table_name', header: 'Table', accessor: (r: any) => r.table_name, className: 'font-medium' },
    { key: 'action', header: 'Action', render: (r: any) => <Badge tone={actionTone(r.action)}>{r.action}</Badge> },
    { key: 'record_id', header: 'Record', render: (r: any) => <span className="font-mono text-xs">{String(r.record_id).slice(0, 8)}</span> },
    { key: 'changed_by', header: 'By', render: (r: any) => people[r.changed_by] ?? (r.changed_by ? String(r.changed_by).slice(0, 8) : 'system') }
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-64"><SearchBar value={q} onChange={setQ} placeholder="Search table / record…" /></div>
        <Select value={table} onChange={e => setTable(e.target.value)} className="w-auto">
          <option value="">All tables</option>
          {tables.map(t => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Select value={action} onChange={e => setAction(e.target.value)} className="w-auto">
          <option value="">All actions</option>
          <option value="INSERT">Insert</option>
          <option value="UPDATE">Update</option>
          <option value="DELETE">Delete</option>
        </Select>
        <span className="text-sm text-ink-soft">{rows.length} entries</span>
      </div>

      <Card className="overflow-hidden">
        <DataTable columns={columns} rows={rows} loading={loading} rowKey={(r: any) => r.id}
          onRowClick={(r: any) => setDetail(r)} emptyTitle="No audit entries" />
      </Card>

      {detail && <AuditDetail row={detail} who={people[detail.changed_by]} onClose={() => setDetail(null)} />}
    </div>
  )
}

function AuditDetail({ row, who, onClose }: { row: any; who?: string; onClose: () => void }) {
  const oldD = (row.old_data ?? {}) as Record<string, any>
  const newD = (row.new_data ?? {}) as Record<string, any>
  const keys = Array.from(new Set([...Object.keys(oldD), ...Object.keys(newD)])).sort()
  const fmt = (v: any) => v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)
  const changed = (k: string) => row.action === 'UPDATE' && JSON.stringify(oldD[k]) !== JSON.stringify(newD[k])

  return (
    <Modal open onClose={onClose} title={`${row.action} · ${row.table_name}`} size="lg">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-soft">
          <span>When: <span className="text-ink">{formatDateTime(row.changed_at)}</span></span>
          <span>By: <span className="text-ink">{who ?? (row.changed_by ? String(row.changed_by).slice(0, 8) : 'system')}</span></span>
          <span>Record: <span className="font-mono text-ink">{row.record_id}</span></span>
        </div>
        <div className="overflow-hidden rounded-lg border border-surface-line">
          <table className="w-full text-sm">
            <thead className="bg-surface-sunken text-xs text-ink-faint">
              <tr><th className="px-3 py-2 text-left">Field</th><th className="px-3 py-2 text-left">Before</th><th className="px-3 py-2 text-left">After</th></tr>
            </thead>
            <tbody className="divide-y divide-surface-line">
              {keys.map(k => (
                <tr key={k} className={changed(k) ? 'bg-amber-50/60' : ''}>
                  <td className="px-3 py-1.5 font-medium text-ink">{k}</td>
                  <td className="px-3 py-1.5 text-ink-soft">{row.action === 'INSERT' ? '—' : fmt(oldD[k])}</td>
                  <td className="px-3 py-1.5 text-ink-soft">{row.action === 'DELETE' ? '—' : fmt(newD[k])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  )
}

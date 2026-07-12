import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { useCollection } from '@/hooks/useCollection'
import { OP_RELATIONS, opColumns, type OpDef, type OpFieldDef, type OpRecord } from './registry'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ActionMenu, type MenuItem } from '@/components/ui/ActionMenu'
import { ConfirmDelete } from '@/components/ui/ConfirmDelete'
import { BulkActionBar } from '@/components/ui/BulkActionBar'
import { FilterPanel } from '@/components/ui/FilterPanel'
import { SearchBar } from '@/components/shared/SearchBar'
import { SavedViewsBar } from '@/components/shared/SavedViewsBar'
import { useUrlSearch } from '@/hooks/useUrlSearch'
import { useAutoOpen } from '@/hooks/useAutoOpen'
import { formatDate, cn } from '@/lib/utils'
import { downloadCSV } from '@/lib/csv'
import { TrailPanel } from '@/components/shared/TrailPanel'
import { OperationForm } from './OperationForm'

// Display a field's value for the read-only view / PDF: relations show their
// resolved label, dates are formatted, everything else prints as-is.
const displayValue = (f: OpFieldDef, row: OpRecord): string => {
  if (f.type === 'relation') return row.__rel?.[f.name] ?? '—'
  const v = row[f.name]
  if (v == null || v === '') return '—'
  if (f.type === 'date') return formatDate(String(v))
  return String(v)
}

export function OperationList({ def }: { def: OpDef }) {
  const { data, loading, refresh } = useCollection(def.table, { order: 'created_at' })
  const { can, isPlatformAdmin, currentClientId, clients } = useAuth()
  const clientName = clients.find(c => c.id === currentClientId)?.name ?? ''
  const notify = useUI(s => s.notify)
  const canEdit = can(`${def.permission}.create`) || can(`${def.permission}.edit`)
  const [q, setQ] = useUrlSearch()
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [viewing, setViewing] = useState<any>(null)
  const [deleting, setDeleting] = useState<any>(null)
  const [rel, setRel] = useState<Record<string, Record<string, string>>>({})
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  useAutoOpen(() => { setEditing(null); setModal(true) })

  // Print the document header via the matching PDF template (gate pass / generic).
  const printRow = async (row: OpRecord) => {
    try {
      const meta = [
        { label: `${def.singular} No`, value: String(row[def.numberField] ?? '') },
        ...def.fields.filter(f => f.type !== 'image' && f.type !== 'textarea' && f.name !== 'status')
          .map(f => ({ label: f.label, value: displayValue(f, row) })),
        { label: 'Status', value: String(row.status ?? '') }
      ]
      const docNo = String(row[def.numberField] ?? '')
      if (def.pdf === 'gatepass') {
        const { downloadGatePassPDF } = await import('@/pdf/GatePassPDF')
        await downloadGatePassPDF({ client: clientName, docNo, meta, lines: [] })
      } else {
        const { downloadDocPDF } = await import('@/pdf/DocumentPDF')
        await downloadDocPDF({ client: clientName, title: def.title, docNo, meta, lines: [] })
      }
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not generate PDF')
    }
  }

  // Resolve id -> label maps for relation columns.
  useEffect(() => {
    if (!currentClientId) return
    def.fields.filter(f => f.relation).forEach(async f => {
      const r = OP_RELATIONS[f.relation!]
      const cols = ['id', r.code, r.name].filter(Boolean).join(', ')
      const { data } = await supabase.from(r.table as any).select(cols).eq('client_id', currentClientId) as { data: Record<string, string>[] | null }
      const m: Record<string, string> = {}
      ;(data ?? []).forEach(row => { m[row.id] = r.name ? `${row[r.code]}${row[r.name] ? ' — ' + row[r.name] : ''}` : row[r.code] })
      setRel(prev => ({ ...prev, [f.name]: m }))
    })
  }, [def, currentClientId])

  const rows = useMemo(() => {
    const withRel: OpRecord[] = (data as unknown as OpRecord[]).map(row => ({
      ...row,
      __rel: Object.fromEntries(def.fields.filter(f => f.relation).map(f => [f.name, rel[f.name]?.[String(row[f.name])] ?? '—']))
    }))
    let out = statusFilter.length ? withRel.filter(r => statusFilter.includes(r.status ?? '')) : withRel
    if (dateFrom) { const from = new Date(dateFrom); out = out.filter(r => new Date(r.created_at ?? 0) >= from) }
    if (dateTo) { const to = new Date(dateTo); to.setHours(23, 59, 59, 999); out = out.filter(r => new Date(r.created_at ?? 0) <= to) }
    if (!q.trim()) return out
    const t = q.toLowerCase()
    return out.filter(r => def.searchFields.some(f => String(r[f] ?? '').toLowerCase().includes(t)))
  }, [data, rel, q, statusFilter, dateFrom, dateTo, def])

  const rowActions = (row: OpRecord): MenuItem[] => [
    { icon: 'visibility', label: 'View', onClick: () => setViewing(row) },
    ...(def.pdf ? [{ icon: 'print', label: 'Print', onClick: () => printRow(row) }] : []),
    ...(canEdit ? [{ icon: 'edit', label: 'Edit', onClick: () => { setEditing(row); setModal(true) } }] : []),
    ...(isPlatformAdmin ? [{ icon: 'delete', label: 'Delete', tone: '!text-bad hover:!text-bad hover:!bg-bad/10', onClick: () => setDeleting(row) }] : [])
  ]

  const actionCol: Column<any> = {
    key: '__actions', header: '', className: 'w-px whitespace-nowrap',
    render: (row: OpRecord) => (
      <div className="flex justify-end" onClick={e => e.stopPropagation()}>
        <ActionMenu items={rowActions(row)} />
      </div>
    )
  }
  const baseColumns = opColumns(def)
  const columns = [...baseColumns, actionCol]

  // Only ids still present in the current filter count toward the bulk bar —
  // a stale checked id from a deleted/filtered-out row is simply dropped.
  const selectedRows = rows.filter(r => checked.has(r.id))

  const toggleOne = (id: string) => setChecked(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const toggleAll = (ids: string[]) => setChecked(prev => {
    const allIn = ids.every(id => prev.has(id))
    const next = new Set(prev)
    ids.forEach(id => allIn ? next.delete(id) : next.add(id))
    return next
  })

  const exportSelected = () => {
    const cols = baseColumns.map(c => ({ key: c.key, header: c.header }))
    const csvRows = selectedRows.map(r => Object.fromEntries(baseColumns.map(c => [c.key, c.accessor?.(r) ?? (r[c.key] as string | number | null | undefined) ?? ''])))
    downloadCSV(`${def.title} (selected)`, cols, csvRows)
  }

  const bulkDelete = async () => {
    const ids = selectedRows.map(r => r.id)
    const res = await supabase.from(def.table as any).delete().in('id', ids)
    if (!res.error) { setChecked(new Set()); refresh() }
    return res
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-72"><SearchBar value={q} onChange={setQ} placeholder={`Search ${def.singular.toLowerCase()}…`} /></div>
        <FilterPanel activeCount={(statusFilter.length ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0)}
          onClear={() => { setStatusFilter([]); setDateFrom(''); setDateTo('') }}>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Status</label>
            <div className="flex flex-wrap gap-1.5">
              {def.statuses.map(s => {
                const on = statusFilter.includes(s.value)
                return (
                  <button key={s.value} type="button"
                    onClick={() => setStatusFilter(prev => on ? prev.filter(v => v !== s.value) : [...prev, s.value])}
                    className={cn('rounded-md px-2 py-1 text-xs font-medium', on ? 'bg-brand-500/15 text-brand-700' : 'bg-surface-sunken text-ink-soft hover:text-ink')}>
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft">From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="fiori-input py-1.5 text-xs" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft">To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="fiori-input py-1.5 text-xs" />
            </div>
          </div>
        </FilterPanel>
        <span className="text-sm text-ink-soft">{rows.length} records</span>
        {canEdit && <Button className="ml-auto" icon="add" onClick={() => { setEditing(null); setModal(true) }}>New {def.singular}</Button>}
      </div>

      <SavedViewsBar scope={`ops:${def.key}`} current={{ q, statusFilter, dateFrom, dateTo }}
        onApply={s => { setQ(s.q ?? ''); setStatusFilter(s.statusFilter ?? []); setDateFrom(s.dateFrom ?? ''); setDateTo(s.dateTo ?? '') }} />

      <BulkActionBar count={selectedRows.length} onClear={() => setChecked(new Set())} actions={[
        { icon: 'download', label: 'Export CSV', onClick: exportSelected },
        ...(isPlatformAdmin ? [{ icon: 'delete', label: 'Delete', tone: '!text-bad hover:!text-bad hover:!bg-bad/10', onClick: () => setBulkDeleting(true) }] : [])
      ]} />

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DataTable fill columns={columns} rows={rows} loading={loading} rowKey={r => r.id}
          onRowClick={canEdit ? (r => { setEditing(r); setModal(true) }) : (r => setViewing(r))}
          emptyTitle={`No ${def.singular.toLowerCase()} records yet`}
          selection={{ selected: checked, onToggle: toggleOne, onToggleAll: toggleAll }} />
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={`${editing ? 'Edit' : 'New'} ${def.singular}`} size="lg">
        <OperationForm def={def} record={editing} onCancel={() => setModal(false)}
          onDone={() => { setModal(false); refresh() }} />
      </Modal>

      {viewing && (
        <Modal open onClose={() => setViewing(null)} title={`${def.singular} — ${viewing[def.numberField] ?? ''}`} size="md">
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-surface-line bg-surface-sunken/40 p-4 sm:grid-cols-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{def.singular} No</p>
                <p className="mt-0.5 text-sm font-medium text-ink break-words">{viewing[def.numberField] ?? '—'}</p>
              </div>
              {def.fields.filter(f => f.type !== 'image').map(f => (
                <div key={f.name} className={'min-w-0' + (f.type === 'textarea' ? ' col-span-2 sm:col-span-3' : '')}>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{f.label}</p>
                  {f.name === 'status'
                    ? <div className="mt-0.5"><Badge tone={def.statuses.find(s => s.value === viewing.status)?.tone ?? 'neutral'}>{def.statuses.find(s => s.value === viewing.status)?.label ?? viewing.status}</Badge></div>
                    : <p className="mt-0.5 text-sm font-medium text-ink break-words">{displayValue(f, viewing)}</p>}
                </div>
              ))}
            </div>

            {def.fields.filter(f => f.type === 'image' && viewing[f.name]).map(f => (
              <div key={f.name}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{f.label}</p>
                <img src={viewing[f.name]} alt={f.label} className="max-h-72 rounded-lg border border-surface-line object-contain" />
              </div>
            ))}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Activity & stock movement</p>
              <TrailPanel table={def.table} recordId={viewing.id} referenceNo={viewing[def.numberField]} />
            </div>

            <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
              <Button variant="ghost" onClick={() => setViewing(null)}>Close</Button>
              {def.pdf && <Button variant="secondary" icon="print" onClick={() => printRow(viewing)}>Print</Button>}
              {canEdit && <Button icon="edit" onClick={() => { const r = viewing; setViewing(null); setEditing(r); setModal(true) }}>Edit</Button>}
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDelete open={!!deleting} onClose={() => setDeleting(null)}
        name={deleting ? `${def.singular} · ${deleting[def.numberField]}` : undefined}
        onConfirm={async () => {
          const res = await supabase.from(def.table as any).delete().eq('id', deleting.id)
          if (!res.error) { setDeleting(null); refresh() }
          return res
        }}
        onUndo={deleting ? async () => {
          const { __rel, ...clean } = deleting
          const { error } = await supabase.from(def.table as any).insert(clean)
          if (error) notify('error', `Could not undo: ${error.message}`)
          else { notify('success', `${def.singular} restored`); refresh() }
        } : undefined} />

      <ConfirmDelete open={bulkDeleting} onClose={() => setBulkDeleting(false)}
        name={`${selectedRows.length} ${def.singular.toLowerCase()}`}
        onConfirm={bulkDelete}
        onUndo={selectedRows.length ? async () => {
          const clean = selectedRows.map(({ __rel, ...r }) => r)
          const { error } = await supabase.from(def.table as any).insert(clean)
          if (error) notify('error', `Could not undo: ${error.message}`)
          else { notify('success', `${selectedRows.length} ${def.singular.toLowerCase()} restored`); refresh() }
        } : undefined} />
    </div>
  )
}

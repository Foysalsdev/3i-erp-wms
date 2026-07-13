import { useMemo, useState } from 'react'
import type { MasterDef, MasterRecord } from '../registry'

const str = (v: unknown) => (v == null ? '' : String(v))
import { useRelationLabels, fieldDisplay } from '../masterUtils'
import { useCollection } from '@/hooks/useCollection'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import { Badge } from '@/components/ui/Badge'
import { ActionMenu, type MenuItem } from '@/components/ui/ActionMenu'
import { ConfirmDelete } from '@/components/ui/ConfirmDelete'
import { BulkActionBar } from '@/components/ui/BulkActionBar'
import { SearchBar } from '@/components/shared/SearchBar'
import { initials, cn } from '@/lib/utils'
import { downloadCSV } from '@/lib/csv'
import { useAutoOpen } from '@/hooks/useAutoOpen'
import { MasterForm } from './MasterForm'
import { MasterProfile } from './MasterProfile'
import { CustomerAddresses } from './CustomerAddresses'

export function MasterList({ def }: { def: MasterDef }) {
  const { data, loading, refresh } = useCollection<typeof def.table, MasterRecord>(def.table, { order: 'created_at' })
  const can = useAuth(s => s.can)
  const { clients, currentClientId } = useAuth()
  const isAdmin = useAuth(s => s.isPlatformAdmin)
  const notify = useUI(s => s.notify)
  const rel = useRelationLabels(def)
  const canEdit = can('masters.create') || can('masters.edit')
  const [view, setView] = useState<'list' | 'card'>('list')
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<MasterRecord | null>(null)
  const [selected, setSelected] = useState<{ row: MasterRecord; tab: string } | null>(null)
  const [deleting, setDeleting] = useState<MasterRecord | null>(null)
  const [addressesFor, setAddressesFor] = useState<MasterRecord | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const clientName = clients.find(c => c.id === currentClientId)?.name ?? ''
  useAutoOpen(() => { setEditing(null); setModal(true) })

  const filtered = useMemo(() => {
    if (!q.trim()) return data
    const t = q.toLowerCase()
    return data.filter(r => def.searchFields.some(f => String(r[f] ?? '').toLowerCase().includes(t)))
  }, [data, q, def])

  // Only ids still present in the current filter count toward the bulk bar —
  // a stale checked id from a deleted/filtered-out row is simply dropped.
  const selectedRows = filtered.filter(r => checked.has(r.id))

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
    const cols = def.listColumns.map(c => ({ key: c.key, header: c.header }))
    const csvRows = selectedRows.map(r => Object.fromEntries(def.listColumns.map(c => [c.key, c.accessor?.(r) ?? (r[c.key] as string | number | null | undefined) ?? ''])))
    downloadCSV(`${def.title} (selected)`, cols, csvRows)
  }

  const bulkDelete = async () => {
    const ids = selectedRows.map(r => r.id)
    const res = await supabase.from(def.table as any).delete().in('id', ids)
    if (!res.error) { setChecked(new Set()); refresh() }
    return res
  }

  const printRecord = async (row: MasterRecord) => {
    try {
      const fields = def.fields.filter(f => f.type !== 'image').map(f => ({ label: f.label, value: fieldDisplay(def, row, f.name, rel) }))
      const { downloadRecordPDF } = await import('@/pdf/RecordPDF')
      await downloadRecordPDF({
        client: clientName, title: str(row[def.nameField]), code: `${def.singular} · ${str(row[def.codeField])}`,
        photo: def.imageField ? str(row[def.imageField]) || undefined : undefined, fields
      })
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not generate PDF')
    }
  }

  // The edit/create form modal — rendered in both list and profile views so
  // Edit works from the profile (early-returned) view too.
  const editModal = (
    <Modal open={modal} onClose={() => setModal(false)} title={`${editing ? 'Edit' : 'New'} ${def.singular}`} size="lg">
      <MasterForm def={def} record={editing} onCancel={() => setModal(false)}
        onDone={() => { setModal(false); refresh() }} />
    </Modal>
  )

  if (selected) {
    const fresh = data.find(r => r.id === selected.row.id) ?? selected.row
    return (
      <>
        <MasterProfile def={def} record={fresh} canEdit={canEdit} initialTab={selected.tab}
          onBack={() => setSelected(null)}
          onEdit={() => { setEditing(fresh); setModal(true) }} />
        {editModal}
      </>
    )
  }

  const rowActions = (row: MasterRecord): MenuItem[] => [
    { icon: 'visibility', label: 'View', onClick: () => setSelected({ row, tab: 'details' }) },
    ...(canEdit ? [{ icon: 'edit', label: 'Edit', onClick: () => { setEditing(row); setModal(true) } }] : []),
    ...(def.key === 'customers' ? [{ icon: 'location_on', label: 'Addresses', onClick: () => setAddressesFor(row) }] : []),
    { icon: 'print', label: 'Print', onClick: () => printRecord(row) },
    { icon: 'comment', label: 'Comment', onClick: () => setSelected({ row, tab: 'notes' }) },
    // Delete is restricted to platform admins only.
    ...(isAdmin ? [{ icon: 'delete', label: 'Delete', tone: '!text-bad hover:!text-bad hover:!bg-bad/10', onClick: () => setDeleting(row) }] : [])
  ]

  const actionCol: Column<MasterRecord> = {
    key: '__actions', header: 'Action', className: 'w-px whitespace-nowrap',
    render: (row: MasterRecord) => (
      <div className="flex items-center justify-end" onClick={e => e.stopPropagation()}>
        <ActionMenu items={rowActions(row)} />
      </div>
    )
  }

  const thumbCol: Column<MasterRecord> | null = def.imageField ? {
    key: '__thumb', header: '', className: 'w-px',
    render: (row: MasterRecord) => {
      const img = str(row[def.imageField!])
      return <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-surface-sunken text-[11px] font-semibold text-ink-faint ring-1 ring-surface-line">
        {img ? <img src={img} className="h-full w-full object-cover" /> : initials(str(row[def.nameField]))}
      </div>
    }
  } : null

  const columns = [...(thumbCol ? [thumbCol] : []), ...def.listColumns, actionCol]

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-72"><SearchBar value={q} onChange={setQ} placeholder={`Search ${def.title.toLowerCase()}…`} /></div>
        <div className="flex rounded-lg border border-surface-line p-0.5">
          {(['list', 'card'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={cn('rounded-md p-1.5', view === v ? 'bg-brand-50 text-brand-700' : 'text-ink-faint')}>
              <Icon name={v === 'list' ? 'view_list' : 'grid_view'} className="text-[18px]" />
            </button>
          ))}
        </div>
        <span className="text-sm text-ink-soft">{filtered.length} records</span>
        {canEdit && <Button className="ml-auto" icon="add" onClick={() => { setEditing(null); setModal(true) }}>New {def.singular}</Button>}
      </div>

      {view === 'list' && (
        <BulkActionBar count={selectedRows.length} onClear={() => setChecked(new Set())} actions={[
          { icon: 'download', label: 'Export CSV', onClick: exportSelected },
          ...(isAdmin ? [{ icon: 'delete', label: 'Delete', tone: '!text-bad hover:!text-bad hover:!bg-bad/10', onClick: () => setBulkDeleting(true) }] : [])
        ]} />
      )}

      {view === 'list' ? (
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DataTable columns={columns} rows={filtered} loading={loading} fill
            rowKey={r => r.id} onRowClick={r => setSelected({ row: r, tab: 'details' })} rowMenu={rowActions} emptyTitle={`No ${def.title.toLowerCase()} yet`}
            selection={{ selected: checked, onToggle: toggleOne, onToggleAll: toggleAll }} />
        </Card>
      ) : (
        <div className="grid min-h-0 flex-1 gap-3 overflow-auto sm:grid-cols-2 lg:grid-cols-3 content-start">
          {filtered.map(r => {
            const img = def.imageField ? str(r[def.imageField]) : ''
            return (
              <Card key={r.id} className="p-4 transition hover:shadow-card">
                <div className="flex items-start gap-3">
                  <button className="flex flex-1 items-start gap-3 text-left" onClick={() => setSelected({ row: r, tab: 'details' })}>
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-surface-sunken font-bold text-ink-soft ring-1 ring-surface-line">
                      {img ? <img src={img} className="h-full w-full object-cover" /> : initials(str(r[def.nameField]))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">{str(r[def.nameField])}</p>
                      <p className="truncate text-xs text-ink-soft">{str(r[def.codeField])}</p>
                      <div className="mt-2"><Badge tone={['active', 'in_use'].includes(r.status ?? '') ? 'positive' : 'neutral'}>{r.status}</Badge></div>
                    </div>
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-end border-t border-surface-line pt-2" onClick={e => e.stopPropagation()}>
                  <ActionMenu items={rowActions(r)} />
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {editModal}

      {addressesFor && <CustomerAddresses customer={addressesFor} onClose={() => setAddressesFor(null)} />}

      <ConfirmDelete open={!!deleting} onClose={() => setDeleting(null)}
        name={deleting ? `${def.singular} · ${deleting[def.nameField]}` : undefined}
        onConfirm={async () => {
          const res = await supabase.from(def.table as any).delete().eq('id', deleting!.id)
          if (!res.error) { setDeleting(null); refresh() }
          return res
        }}
        onUndo={deleting ? async () => {
          const { error } = await supabase.from(def.table as any).insert(deleting)
          if (error) notify('error', `Could not undo: ${error.message}`)
          else { notify('success', `${deleting[def.nameField]} restored`); refresh() }
        } : undefined} />

      <ConfirmDelete open={bulkDeleting} onClose={() => setBulkDeleting(false)}
        name={`${selectedRows.length} ${def.title.toLowerCase()}`}
        onConfirm={bulkDelete}
        onUndo={selectedRows.length ? async () => {
          const { error } = await supabase.from(def.table as any).insert(selectedRows)
          if (error) notify('error', `Could not undo: ${error.message}`)
          else { notify('success', `${selectedRows.length} ${def.title.toLowerCase()} restored`); refresh() }
        } : undefined} />
    </div>
  )
}

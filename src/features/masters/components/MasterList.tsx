import { useMemo, useState } from 'react'
import type { MasterDef } from '../registry'
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
import { SearchBar } from '@/components/shared/SearchBar'
import { initials, cn } from '@/lib/utils'
import { MasterForm } from './MasterForm'
import { MasterProfile } from './MasterProfile'

export function MasterList({ def }: { def: MasterDef }) {
  const { data, loading, refresh } = useCollection(def.table, { order: 'created_at' })
  const can = useAuth(s => s.can)
  const { clients, currentClientId } = useAuth()
  const isAdmin = useAuth(s => s.isPlatformAdmin)
  const notify = useUI(s => s.notify)
  const rel = useRelationLabels(def)
  const canEdit = can('masters.create') || can('masters.edit')
  const [view, setView] = useState<'list' | 'card'>('list')
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [selected, setSelected] = useState<{ row: any; tab: string } | null>(null)
  const [deleting, setDeleting] = useState<any>(null)
  const clientName = clients.find(c => c.id === currentClientId)?.name ?? ''

  const filtered = useMemo(() => {
    if (!q.trim()) return data
    const t = q.toLowerCase()
    return data.filter((r: any) => def.searchFields.some(f => String(r[f] ?? '').toLowerCase().includes(t)))
  }, [data, q, def])

  const printRecord = async (row: any) => {
    try {
      const fields = def.fields.filter(f => f.type !== 'image').map(f => ({ label: f.label, value: fieldDisplay(def, row, f.name, rel) }))
      const { downloadRecordPDF } = await import('@/pdf/RecordPDF')
      await downloadRecordPDF({
        client: clientName, title: row[def.nameField], code: `${def.singular} · ${row[def.codeField]}`,
        photo: def.imageField ? row[def.imageField] : undefined, fields
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
    const fresh = data.find((r: any) => r.id === selected.row.id) ?? selected.row
    return (
      <>
        <MasterProfile def={def} record={fresh} canEdit={canEdit} initialTab={selected.tab}
          onBack={() => setSelected(null)}
          onEdit={() => { setEditing(fresh); setModal(true) }} />
        {editModal}
      </>
    )
  }

  const rowActions = (row: any): MenuItem[] => [
    { icon: 'visibility', label: 'View', onClick: () => setSelected({ row, tab: 'details' }) },
    ...(canEdit ? [{ icon: 'edit', label: 'Edit', onClick: () => { setEditing(row); setModal(true) } }] : []),
    { icon: 'print', label: 'Print', onClick: () => printRecord(row) },
    { icon: 'comment', label: 'Comment', onClick: () => setSelected({ row, tab: 'notes' }) },
    // Delete is restricted to platform admins only.
    ...(isAdmin ? [{ icon: 'delete', label: 'Delete', tone: '!text-bad hover:!text-bad hover:!bg-bad/10', onClick: () => setDeleting(row) }] : [])
  ]

  const actionCol: Column<any> = {
    key: '__actions', header: 'Action', className: 'w-px whitespace-nowrap',
    render: (row: any) => (
      <div className="flex items-center justify-end" onClick={e => e.stopPropagation()}>
        <ActionMenu items={rowActions(row)} />
      </div>
    )
  }

  const thumbCol: Column<any> | null = def.imageField ? {
    key: '__thumb', header: '', className: 'w-px',
    render: (row: any) => {
      const img = row[def.imageField!]
      return <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-surface-sunken text-[11px] font-semibold text-ink-faint ring-1 ring-surface-line">
        {img ? <img src={img} className="h-full w-full object-cover" /> : initials(row[def.nameField])}
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

      {view === 'list' ? (
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DataTable columns={columns} rows={filtered} loading={loading} fill
            rowKey={(r: any) => r.id} onRowClick={r => setSelected({ row: r, tab: 'details' })} emptyTitle={`No ${def.title.toLowerCase()} yet`} />
        </Card>
      ) : (
        <div className="grid min-h-0 flex-1 gap-3 overflow-auto sm:grid-cols-2 lg:grid-cols-3 content-start">
          {filtered.map((r: any) => {
            const img = def.imageField ? r[def.imageField] : null
            return (
              <Card key={r.id} className="p-4 transition hover:shadow-card">
                <div className="flex items-start gap-3">
                  <button className="flex flex-1 items-start gap-3 text-left" onClick={() => setSelected({ row: r, tab: 'details' })}>
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-surface-sunken font-bold text-ink-soft ring-1 ring-surface-line">
                      {img ? <img src={img} className="h-full w-full object-cover" /> : initials(r[def.nameField])}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">{r[def.nameField]}</p>
                      <p className="truncate text-xs text-ink-soft">{r[def.codeField]}</p>
                      <div className="mt-2"><Badge tone={['active', 'in_use'].includes(r.status) ? 'positive' : 'neutral'}>{r.status}</Badge></div>
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

      <ConfirmDelete open={!!deleting} onClose={() => setDeleting(null)}
        name={deleting ? `${def.singular} · ${deleting[def.nameField]}` : undefined}
        onConfirm={async () => {
          const res = await supabase.from(def.table as any).delete().eq('id', deleting.id)
          if (!res.error) { setDeleting(null); refresh() }
          return res
        }} />
    </div>
  )
}

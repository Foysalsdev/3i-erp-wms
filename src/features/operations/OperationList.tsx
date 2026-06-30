import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useCollection } from '@/hooks/useCollection'
import { OP_RELATIONS, opColumns, type OpDef } from './registry'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ActionMenu, type MenuItem } from '@/components/ui/ActionMenu'
import { ConfirmDelete } from '@/components/ui/ConfirmDelete'
import { SearchBar } from '@/components/shared/SearchBar'
import { useUrlSearch } from '@/hooks/useUrlSearch'
import { OperationForm } from './OperationForm'

export function OperationList({ def }: { def: OpDef }) {
  const { data, loading, refresh } = useCollection(def.table, { order: 'created_at' })
  const { can, isPlatformAdmin, currentClientId } = useAuth()
  const canEdit = can(`${def.permission}.create`) || can(`${def.permission}.edit`)
  const [q, setQ] = useUrlSearch()
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [deleting, setDeleting] = useState<any>(null)
  const [rel, setRel] = useState<Record<string, Record<string, string>>>({})

  // Resolve id -> label maps for relation columns.
  useEffect(() => {
    if (!currentClientId) return
    def.fields.filter(f => f.relation).forEach(async f => {
      const r = OP_RELATIONS[f.relation!]
      const cols = ['id', r.code, r.name].filter(Boolean).join(', ')
      const { data } = await supabase.from(r.table as any).select(cols).eq('client_id', currentClientId)
      const m: Record<string, string> = {}
      ;(data ?? []).forEach((row: any) => { m[row.id] = r.name ? `${row[r.code]}${row[r.name] ? ' — ' + row[r.name] : ''}` : row[r.code] })
      setRel(prev => ({ ...prev, [f.name]: m }))
    })
  }, [def, currentClientId])

  const rows = useMemo(() => {
    const withRel = (data as any[]).map(row => ({
      ...row,
      __rel: Object.fromEntries(def.fields.filter(f => f.relation).map(f => [f.name, rel[f.name]?.[row[f.name]] ?? '—']))
    }))
    if (!q.trim()) return withRel
    const t = q.toLowerCase()
    return withRel.filter(r => def.searchFields.some(f => String(r[f] ?? '').toLowerCase().includes(t)))
  }, [data, rel, q, def])

  const rowActions = (row: any): MenuItem[] => [
    ...(canEdit ? [{ icon: 'edit', label: 'Edit', onClick: () => { setEditing(row); setModal(true) } }] : []),
    ...(isPlatformAdmin ? [{ icon: 'delete', label: 'Delete', tone: '!text-bad hover:!text-bad hover:!bg-bad/10', onClick: () => setDeleting(row) }] : [])
  ]

  const actionCol: Column<any> = {
    key: '__actions', header: '', className: 'w-px whitespace-nowrap',
    render: (row: any) => (
      <div className="flex justify-end" onClick={e => e.stopPropagation()}>
        <ActionMenu items={rowActions(row)} />
      </div>
    )
  }
  const columns = [...opColumns(def), ...(canEdit || isPlatformAdmin ? [actionCol] : [])]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-72"><SearchBar value={q} onChange={setQ} placeholder={`Search ${def.singular.toLowerCase()}…`} /></div>
        <span className="text-sm text-ink-soft">{rows.length} records</span>
        {canEdit && <Button className="ml-auto" icon="add" onClick={() => { setEditing(null); setModal(true) }}>New {def.singular}</Button>}
      </div>

      <Card className="overflow-hidden">
        <DataTable columns={columns} rows={rows} loading={loading} rowKey={(r: any) => r.id}
          onRowClick={canEdit ? (r => { setEditing(r); setModal(true) }) : undefined}
          emptyTitle={`No ${def.singular.toLowerCase()} records yet`} />
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={`${editing ? 'Edit' : 'New'} ${def.singular}`} size="lg">
        <OperationForm def={def} record={editing} onCancel={() => setModal(false)}
          onDone={() => { setModal(false); refresh() }} />
      </Modal>

      <ConfirmDelete open={!!deleting} onClose={() => setDeleting(null)}
        name={deleting ? `${def.singular} · ${deleting[def.numberField]}` : undefined}
        onConfirm={async () => {
          const res = await supabase.from(def.table as any).delete().eq('id', deleting.id)
          if (!res.error) { setDeleting(null); refresh() }
          return res
        }} />
    </div>
  )
}

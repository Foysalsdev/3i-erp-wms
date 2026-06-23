import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { useCollection } from '@/hooks/useCollection'
import { nextDocNumber } from '@/hooks/useDocNumber'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ActionMenu } from '@/components/ui/ActionMenu'
import { ConfirmDelete } from '@/components/ui/ConfirmDelete'
import { SearchBar } from '@/components/shared/SearchBar'
import { Field, Select, Input, Textarea } from '@/components/ui/Field'
import { formatNumber, formatDate } from '@/lib/utils'
import { LineItems, type LineRow } from '@/components/shared/LineItems'

const PR_STATUS = ['draft', 'pending', 'approved', 'received', 'closed', 'cancelled']
const today = () => new Date().toISOString().slice(0, 10)
const tone = (s: string) => s === 'received' || s === 'closed' ? 'positive' : s === 'cancelled' ? 'negative' : s === 'draft' ? 'neutral' : 'critical'

export function InboundPurchaseRequisitions() {
  const { data, loading, refresh } = useCollection('purchase_requisitions', { order: 'created_at' })
  const { currentClientId, can, isPlatformAdmin } = useAuth()
  const notify = useUI(s => s.notify)
  const canEdit = can('inbound.create') || can('inbound.edit')
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [deleting, setDeleting] = useState<any>(null)
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])

  useEffect(() => {
    if (!currentClientId) return
    supabase.from('suppliers').select('id,supplier_code,name').eq('client_id', currentClientId).then(({ data }) => setSuppliers(data ?? []))
    supabase.from('warehouses').select('id,code,name').eq('client_id', currentClientId).then(({ data }) => setWarehouses(data ?? []))
    supabase.from('products').select('id,material_code,name').eq('client_id', currentClientId).then(({ data }) => setProducts(data ?? []))
  }, [currentClientId])

  const supplierName = (id: string) => { const s = suppliers.find(x => x.id === id); return s ? `${s.supplier_code} — ${s.name}` : '—' }

  const rows = useMemo(() => {
    if (!q.trim()) return data as any[]
    const t = q.toLowerCase()
    return (data as any[]).filter(r => String(r.pr_no ?? '').toLowerCase().includes(t))
  }, [data, q])

  const openEdit = async (r: any) => {
    const { data: items } = await supabase.from('purchase_requisition_items').select('*').eq('pr_id', r.id)
    setEditing({ ...r, __items: items ?? [] }); setModal(true)
  }

  const columns = [
    { key: 'pr_no', header: 'PR No', accessor: (r: any) => r.pr_no, sortable: true, className: 'font-medium' },
    { key: 'supplier', header: 'Supplier', render: (r: any) => supplierName(r.supplier_id) },
    { key: 'order_date', header: 'Date', render: (r: any) => formatDate(r.order_date) },
    { key: 'total_qty', header: 'Qty', accessor: (r: any) => formatNumber(r.total_qty), className: 'text-right' },
    { key: 'total_amount', header: 'Amount', accessor: (r: any) => formatNumber(r.total_amount), className: 'text-right' },
    { key: 'status', header: 'Status', render: (r: any) => <Badge tone={tone(r.status)}>{r.status}</Badge> },
    ...(canEdit || isPlatformAdmin ? [{
      key: '__a', header: '', className: 'w-px whitespace-nowrap',
      render: (r: any) => (
        <div className="flex justify-end" onClick={e => e.stopPropagation()}>
          <ActionMenu items={[
            ...(canEdit ? [{ icon: 'edit', label: 'Edit', onClick: () => openEdit(r) }] : []),
            ...(isPlatformAdmin ? [{ icon: 'delete', label: 'Delete', tone: '!text-bad hover:!text-bad hover:!bg-bad/10', onClick: () => setDeleting(r) }] : [])
          ]} />
        </div>
      )
    }] : [])
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-72"><SearchBar value={q} onChange={setQ} placeholder="Search PR…" /></div>
        <span className="text-sm text-ink-soft">{rows.length} records</span>
        {canEdit && <Button className="ml-auto" icon="add" onClick={() => { setEditing(null); setModal(true) }}>New Purchase Requisition</Button>}
      </div>

      <Card className="overflow-hidden">
        <DataTable columns={columns} rows={rows} loading={loading} rowKey={(r: any) => r.id}
          onRowClick={canEdit ? openEdit : undefined} emptyTitle="No purchase requisitions yet" />
      </Card>

      {modal && (
        <PRForm record={editing} suppliers={suppliers} warehouses={warehouses} products={products}
          clientId={currentClientId!} notify={notify}
          onClose={() => setModal(false)} onDone={() => { setModal(false); refresh() }} />
      )}

      <ConfirmDelete open={!!deleting} onClose={() => setDeleting(null)}
        name={deleting ? `PR · ${deleting.pr_no}` : undefined}
        onConfirm={async () => {
          const res = await supabase.from('purchase_requisitions').delete().eq('id', deleting.id)
          if (!res.error) { setDeleting(null); refresh() }
          return res
        }} />
    </div>
  )
}

function PRForm({ record, suppliers, warehouses, products, clientId, notify, onClose, onDone }: any) {
  const [h, setH] = useState<any>(record ?? { order_date: today(), status: 'pending' })
  const [lines, setLines] = useState<LineRow[]>(record?.__items ?? [])
  const [saving, setSaving] = useState(false)
  const set = (patch: any) => setH((x: any) => ({ ...x, ...patch }))

  const save = async () => {
    setSaving(true)
    try {
      const totalQty = lines.reduce((s, r) => s + (Number(r.qty) || 0), 0)
      const totalAmount = lines.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.unit_price) || 0), 0)
      const header = {
        client_id: clientId, supplier_id: h.supplier_id || null, warehouse_id: h.warehouse_id || null,
        order_date: h.order_date || today(), expected_date: h.expected_date || null,
        total_qty: totalQty, total_amount: totalAmount, status: h.status || 'pending', remarks: h.remarks || null
      }
      let prId = record?.id
      if (record) {
        const { error } = await supabase.from('purchase_requisitions').update(header).eq('id', record.id)
        if (error) throw error
      } else {
        const pr_no = await nextDocNumber(clientId, 'PR')
        if (!pr_no) throw new Error('Could not generate PR number')
        const { data, error } = await supabase.from('purchase_requisitions').insert({ ...header, pr_no }).select('id').single()
        if (error) throw error
        prId = data.id
      }
      await supabase.from('purchase_requisition_items').delete().eq('pr_id', prId)
      const payloadLines = lines.filter(r => r.product_id).map(r => ({
        client_id: clientId, pr_id: prId, product_id: r.product_id,
        qty: Number(r.qty) || 0, unit_price: Number(r.unit_price) || 0,
        line_total: (Number(r.qty) || 0) * (Number(r.unit_price) || 0)
      }))
      if (payloadLines.length) {
        const { error } = await supabase.from('purchase_requisition_items').insert(payloadLines)
        if (error) throw error
      }
      notify('success', `Purchase Requisition ${record ? 'updated' : 'created'}`)
      onDone()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not save purchase requisition')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`${record ? 'Edit' : 'New'} Purchase Requisition`} size="lg">
      <div className="space-y-4">
        {record && <div className="rounded-lg bg-surface-sunken px-3 py-2 text-sm"><span className="text-ink-faint">PR No: </span><span className="font-semibold">{record.pr_no}</span></div>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Supplier">
            <Select value={h.supplier_id ?? ''} onChange={e => set({ supplier_id: e.target.value })}>
              <option value="">Select…</option>
              {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.supplier_code} — {s.name}</option>)}
            </Select>
          </Field>
          <Field label="Warehouse">
            <Select value={h.warehouse_id ?? ''} onChange={e => set({ warehouse_id: e.target.value })}>
              <option value="">Select…</option>
              {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
            </Select>
          </Field>
          <Field label="Date" required><Input type="date" value={h.order_date ?? ''} onChange={e => set({ order_date: e.target.value })} /></Field>
          <Field label="Required By"><Input type="date" value={h.expected_date ?? ''} onChange={e => set({ expected_date: e.target.value })} /></Field>
          <Field label="Status" required>
            <Select value={h.status ?? 'pending'} onChange={e => set({ status: e.target.value })}>
              {PR_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Remarks" className="sm:col-span-2"><Textarea value={h.remarks ?? ''} onChange={e => set({ remarks: e.target.value })} /></Field>
        </div>

        <LineItems rows={lines} onChange={setLines} products={products} variant="po" />

        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button icon="save" loading={saving} onClick={save}>{record ? 'Update' : 'Create'}</Button>
        </div>
      </div>
    </Modal>
  )
}

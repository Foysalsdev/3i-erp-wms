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
import { LineItems, type LineRow } from '@/components/shared/LineItems'
import { Combobox } from '@/components/shared/Combobox'
import { formatNumber, formatDate } from '@/lib/utils'

const DISPATCH_STATUS = ['pending', 'loaded', 'dispatched', 'delivered', 'cancelled']
const today = () => new Date().toISOString().slice(0, 10)
const tone = (s: string) => s === 'delivered' ? 'positive' : s === 'cancelled' ? 'negative' : ['dispatched', 'loaded'].includes(s) ? 'info' : 'critical'

export function OutboundDispatch() {
  const { data, loading, refresh } = useCollection('dispatches', { order: 'created_at' })
  const { currentClientId, can, isPlatformAdmin } = useAuth()
  const notify = useUI(s => s.notify)
  const canEdit = can('outbound.create') || can('outbound.edit')
  const canPost = can('outbound.approve') || can('outbound.post') || isPlatformAdmin
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [deleting, setDeleting] = useState<any>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [customers, setCustomers] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])

  useEffect(() => {
    if (!currentClientId) return
    supabase.from('customers').select('id,customer_code,name').eq('client_id', currentClientId).then(({ data }) => setCustomers(data ?? []))
    supabase.from('warehouses').select('id,code,name').eq('client_id', currentClientId).then(({ data }) => setWarehouses(data ?? []))
    supabase.from('vehicles').select('id,vehicle_number,vehicle_type').eq('client_id', currentClientId).then(({ data }) => setVehicles(data ?? []))
    supabase.from('products').select('id,material_code,name,barcode,category,uom').eq('client_id', currentClientId).then(({ data }) => setProducts(data ?? []))
  }, [currentClientId])

  const customerName = (id: string) => { const c = customers.find(x => x.id === id); return c ? `${c.customer_code} — ${c.name}` : '—' }

  const rows = useMemo(() => {
    if (!q.trim()) return data as any[]
    const t = q.toLowerCase()
    return (data as any[]).filter(r => String(r.dispatch_no ?? '').toLowerCase().includes(t))
  }, [data, q])

  // Confirms the dispatch and deducts every line from inventory (stock-out).
  const confirmDispatch = async (d: any) => {
    if (d.posted_at) { notify('info', 'This dispatch is already confirmed & deducted'); return }
    if (!d.warehouse_id) { notify('error', 'Set a warehouse before confirming'); return }
    setBusy(d.id)
    try {
      const { data: items } = await supabase.from('dispatch_items').select('*').eq('dispatch_id', d.id)
      if (!items || items.length === 0) { notify('error', 'Add line items before confirming'); return }
      for (const it of items as any[]) {
        if (!it.product_id || !(Number(it.qty) > 0)) continue
        const { error } = await (supabase as any).rpc('post_stock_movement', {
          p_client: currentClientId, p_product: it.product_id, p_warehouse: d.warehouse_id,
          p_location: it.location_id || null, p_stock_status: it.stock_status || 'good',
          p_qty_in: 0, p_qty_out: Number(it.qty), p_movement_type: 'DELIVERY',
          p_reference_type: 'dispatch', p_reference_id: d.id, p_reference_no: d.dispatch_no,
          p_serial_no: null, p_remarks: `Dispatch ${d.dispatch_no}`
        })
        if (error) throw error
      }
      const { error } = await supabase.from('dispatches').update({ posted_at: new Date().toISOString(), status: 'dispatched' }).eq('id', d.id)
      if (error) throw error
      notify('success', `${d.dispatch_no} confirmed — stock deducted`)
      refresh()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not confirm dispatch')
    } finally {
      setBusy(null)
    }
  }

  const openEdit = async (r: any) => {
    const { data: items } = await supabase.from('dispatch_items').select('*').eq('dispatch_id', r.id)
    setEditing({ ...r, __items: items ?? [] }); setModal(true)
  }

  const columns = [
    { key: 'dispatch_no', header: 'Dispatch No', accessor: (r: any) => r.dispatch_no, sortable: true, className: 'font-medium' },
    { key: 'customer', header: 'Customer', render: (r: any) => customerName(r.customer_id) },
    { key: 'dispatch_date', header: 'Date', render: (r: any) => formatDate(r.dispatch_date) },
    { key: 'total_qty', header: 'Qty', accessor: (r: any) => formatNumber(r.total_qty), className: 'text-right' },
    { key: 'status', header: 'Status', render: (r: any) => <Badge tone={tone(r.status)}>{r.status}</Badge> },
    { key: 'posted', header: 'Stock', render: (r: any) => r.posted_at ? <Badge tone="positive">Deducted</Badge> : <span className="text-ink-faint">—</span> },
    {
      key: '__a', header: '', className: 'w-px whitespace-nowrap',
      render: (r: any) => (
        <div className="flex justify-end" onClick={e => e.stopPropagation()}>
          <ActionMenu items={[
            ...(canEdit ? [{ icon: 'edit', label: 'Edit', onClick: () => openEdit(r) }] : []),
            ...(canPost && !r.posted_at ? [{ icon: 'check_circle', label: busy === r.id ? 'Confirming…' : 'Confirm Dispatch & Deduct Stock', onClick: () => confirmDispatch(r) }] : []),
            ...(isPlatformAdmin ? [{ icon: 'delete', label: 'Delete', tone: '!text-bad hover:!text-bad hover:!bg-bad/10', onClick: () => setDeleting(r) }] : [])
          ]} />
        </div>
      )
    }
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-72"><SearchBar value={q} onChange={setQ} placeholder="Search dispatch…" /></div>
        <span className="text-sm text-ink-soft">{rows.length} records</span>
        {canEdit && <Button className="ml-auto" icon="add" onClick={() => { setEditing(null); setModal(true) }}>New Dispatch</Button>}
      </div>

      <Card className="overflow-hidden">
        <DataTable columns={columns} rows={rows} loading={loading} rowKey={(r: any) => r.id}
          onRowClick={canEdit ? openEdit : undefined} emptyTitle="No dispatches yet" />
      </Card>

      {modal && (
        <DispatchForm record={editing} customers={customers} warehouses={warehouses} vehicles={vehicles} products={products}
          clientId={currentClientId!} notify={notify}
          onClose={() => setModal(false)} onDone={() => { setModal(false); refresh() }} />
      )}

      <ConfirmDelete open={!!deleting} onClose={() => setDeleting(null)}
        name={deleting ? `Dispatch · ${deleting.dispatch_no}` : undefined}
        onConfirm={async () => {
          const res = await supabase.from('dispatches').delete().eq('id', deleting.id)
          if (!res.error) { setDeleting(null); refresh() }
          return res
        }} />
    </div>
  )
}

function DispatchForm({ record, customers, warehouses, vehicles, products, clientId, notify, onClose, onDone }: any) {
  const [h, setH] = useState<any>(record ?? { dispatch_date: today(), status: 'pending' })
  const [lines, setLines] = useState<LineRow[]>(record?.__items ?? [])
  const [locations, setLocations] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const set = (patch: any) => setH((x: any) => ({ ...x, ...patch }))
  const posted = !!record?.posted_at

  useEffect(() => {
    if (!h.warehouse_id) { setLocations([]); return }
    supabase.from('locations').select('id,location_code').eq('warehouse_id', h.warehouse_id).then(({ data }) => setLocations(data ?? []))
  }, [h.warehouse_id])

  const save = async () => {
    setSaving(true)
    try {
      const totalQty = lines.reduce((s, r) => s + (Number(r.qty) || 0), 0)
      const header = {
        client_id: clientId, customer_id: h.customer_id || null, warehouse_id: h.warehouse_id || null,
        vehicle_id: h.vehicle_id || null, dispatch_date: h.dispatch_date || today(),
        total_qty: totalQty, status: h.status || 'pending', remarks: h.remarks || null
      }
      let dispatchId = record?.id
      if (record) {
        const { error } = await supabase.from('dispatches').update(header).eq('id', record.id)
        if (error) throw error
      } else {
        const dispatch_no = await nextDocNumber(clientId, 'DISP')
        if (!dispatch_no) throw new Error('Could not generate dispatch number')
        const { data, error } = await supabase.from('dispatches').insert({ ...header, dispatch_no }).select('id').single()
        if (error) throw error
        dispatchId = data.id
      }
      await supabase.from('dispatch_items').delete().eq('dispatch_id', dispatchId)
      const payloadLines = lines.filter(r => r.product_id).map(r => ({
        client_id: clientId, dispatch_id: dispatchId, product_id: r.product_id, qty: Number(r.qty) || 0,
        unit_price: Number(r.unit_price) || 0, stock_status: r.stock_status || 'good', location_id: r.location_id || null
      }))
      if (payloadLines.length) {
        const { error } = await supabase.from('dispatch_items').insert(payloadLines)
        if (error) throw error
      }
      notify('success', `Dispatch ${record ? 'updated' : 'created'}`)
      onDone()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not save dispatch')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`${record ? 'Edit' : 'New'} Dispatch`} size="lg">
      <div className="space-y-4">
        {record && <div className="rounded-lg bg-surface-sunken px-3 py-2 text-sm"><span className="text-ink-faint">Dispatch No: </span><span className="font-semibold">{record.dispatch_no}</span>{posted && <span className="ml-2"><Badge tone="positive">Stock deducted</Badge></span>}</div>}
        {posted && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">This dispatch is confirmed and stock is deducted. Editing lines will not change posted stock.</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Customer">
            <Combobox items={customers.map((c: any) => ({ id: c.id, label: c.customer_code, sublabel: c.name }))} value={h.customer_id ?? ''} onChange={(id: string) => set({ customer_id: id })} placeholder="Search customer by code or name" />
          </Field>
          <Field label="Warehouse">
            <Select value={h.warehouse_id ?? ''} onChange={e => set({ warehouse_id: e.target.value })}>
              <option value="">Select…</option>
              {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
            </Select>
          </Field>
          <Field label="Vehicle">
            <Select value={h.vehicle_id ?? ''} onChange={e => set({ vehicle_id: e.target.value })}>
              <option value="">—</option>
              {vehicles.map((v: any) => <option key={v.id} value={v.id}>{v.vehicle_number}{v.vehicle_type ? ' — ' + v.vehicle_type : ''}</option>)}
            </Select>
          </Field>
          <Field label="Dispatch Date" required><Input type="date" value={h.dispatch_date ?? ''} onChange={e => set({ dispatch_date: e.target.value })} /></Field>
          <Field label="Status" required>
            <Select value={h.status ?? 'pending'} onChange={e => set({ status: e.target.value })}>
              {DISPATCH_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Remarks" className="sm:col-span-2"><Textarea value={h.remarks ?? ''} onChange={e => set({ remarks: e.target.value })} /></Field>
        </div>

        <LineItems rows={lines} onChange={setLines} products={products} locations={locations} variant="out" />

        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button icon="save" loading={saving} onClick={save}>{record ? 'Update' : 'Create'}</Button>
        </div>
      </div>
    </Modal>
  )
}

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
import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { ActionMenu } from '@/components/ui/ActionMenu'
import { ConfirmDelete } from '@/components/ui/ConfirmDelete'
import { SearchBar } from '@/components/shared/SearchBar'
import { Field, Select, Input, Textarea } from '@/components/ui/Field'
import { LineItems, type LineRow } from '@/components/shared/LineItems'
import { Combobox } from '@/components/shared/Combobox'
import { PickScan } from './PickScan'
import { formatNumber, formatDate } from '@/lib/utils'

const SO_STATUS = ['draft', 'pending', 'approved', 'picking', 'packed', 'invoiced', 'dispatched', 'delivered', 'closed', 'cancelled']
const today = () => new Date().toISOString().slice(0, 10)
const tone = (s: string) => ['delivered', 'closed'].includes(s) ? 'positive' : s === 'cancelled' ? 'negative' : s === 'draft' ? 'neutral' : ['dispatched', 'packed', 'picking'].includes(s) ? 'info' : 'critical'

const STAGES = ['Order', 'Picked', 'Invoiced', 'Dispatched', 'Delivered']
const stageIndex = (s: string): number => {
  if (['draft', 'pending', 'approved'].includes(s)) return 0
  if (['picking', 'packed'].includes(s)) return 1
  if (s === 'invoiced') return 2
  if (s === 'dispatched') return 3
  if (['delivered', 'closed'].includes(s)) return 4
  return -1
}

// Inline progress tracker shown on each sales order (no separate tab needed).
function OrderStepper({ status }: { status: string }) {
  if (status === 'cancelled') return <div className="mb-1"><Badge tone="negative">Cancelled</Badge></div>
  const current = stageIndex(status)
  return (
    <div className="flex items-center gap-1 rounded-lg bg-surface-sunken px-3 py-2">
      {STAGES.map((label, i) => {
        const done = i <= current
        return (
          <div key={label} className="flex flex-1 items-center" style={{ minWidth: 56 }}>
            <div className="flex flex-col items-center gap-1">
              <div className={'flex h-6 w-6 items-center justify-center rounded-full text-[12px] ' + (done ? 'bg-brand-500 text-white' : 'bg-surface text-ink-faint border border-surface-line')}>
                {done ? <Icon name="check" className="text-[14px]" /> : <span>{i + 1}</span>}
              </div>
              <span className={'whitespace-nowrap text-[10px] ' + (i === current ? 'font-semibold text-ink' : 'text-ink-faint')}>{label}</span>
            </div>
            {i < STAGES.length - 1 && <div className={'mx-1 h-0.5 flex-1 rounded ' + (i < current ? 'bg-brand-500' : 'bg-surface-line')} />}
          </div>
        )
      })}
    </div>
  )
}

export function OutboundSalesOrders() {
  const { data, loading, refresh } = useCollection('sales_orders', { order: 'created_at' })
  const { currentClientId, can, isPlatformAdmin } = useAuth()
  const notify = useUI(s => s.notify)
  const canEdit = can('outbound.create') || can('outbound.edit')
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [picking, setPicking] = useState<any>(null)
  const [deleting, setDeleting] = useState<any>(null)
  const [customers, setCustomers] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])

  useEffect(() => {
    if (!currentClientId) return
    supabase.from('customers').select('id,customer_code,name').eq('client_id', currentClientId).then(({ data }) => setCustomers(data ?? []))
    supabase.from('warehouses').select('id,code,name').eq('client_id', currentClientId).then(({ data }) => setWarehouses(data ?? []))
    supabase.from('products').select('id,material_code,name,barcode,category,uom,plant').eq('client_id', currentClientId).then(({ data }) => setProducts(data ?? []))
  }, [currentClientId])

  const customerName = (id: string) => { const c = customers.find(x => x.id === id); return c ? `${c.customer_code} — ${c.name}` : '—' }

  const rows = useMemo(() => {
    if (!q.trim()) return data as any[]
    const t = q.toLowerCase()
    return (data as any[]).filter(r => String(r.so_no ?? '').toLowerCase().includes(t) || String(r.reference_no ?? '').toLowerCase().includes(t))
  }, [data, q])

  const closeRemaining = async (r: any) => {
    if (!window.confirm(`Close remaining (undelivered) qty for ${r.so_no}? The order will be marked closed.`)) return
    const { error } = await supabase.from('sales_orders').update({ status: 'closed' }).eq('id', r.id)
    if (error) notify('error', error.message)
    else { notify('success', `${r.so_no} closed`); refresh() }
  }

  const openEdit = async (r: any) => {
    const { data: items } = await supabase.from('sales_order_items').select('*').eq('so_id', r.id)
    setEditing({ ...r, __items: items ?? [] }); setModal(true)
  }

  const columns = [
    { key: 'so_no', header: 'SO No', accessor: (r: any) => r.so_no, sortable: true, className: 'font-medium' },
    { key: 'customer', header: 'Customer', render: (r: any) => customerName(r.customer_id) },
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
            ...(canEdit ? [{ icon: 'qr_code_scanner', label: 'Pick & Scan', onClick: () => setPicking(r) }] : []),
            ...(canEdit && !['delivered', 'closed', 'cancelled', 'draft'].includes(r.status) ? [{ icon: 'block', label: 'Close remaining', onClick: () => closeRemaining(r) }] : []),
            ...(isPlatformAdmin ? [{ icon: 'delete', label: 'Delete', tone: '!text-bad hover:!text-bad hover:!bg-bad/10', onClick: () => setDeleting(r) }] : [])
          ]} />
        </div>
      )
    }] : [])
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-72"><SearchBar value={q} onChange={setQ} placeholder="Search SO…" /></div>
        <span className="text-sm text-ink-soft">{rows.length} records</span>
        {canEdit && <Button className="ml-auto" icon="add" onClick={() => { setEditing(null); setModal(true) }}>New Sales Order</Button>}
      </div>

      <Card className="overflow-hidden">
        <DataTable columns={columns} rows={rows} loading={loading} rowKey={(r: any) => r.id}
          onRowClick={canEdit ? openEdit : undefined} emptyTitle="No sales orders yet" />
      </Card>

      {modal && (
        <SOForm record={editing} customers={customers} warehouses={warehouses} products={products}
          clientId={currentClientId!} notify={notify}
          onClose={() => setModal(false)} onDone={() => { setModal(false); refresh() }} />
      )}

      {picking && (
        <Modal open onClose={() => setPicking(null)} title={`Pick & Scan — ${picking.so_no}`} size="xl">
          <PickScan lockSoId={picking.id} onDone={() => { setPicking(null); refresh() }} />
        </Modal>
      )}

      <ConfirmDelete open={!!deleting} onClose={() => setDeleting(null)}
        name={deleting ? `SO · ${deleting.so_no}` : undefined}
        onConfirm={async () => {
          const res = await supabase.from('sales_orders').delete().eq('id', deleting.id)
          if (!res.error) { setDeleting(null); refresh() }
          return res
        }} />
    </div>
  )
}

function SOForm({ record, customers, warehouses, products, clientId, notify, onClose, onDone }: any) {
  const [h, setH] = useState<any>(record ?? { order_date: today(), status: 'pending' })
  const [lines, setLines] = useState<LineRow[]>(record?.__items ?? [])
  const [saving, setSaving] = useState(false)
  const set = (patch: any) => setH((x: any) => ({ ...x, ...patch }))
  const [genning, setGenning] = useState(false)
  const genPO = async () => {
    setGenning(true)
    try {
      const d = new Date()
      const day = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
      const { data } = await supabase.from('sales_orders').select('reference_no').eq('client_id', clientId).like('reference_no', `PO-${day}-%`)
      let max = 0
      for (const row of (data ?? []) as any[]) { const m = /-(\d+)$/.exec(row.reference_no || ''); if (m) max = Math.max(max, parseInt(m[1], 10)) }
      set({ reference_no: `PO-${day}-${String(max + 1).padStart(3, '0')}` })
    } finally { setGenning(false) }
  }

  const save = async () => {
    setSaving(true)
    try {
      const totalQty = lines.reduce((s, r) => s + (Number(r.qty) || 0), 0)
      const totalAmount = lines.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.unit_price) || 0), 0)
      const header = {
        client_id: clientId, customer_id: h.customer_id || null, warehouse_id: h.warehouse_id || null,
        reference_no: h.reference_no || null, order_date: h.order_date || today(), required_date: h.required_date || null,
        total_qty: totalQty, total_amount: totalAmount, status: h.status || 'pending', remarks: h.remarks || null
      }
      let soId = record?.id
      if (record) {
        const { error } = await supabase.from('sales_orders').update(header).eq('id', record.id)
        if (error) throw error
      } else {
        const so_no = await nextDocNumber(clientId, 'SO')
        if (!so_no) throw new Error('Could not generate SO number')
        const { data, error } = await supabase.from('sales_orders').insert({ ...header, so_no }).select('id').single()
        if (error) throw error
        soId = data.id
      }
      await supabase.from('sales_order_items').delete().eq('so_id', soId)
      const payloadLines = lines.filter(r => r.product_id).map(r => ({
        client_id: clientId, so_id: soId, product_id: r.product_id,
        qty: Number(r.qty) || 0, unit_price: Number(r.unit_price) || 0,
        line_total: (Number(r.qty) || 0) * (Number(r.unit_price) || 0)
      }))
      if (payloadLines.length) {
        const { error } = await supabase.from('sales_order_items').insert(payloadLines)
        if (error) throw error
      }
      notify('success', `Sales Order ${record ? 'updated' : 'created'}`)
      onDone()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not save sales order')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`${record ? 'Edit' : 'New'} Sales Order`} size="lg">
      <div className="space-y-4">
        {record && <div className="rounded-lg bg-surface-sunken px-3 py-2 text-sm"><span className="text-ink-faint">SO No: </span><span className="font-semibold">{record.so_no}</span></div>}
        <OrderStepper status={h.status ?? 'pending'} />
        {record && (() => {
          const dt = (record.__items ?? []).reduce((a: number, l: any) => a + Number(l.delivered_qty || 0), 0)
          const ot = (record.__items ?? []).reduce((a: number, l: any) => a + Number(l.qty || 0), 0)
          return ot > 0 ? <p className="text-xs text-ink-soft">Delivered <span className="font-semibold text-ink">{dt}</span> / {ot}{dt > 0 && dt < ot ? ' · partially fulfilled' : ''}</p> : null
        })()}
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
          <Field label="Customer PO No">
            <div className="flex gap-2">
              <Input value={h.reference_no ?? ''} onChange={e => set({ reference_no: e.target.value })} placeholder="Customer PO" />
              <button type="button" onClick={genPO} disabled={!!(h.reference_no && String(h.reference_no).trim()) || genning}
                className="shrink-0 rounded-lg border border-surface-line px-3 text-sm font-medium text-ink-soft hover:bg-surface-sunken disabled:opacity-40 disabled:hover:bg-transparent">
                {genning ? '...' : 'Auto'}
              </button>
            </div>
          </Field>
          <Field label="Order Date" required><Input type="date" value={h.order_date ?? ''} onChange={e => set({ order_date: e.target.value })} /></Field>
          <Field label="Required Date"><Input type="date" value={h.required_date ?? ''} onChange={e => set({ required_date: e.target.value })} /></Field>
          <Field label="Status" required>
            <Select value={h.status ?? 'pending'} onChange={e => set({ status: e.target.value })}>
              {SO_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
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

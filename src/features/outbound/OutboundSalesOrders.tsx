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
import { useUrlSearch } from '@/hooks/useUrlSearch'
import { Field, Select, Input, Textarea } from '@/components/ui/Field'
import { LineItems, type LineRow } from '@/components/shared/LineItems'
import { Combobox } from '@/components/shared/Combobox'
import { PickScan } from './PickScan'
import { formatNumber, formatDate, formatDateTime, formatVehicleNo } from '@/lib/utils'
import { downloadDocPDF } from '@/pdf/DocumentPDF'
import { TimelinePanel } from '@/features/masters/components/Panels'
import { CreatableCombobox } from '@/components/shared/CreatableCombobox'
import { DocTimeline } from '@/components/shared/DocTimeline'
import { WorkflowPanel } from './WorkflowPanel'
import { workflowState } from './workflow'

const SO_STATUS = ['draft', 'pending', 'approved', 'picking', 'packed', 'invoiced', 'dispatched', 'delivered', 'closed', 'cancelled']
const today = () => new Date().toISOString().slice(0, 10)
const tone = (s: string) => ['delivered', 'closed'].includes(s) ? 'positive' : s === 'cancelled' ? 'negative' : s === 'draft' ? 'neutral' : ['dispatched', 'packed', 'picking'].includes(s) ? 'info' : 'critical'

// Compact "what's next & who owns it" cell for the order list (WES #6).
function NextActionCell({ order }: { order: any }) {
  const wf = workflowState(order)
  if (wf.cancelled) return <span className="text-xs text-ink-faint">—</span>
  const done = !wf.next
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-xs">
        <span className={'truncate ' + (done ? 'text-ink-faint' : 'text-ink')}>{wf.action}</span>
        {wf.overdue && <Badge tone="negative">Overdue</Badge>}
      </div>
      {!done && <div className="truncate text-[11px] text-ink-faint">{wf.role}</div>}
    </div>
  )
}

export function OutboundSalesOrders() {
  const { data, loading, refresh } = useCollection('sales_orders', { order: 'created_at' })
  const { currentClientId, can, isPlatformAdmin, clients } = useAuth()
  const clientName = clients.find((c: any) => c.id === currentClientId)?.name ?? ''
  // Warehouse/dispatch actions are hidden from sales-only users (no inventory access).
  const dispatchAccess = isPlatformAdmin || can('inventory.view')
  const notify = useUI(s => s.notify)
  const canEdit = can('outbound.create') || can('outbound.edit')
  const [q, setQ] = useUrlSearch()
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [picking, setPicking] = useState<any>(null)
  const [deleting, setDeleting] = useState<any>(null)
  const [customers, setCustomers] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [couriers, setCouriers] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [transporters, setTransporters] = useState<any[]>([])
  const [assigning, setAssigning] = useState<any>(null)
  const [overview, setOverview] = useState<any>(null)

  useEffect(() => {
    if (!currentClientId) return
    supabase.from('customers').select('id,customer_code,name,email,billing_address').eq('client_id', currentClientId).then(({ data }) => setCustomers(data ?? []))
    supabase.from('warehouses').select('id,code,name').eq('client_id', currentClientId).then(({ data }) => setWarehouses(data ?? []))
    supabase.from('products').select('id,material_code,name,barcode,category,uom,plant').eq('client_id', currentClientId).then(({ data }) => setProducts(data ?? []))
    ;(supabase as any).from('couriers').select('id,courier_code,name').eq('client_id', currentClientId).then(({ data }: any) => setCouriers(data ?? []))
    supabase.from('vehicles').select('id,vehicle_number,vehicle_type').eq('client_id', currentClientId).then(({ data }) => setVehicles(data ?? []))
    ;(supabase as any).from('drivers').select('id,driver_code,name').eq('client_id', currentClientId).then(({ data }: any) => setDrivers(data ?? []))
    ;(supabase as any).from('transport_vendors').select('id,vendor_code,name').eq('client_id', currentClientId).then(({ data }: any) => setTransporters(data ?? []))
  }, [currentClientId])

  const customerName = (id: string) => { const c = customers.find(x => x.id === id); return c ? `${c.customer_code} — ${c.name}` : '—' }

  const rows = useMemo(() => {
    if (!q.trim()) return data as any[]
    const t = q.toLowerCase()
    const fields = ['so_no', 'reference_no', 'invoice_no', 'sap_so_no', 'outbound_delivery_no', 'transfer_order_no', 'billing_doc_no']
    return (data as any[]).filter(r => fields.some(f => String(r[f] ?? '').toLowerCase().includes(t)))
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

  // Build the printable line list (product name + qty + price) for a sales order.
  const soLines = async (r: any) => {
    const { data: items } = await supabase.from('sales_order_items').select('*').eq('so_id', r.id)
    return (items ?? []).map((it: any) => ({
      name: products.find(p => p.id === it.product_id)?.name ?? it.product_id,
      qty: Number(it.qty), price: Number(it.unit_price ?? 0)
    }))
  }

  const soMeta = (r: any) => [
    { label: 'Date', value: formatDate(r.order_date) },
    { label: 'Customer', value: customerName(r.customer_id) },
    ...(r.reference_no ? [{ label: 'Customer PO', value: r.reference_no }] : []),
    { label: 'Status', value: r.status }
  ]

  const printSO = async (r: any) => {
    const lines = await soLines(r)
    downloadDocPDF({ client: clientName, title: 'Sales Order', docNo: r.so_no ?? '', meta: soMeta(r), lines, showPrice: true })
    notify('info', 'Generating PDF…')
  }

  // "Mail" opens the user's email client pre-filled to the customer; the PDF is
  // downloaded alongside so it can be attached. (No mail server needed.)
  const mailSO = async (r: any) => {
    await printSO(r)
    const cust = customers.find(c => c.id === r.customer_id)
    const to = cust?.email ?? ''
    const subject = `Sales Order ${r.so_no ?? ''}`
    const body = `Dear ${cust?.name ?? 'Customer'},\n\nPlease find attached Sales Order ${r.so_no ?? ''} dated ${formatDate(r.order_date)}.\n(The PDF has just been downloaded to your computer - please attach it to this email.)\n\nRegards,\n${clientName}`
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    if (!to) notify('info', 'No email on file for this customer - add the recipient manually.')
  }

  const columns = [
    { key: 'so_no', header: 'SO No', accessor: (r: any) => r.so_no, sortable: true, className: 'font-medium' },
    { key: 'customer', header: 'Customer', render: (r: any) => customerName(r.customer_id) },
    { key: 'order_date', header: 'Date', render: (r: any) => formatDate(r.order_date) },
    { key: 'total_qty', header: 'Qty', accessor: (r: any) => formatNumber(r.total_qty), className: 'text-right' },
    { key: 'total_amount', header: 'Amount', accessor: (r: any) => formatNumber(r.total_amount), className: 'text-right' },
    { key: 'status', header: 'Status', render: (r: any) => <Badge tone={tone(r.status)}>{r.status}</Badge> },
    { key: 'next_action', header: 'Next Action', render: (r: any) => <NextActionCell order={r} /> },
    {
      key: '__actions', header: '', className: 'w-px whitespace-nowrap',
      render: (r: any) => (
        <div className="flex justify-end" onClick={e => e.stopPropagation()}>
          <ActionMenu items={[
            { icon: 'visibility', label: 'View', onClick: () => setOverview(r) },
            ...(canEdit ? [{ icon: 'edit', label: 'Edit', onClick: () => openEdit(r) }] : []),
            { icon: 'print', label: 'Print', onClick: () => printSO(r) },
            { icon: 'mail', label: 'Mail', onClick: () => mailSO(r) },
            ...(canEdit && dispatchAccess ? [{ icon: 'qr_code_scanner', label: 'Pick & Scan', onClick: () => setPicking(r) }] : []),
            ...(canEdit && dispatchAccess ? [{ icon: 'local_shipping', label: 'Assign Logistics', onClick: () => setAssigning(r) }] : []),
            ...(canEdit && dispatchAccess && !['delivered', 'closed', 'cancelled', 'draft'].includes(r.status) ? [{ icon: 'block', label: 'Close remaining', onClick: () => closeRemaining(r) }] : []),
            ...(isPlatformAdmin ? [{ icon: 'delete', label: 'Delete', tone: '!text-bad hover:!text-bad hover:!bg-bad/10', onClick: () => setDeleting(r) }] : [])
          ]} />
        </div>
      )
    }
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
          emptyTitle="No sales orders yet" />
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

      {assigning && (
        <AssignLogistics so={assigning} couriers={couriers} vehicles={vehicles} drivers={drivers} transporters={transporters}
          clientId={currentClientId!} notify={notify}
          onClose={() => setAssigning(null)} onDone={() => { setAssigning(null); refresh() }} />
      )}

      {overview && (
        <SOOverview so={overview} customerName={customerName(overview.customer_id)} products={products}
          canEdit={canEdit} onEdit={() => { const r = overview; setOverview(null); openEdit(r) }}
          onClose={() => setOverview(null)} />
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
  const readOnly = !!record?.__readOnly
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

  // Saleable stock per product (good available = quantity - reserved), shown beside qty.
  const [stockMap, setStockMap] = useState<Record<string, number>>({})
  useEffect(() => {
    if (!clientId) return
    supabase.from('inventory_stock').select('product_id,quantity,reserved_qty').eq('client_id', clientId).eq('stock_status', 'good').then(({ data }) => {
      const m: Record<string, number> = {}
      ;(data ?? []).forEach((r: any) => { m[r.product_id] = (m[r.product_id] ?? 0) + (Number(r.quantity) || 0) - (Number(r.reserved_qty) || 0) })
      setStockMap(m)
    })
  }, [clientId])

  const save = async () => {
    setSaving(true)
    try {
      const totalQty = lines.reduce((s, r) => s + (Number(r.qty) || 0), 0)
      const totalAmount = lines.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.unit_price) || 0), 0)
      const header = {
        client_id: clientId, customer_id: h.customer_id || null, warehouse_id: h.warehouse_id || null,
        reference_no: h.reference_no || null, order_date: h.order_date || today(), required_date: h.required_date || null,
        total_qty: totalQty, total_amount: totalAmount, status: h.status || 'pending', remarks: h.remarks || null,
        sap_so_no: h.sap_so_no || null, outbound_delivery_no: h.outbound_delivery_no || null,
        transfer_order_no: h.transfer_order_no || null, billing_doc_no: h.billing_doc_no || null
      }
      let soId = record?.id
      if (record) {
        const { error } = await supabase.from('sales_orders').update(header as any).eq('id', record.id)
        if (error) throw error
      } else {
        const so_no = await nextDocNumber(clientId, 'SO')
        if (!so_no) throw new Error('Could not generate SO number')
        const { data, error } = await supabase.from('sales_orders').insert({ ...header, so_no } as any).select('id').single()
        if (error) throw error
        soId = data.id
      }
      await supabase.from('sales_order_items').delete().eq('so_id', soId)
      const payloadLines = lines.filter(r => r.product_id).map(r => ({
        client_id: clientId, so_id: soId, product_id: r.product_id,
        qty: Number(r.qty) || 0, unit_price: Number(r.unit_price) || 0,
        line_total: (Number(r.qty) || 0) * (Number(r.unit_price) || 0),
        remarks: (r as any).remarks || null
      }))
      if (payloadLines.length) {
        const { error } = await (supabase as any).from('sales_order_items').insert(payloadLines)
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
    <Modal open onClose={onClose} title={`${readOnly ? 'View' : record ? 'Edit' : 'New'} Sales Order`} size="lg">
      <fieldset disabled={readOnly} className="m-0 border-0 p-0">
      <div className="space-y-4">
        {record && <div className="rounded-lg bg-surface-sunken px-3 py-2 text-sm"><span className="text-ink-faint">SO No: </span><span className="font-semibold">{record.so_no}</span></div>}
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
          <div className="sm:col-span-2 mt-1 border-t border-surface-line pt-3"><p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">SAP References (enter once when invoiced)</p></div>
          <Field label="SAP Sales Order No"><Input value={h.sap_so_no ?? ''} onChange={e => set({ sap_so_no: e.target.value })} placeholder="e.g. 1465006426" /></Field>
          <Field label="Outbound Delivery No"><Input value={h.outbound_delivery_no ?? ''} onChange={e => set({ outbound_delivery_no: e.target.value })} placeholder="e.g. 1723056387" /></Field>
          <Field label="Transfer Order No"><Input value={h.transfer_order_no ?? ''} onChange={e => set({ transfer_order_no: e.target.value })} placeholder="e.g. 8777" /></Field>
          <Field label="Billing Document No"><Input value={h.billing_doc_no ?? ''} onChange={e => set({ billing_doc_no: e.target.value })} placeholder="e.g. 8815005379" /></Field>
          <Field label="Remarks" className="sm:col-span-2"><Textarea value={h.remarks ?? ''} onChange={e => set({ remarks: e.target.value })} /></Field>
        </div>

        <LineItems rows={lines} onChange={setLines} products={products} variant="po" stock={stockMap} />
      </div>
      </fieldset>

      <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
        <Button variant="ghost" onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</Button>
        {!readOnly && <Button icon="save" loading={saving} onClick={save}>{record ? 'Update' : 'Create'}</Button>}
      </div>
    </Modal>
  )
}

function AssignLogistics({ so, couriers, vehicles, drivers, transporters, clientId, notify, onClose, onDone }: any) {
  const [mode, setMode] = useState<'transport' | 'courier'>('transport')
  const [saving, setSaving] = useState(false)
  const [vendorId, setVendorId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [driverId, setDriverId] = useState('')
  const [courierId, setCourierId] = useState('')
  const [trackingNo, setTrackingNo] = useState('')
  const [charge, setCharge] = useState('')

  // Local copies so newly-created records appear immediately in the lists.
  const [vendors, setVendors] = useState<any[]>(transporters)
  const [vehs, setVehs] = useState<any[]>(vehicles)
  const [drvs, setDrvs] = useState<any[]>(drivers)
  const [cours, setCours] = useState<any[]>(couriers)

  const slug = (x: string) => (x.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 12)) || 'NEW'
  const ins = async (table: string, payload: any) => {
    const { data, error } = await (supabase as any).from(table).insert({ client_id: clientId, ...payload }).select('*').single()
    if (error) { notify('error', error.message); return null }
    return data
  }
  const createVendor = async (name: string) => { const d = await ins('transport_vendors', { vendor_code: slug(name), name }); if (!d) return null; setVendors(v => [...v, d]); return { id: d.id, label: d.vendor_code, sublabel: d.name } }
  const createVehicle = async (name: string) => { const d = await ins('vehicles', { vehicle_number: name }); if (!d) return null; setVehs(v => [...v, d]); return { id: d.id, label: d.vehicle_number, sublabel: d.vehicle_type } }
  const createDriver = async (name: string) => { const d = await ins('drivers', { driver_code: slug(name), name }); if (!d) return null; setDrvs(v => [...v, d]); return { id: d.id, label: d.driver_code, sublabel: d.name } }
  const createCourier = async (name: string) => { const d = await ins('couriers', { courier_code: slug(name), name, status: 'active' }); if (!d) return null; setCours(v => [...v, d]); return { id: d.id, label: d.courier_code, sublabel: d.name } }

  const vendorItems = vendors.map((t: any) => ({ id: t.id, label: t.vendor_code, sublabel: t.name }))
  const vehItems = vehs.map((v: any) => ({ id: v.id, label: v.vehicle_number, sublabel: v.vehicle_type }))
  const drvItems = drvs.map((d: any) => ({ id: d.id, label: d.driver_code, sublabel: d.name }))
  const courItems = cours.map((c: any) => ({ id: c.id, label: c.courier_code, sublabel: c.name }))

  const save = async () => {
    setSaving(true)
    try {
      if (mode === 'transport') {
        const no = await nextDocNumber(clientId, 'VALLOC')
        if (!no) throw new Error('Could not generate allocation number')
        const { error } = await (supabase as any).from('vehicle_allocations').insert({
          client_id: clientId, allocation_no: no, so_id: so.id,
          transport_vendor_id: vendorId || null, vehicle_id: vehicleId || null, driver_id: driverId || null,
          allocation_date: today(), status: 'allocated'
        })
        if (error) throw error
        notify('success', `Vehicle allocated for ${so.so_no} (${no})`)
      } else {
        const no = await nextDocNumber(clientId, 'CSHIP')
        if (!no) throw new Error('Could not generate shipment number')
        const { error } = await (supabase as any).from('courier_shipments').insert({
          client_id: clientId, shipment_no: no, so_id: so.id,
          courier_id: courierId || null, tracking_no: trackingNo || null,
          charge: charge === '' ? null : Number(charge),
          dispatch_date: today(), status: 'booked'
        })
        if (error) throw error
        notify('success', `Courier booked for ${so.so_no} (${no})`)
      }
      onDone()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not assign logistics')
    } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Assign Logistics — ${so.so_no}`} size="md">
      <div className="space-y-4">
        <div className="flex gap-2">
          <button type="button" onClick={() => setMode('transport')}
            className={'flex-1 rounded-lg border px-3 py-2 text-sm font-medium ' + (mode === 'transport' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-surface-line text-ink-soft hover:bg-surface-sunken')}>
            <Icon name="local_shipping" className="mr-1 text-[18px]" /> Transport
          </button>
          <button type="button" onClick={() => setMode('courier')}
            className={'flex-1 rounded-lg border px-3 py-2 text-sm font-medium ' + (mode === 'courier' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-surface-line text-ink-soft hover:bg-surface-sunken')}>
            <Icon name="local_post_office" className="mr-1 text-[18px]" /> Courier
          </button>
        </div>

        {mode === 'transport' ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Transport Vendor" className="sm:col-span-2">
              <CreatableCombobox items={vendorItems} value={vendorId} onChange={setVendorId} onCreate={createVendor} noun="transporter" placeholder="Type transporter name…" />
            </Field>
            <Field label="Vehicle">
              <CreatableCombobox items={vehItems} value={vehicleId} onChange={setVehicleId} onCreate={createVehicle} noun="vehicle" placeholder="DM TA 00-0000" format={formatVehicleNo} />
            </Field>
            <Field label="Driver">
              <CreatableCombobox items={drvItems} value={driverId} onChange={setDriverId} onCreate={createDriver} noun="driver" placeholder="Type driver name…" />
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Courier" className="sm:col-span-2">
              <CreatableCombobox items={courItems} value={courierId} onChange={setCourierId} onCreate={createCourier} noun="courier" placeholder="Type courier name…" />
            </Field>
            <Field label="Tracking No"><Input value={trackingNo} onChange={e => setTrackingNo(e.target.value)} placeholder="AWB / tracking" /></Field>
            <Field label="Charge"><Input type="number" value={charge} onChange={e => setCharge(e.target.value)} placeholder="0" /></Field>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button icon="local_shipping" loading={saving} onClick={save}>Assign</Button>
        </div>
      </div>
    </Modal>
  )
}

function SOOverview({ so, customerName, products, canEdit, onEdit, onClose }: any) {
  const [items, setItems] = useState<any[]>([])
  const [allocs, setAllocs] = useState<any[]>([])
  const [shipments, setShipments] = useState<any[]>([])
  const [pods, setPods] = useState<any[]>([])

  useEffect(() => {
    if (!so?.id) return
    supabase.from('sales_order_items').select('*').eq('so_id', so.id).then(({ data }) => setItems(data ?? []))
    ;(supabase as any).from('vehicle_allocations').select('allocation_no,status,allocation_date').eq('so_id', so.id).then(({ data }: any) => setAllocs(data ?? []))
    ;(supabase as any).from('courier_shipments').select('shipment_no,status,tracking_no,dispatch_date').eq('so_id', so.id).then(({ data }: any) => setShipments(data ?? []))
    ;(supabase as any).from('pod_collections').select('pod_no,status,received_by,received_date').eq('so_id', so.id).then(({ data }: any) => setPods(data ?? []))
  }, [so?.id])

  const productName = (id: string) => products.find((p: any) => p.id === id)?.name ?? id
  const hasLogistics = allocs.length > 0 || shipments.length > 0 || pods.length > 0

  const Stat = ({ label, value }: any) => (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <div className="mt-0.5 text-sm font-medium text-ink break-words">{value}</div>
    </div>
  )
  const Section = ({ title, children }: any) => (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{title}</p>
      {children}
    </div>
  )

  return (
    <Modal open onClose={onClose} title={`Sales Order — ${so.so_no}`} size="lg">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-surface-line bg-surface-sunken/40 p-4 sm:grid-cols-3">
          <Stat label="Customer" value={customerName} />
          <Stat label="Order Date" value={formatDate(so.order_date)} />
          <Stat label="Customer PO" value={so.reference_no ?? '—'} />
          <Stat label="Status" value={<Badge tone={tone(so.status)}>{so.status}</Badge>} />
          <Stat label="Total Qty" value={formatNumber(so.total_qty)} />
          <Stat label="Total Amount" value={formatNumber(so.total_amount)} />
        </div>

        <Section title="Workflow">
          <WorkflowPanel order={so} />
        </Section>

        {(so.sap_so_no || so.outbound_delivery_no || so.transfer_order_no || so.billing_doc_no) && (
          <Section title="SAP References">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-surface-line bg-surface-sunken/40 p-4 sm:grid-cols-4">
              <Stat label="SAP Sales Order" value={so.sap_so_no || '—'} />
              <Stat label="Outbound Delivery" value={so.outbound_delivery_no || '—'} />
              <Stat label="Transfer Order" value={so.transfer_order_no || '—'} />
              <Stat label="Billing Document" value={so.billing_doc_no || '—'} />
            </div>
          </Section>
        )}

        <Section title="Items">
          <div className="overflow-hidden rounded-xl border border-surface-line">
            {items.length === 0 ? <p className="p-3 text-sm text-ink-faint">No items</p> :
              items.map((it: any, i: number) => (
                <div key={it.id} className={'flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                  <span className="min-w-0 truncate text-ink">{productName(it.product_id)}</span>
                  <span className="shrink-0 text-ink-soft">{formatNumber(it.qty)} × {formatNumber(it.unit_price)}{Number(it.delivered_qty) > 0 ? ` · delivered ${formatNumber(it.delivered_qty)}` : ''}</span>
                </div>
              ))}
          </div>
        </Section>

        <Section title="Logistics">
          <div className="overflow-hidden rounded-xl border border-surface-line">
            {!hasLogistics ? (
              <div className="flex items-center gap-2 p-3.5 text-sm text-ink-faint">
                <Icon name="local_shipping" className="text-[18px]" /> No logistics assigned yet — use “Assign Logistics”.
              </div>
            ) : (
              [
                ...allocs.map((a: any) => ({ key: a.allocation_no, icon: 'local_shipping', label: `Vehicle Allocation · ${a.allocation_no}`, meta: `${a.status} · ${formatDate(a.allocation_date)}` })),
                ...shipments.map((c: any) => ({ key: c.shipment_no, icon: 'local_post_office', label: `Courier · ${c.shipment_no}${c.tracking_no ? ` (${c.tracking_no})` : ''}`, meta: `${c.status} · ${formatDate(c.dispatch_date)}` })),
                ...pods.map((p: any) => ({ key: p.pod_no, icon: 'fact_check', label: `POD · ${p.pod_no}${p.received_by ? ` (${p.received_by})` : ''}`, meta: `${p.status} · ${formatDate(p.received_date)}` }))
              ].map((row, i) => (
                <div key={row.key} className={'flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                  <span className="flex min-w-0 items-center gap-2 text-ink"><Icon name={row.icon} className="shrink-0 text-[18px] text-ink-faint" /> <span className="truncate">{row.label}</span></span>
                  <span className="shrink-0 text-ink-soft">{row.meta}</span>
                </div>
              ))
            )}
          </div>
        </Section>

        <Section title="Progress History — who, when & what changed">
          <DocTimeline table="sales_orders" recordId={so.id} />
        </Section>

        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          {canEdit && <Button icon="edit" onClick={onEdit}>Edit</Button>}
        </div>
      </div>
    </Modal>
  )
}


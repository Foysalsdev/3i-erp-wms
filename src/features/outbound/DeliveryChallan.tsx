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
import { DocTimeline } from '@/components/shared/DocTimeline'
import { ConfirmDelete } from '@/components/ui/ConfirmDelete'
import { SearchBar } from '@/components/shared/SearchBar'
import { useUrlSearch } from '@/hooks/useUrlSearch'
import { Field, Select, Input, Textarea } from '@/components/ui/Field'
import { LineItems, type LineRow } from '@/components/shared/LineItems'
import { Combobox } from '@/components/shared/Combobox'
import { formatNumber, formatDate, formatVehicleNo } from '@/lib/utils'
import { CreatableCombobox } from '@/components/shared/CreatableCombobox'

const today = () => new Date().toISOString().slice(0, 10)
const tone = (s: string) => s === 'delivered' ? 'positive' : s === 'cancelled' ? 'negative' : s === 'issued' ? 'info' : 'neutral'
const statusLabel = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '-'

export function DeliveryChallan() {
  const { data, loading, refresh } = useCollection('delivery_challans', { order: 'created_at' })
  const { currentClientId, can, isPlatformAdmin } = useAuth()
  const notify = useUI(s => s.notify)
  const canEdit = can('outbound.create') || can('outbound.edit')
  const canPost = can('outbound.approve') || can('outbound.post') || isPlatformAdmin
  const [q, setQ] = useUrlSearch()
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [overview, setOverview] = useState<any>(null)
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
    supabase.from('products').select('id,material_code,name,barcode,category,uom,plant').eq('client_id', currentClientId).then(({ data }) => setProducts(data ?? []))
  }, [currentClientId])

  const customerName = (id: string) => { const c = customers.find(x => x.id === id); return c ? `${c.customer_code} - ${c.name}` : '-' }

  const rows = useMemo(() => {
    if (!q.trim()) return data as any[]
    const t = q.toLowerCase()
    return (data as any[]).filter(r =>
      String(r.challan_no ?? '').toLowerCase().includes(t) ||
      String(r.invoice_no ?? '').toLowerCase().includes(t) ||
      String(r.po_no ?? '').toLowerCase().includes(t))
  }, [data, q])

  // Issue the challan: deduct stock for every line, then auto-create a linked gate pass.
  const issue = async (c: any) => {
    if (c.posted_at) { notify('info', 'This challan is already issued & stock deducted'); return }
    if (!c.warehouse_id) { notify('error', 'Set a warehouse on the challan before issuing'); return }
    setBusy(c.id)
    try {
      const { data: items } = await supabase.from('delivery_challan_items').select('*').eq('challan_id', c.id)
      if (!items || items.length === 0) { notify('error', 'Add line items before issuing'); return }
      const issuedSerials: string[] = []
      for (const it of items as any[]) {
        if (!it.product_id || !(Number(it.qty) > 0)) continue
        const { error } = await (supabase as any).rpc('post_stock_movement', {
          p_client: currentClientId, p_product: it.product_id, p_warehouse: c.warehouse_id,
          p_location: it.location_id || null, p_stock_status: it.stock_status || 'good',
          p_qty_in: 0, p_qty_out: Number(it.qty), p_movement_type: 'DELIVERY',
          p_reference_type: 'delivery_challan', p_reference_id: c.id, p_reference_no: c.challan_no,
          p_serial_no: it.serial_no || null, p_remarks: `Challan ${c.challan_no}${c.invoice_no ? ' - Invoice ' + c.invoice_no : ''}`
        })
        if (error) throw error
        if (it.serial_no) issuedSerials.push(it.serial_no)
      }
      // Mark each shipped serial delivered, tagged to this challan (full traceability).
      if (issuedSerials.length) {
        await supabase.from('serial_numbers').update({ status: 'delivered', reference_no: c.challan_no })
          .eq('client_id', currentClientId!).in('serial_no', issuedSerials)
      }
      // Auto gate pass for the same vehicle/driver.
      const gp_no = await nextDocNumber(currentClientId!, 'GP')
      if (gp_no) {
        await supabase.from('gate_passes').insert({
          client_id: currentClientId!, gate_pass_no: gp_no, vehicle_id: c.vehicle_id || null,
          driver_name: c.driver_name || null, gate_out_date: today(), status: 'issued',
          purpose: `Delivery - Challan ${c.challan_no}${c.invoice_no ? ', Invoice ' + c.invoice_no : ''}`
        })
      }
      // Partial fulfilment: bump delivered_qty on the linked sales-order lines,
      // then advance the order status (delivered when every line is complete).
      if (c.sales_order_id) {
        for (const it of items as any[]) {
          if (it.so_item_id && Number(it.qty) > 0) {
            const { data: soi } = await supabase.from('sales_order_items').select('delivered_qty').eq('id', it.so_item_id).single()
            await supabase.from('sales_order_items').update({ delivered_qty: Number(soi?.delivered_qty || 0) + Number(it.qty) }).eq('id', it.so_item_id)
          }
        }
        const { data: soLines } = await supabase.from('sales_order_items').select('qty,delivered_qty').eq('so_id', c.sales_order_id)
        const allDone = (soLines ?? []).length > 0 && (soLines ?? []).every((l: any) => Number(l.delivered_qty) >= Number(l.qty))
        await supabase.from('sales_orders').update({ status: allDone ? 'delivered' : 'dispatched' }).eq('id', c.sales_order_id)
      }
      const { error } = await supabase.from('delivery_challans').update({ posted_at: new Date().toISOString(), status: 'issued' }).eq('id', c.id)
      if (error) throw error
      notify('success', `${c.challan_no} issued - stock deducted${gp_no ? ' & gate pass ' + gp_no + ' created' : ''}`)
      refresh()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not issue challan')
    } finally {
      setBusy(null)
    }
  }

  const printChallan = async (c: any) => {
    const { data: items } = await supabase.from('delivery_challan_items').select('*').eq('challan_id', c.id)
    const pmap: Record<string, any> = {}; products.forEach((p: any) => { pmap[p.id] = p })
    const cust = customers.find((x: any) => x.id === c.customer_id)
    const veh = vehicles.find((x: any) => x.id === c.vehicle_id)
    const { downloadChallanPDF } = await import('@/pdf/DeliveryChallanPDF')
    await downloadChallanPDF({
      challan: c,
      customerName: cust ? `${cust.customer_code} - ${cust.name}` : '',
      vehicleNo: veh?.vehicle_number || '',
      items: (items ?? []).map((it: any, i: number) => { const p = pmap[it.product_id] || {}; return { sl: i + 1, description: p.name || '', material_code: p.material_code || '', category: p.category || '', qty: Number(it.qty) || 0, unit: p.uom || 'Pc', remarks: it.remarks || '' } })
    })
  }

  const openEdit = async (r: any) => {
    const { data: items } = await supabase.from('delivery_challan_items').select('*').eq('challan_id', r.id)
    setEditing({ ...r, __items: items ?? [] }); setModal(true)
  }

  const columns = [
    { key: 'challan_no', header: 'Challan No', accessor: (r: any) => r.challan_no, sortable: true, className: 'font-medium' },
    { key: 'invoice_no', header: 'SAP Invoice', accessor: (r: any) => r.invoice_no ?? '-' },
    { key: 'customer', header: 'Customer', render: (r: any) => customerName(r.customer_id) },
    { key: 'challan_date', header: 'Date', render: (r: any) => formatDate(r.challan_date) },
    { key: 'total_qty', header: 'Qty', accessor: (r: any) => formatNumber(r.total_qty), className: 'text-right' },
    { key: 'status', header: 'Status', render: (r: any) => (
      <div className="flex items-center gap-1">
        <Badge tone={tone(r.status)}>{statusLabel(r.status)}</Badge>
        {r.posted_at && <Badge tone="positive">Stock out</Badge>}
      </div>
    ) },
    {
      key: '__a', header: '', className: 'w-px whitespace-nowrap',
      render: (r: any) => (
        <div className="flex justify-end" onClick={e => e.stopPropagation()}>
          <ActionMenu items={[
            { icon: 'visibility', label: 'View', onClick: () => setOverview(r) },
            ...(canEdit ? [{ icon: 'edit', label: 'Edit', onClick: () => openEdit(r) }] : []),
            { icon: 'print', label: 'Print challan', onClick: () => printChallan(r) },
            ...(canPost && !r.posted_at ? [{ icon: 'check_circle', label: busy === r.id ? 'Issuing...' : 'Issue & Deduct Stock + Gate Pass', onClick: () => issue(r) }] : []),
            ...(isPlatformAdmin ? [{ icon: 'delete', label: 'Delete', tone: '!text-bad hover:!text-bad hover:!bg-bad/10', onClick: () => setDeleting(r) }] : [])
          ]} />
        </div>
      )
    }
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-72"><SearchBar value={q} onChange={setQ} placeholder="Search challan / invoice..." /></div>
        <span className="text-sm text-ink-soft">{rows.length} records</span>
        {canEdit && <Button className="ml-auto" icon="add" onClick={() => { setEditing(null); setModal(true) }}>New Challan</Button>}
      </div>

      <Card className="overflow-hidden">
        <DataTable columns={columns} rows={rows} loading={loading} rowKey={(r: any) => r.id}
          onRowClick={canEdit ? openEdit : undefined} emptyTitle="No delivery challans yet" />
      </Card>

      {modal && (
        <ChallanForm record={editing} customers={customers} warehouses={warehouses} vehicles={vehicles} products={products}
          clientId={currentClientId!} notify={notify}
          onClose={() => setModal(false)} onDone={() => { setModal(false); refresh() }} />
      )}

      {overview && (
        <ChallanOverview challan={overview} customerName={customerName(overview.customer_id)}
          vehicles={vehicles} products={products}
          canEdit={canEdit} onEdit={() => { const r = overview; setOverview(null); openEdit(r) }}
          onClose={() => setOverview(null)} />
      )}

      <ConfirmDelete open={!!deleting} onClose={() => setDeleting(null)}
        name={deleting ? `Challan - ${deleting.challan_no}` : undefined}
        onConfirm={async () => {
          const res = await supabase.from('delivery_challans').delete().eq('id', deleting.id)
          if (!res.error) { setDeleting(null); refresh() }
          return res
        }} />
    </div>
  )
}

function ChallanForm({ record, customers, warehouses, vehicles, products, clientId, notify, onClose, onDone }: any) {
  const [h, setH] = useState<any>(record ?? { challan_date: today(), status: 'draft' })
  const [lines, setLines] = useState<LineRow[]>(record?.__items ?? [])
  const [locations, setLocations] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const set = (patch: any) => setH((x: any) => ({ ...x, ...patch }))
  const posted = !!record?.posted_at
  const [vehs, setVehs] = useState<any[]>(vehicles)
  const vehItems = vehs.map((v: any) => ({ id: v.id, label: v.vehicle_number, sublabel: v.vehicle_type }))
  const createVehicle = async (name: string) => {
    const { data, error } = await (supabase as any).from('vehicles').insert({ client_id: clientId, vehicle_number: name }).select('*').single()
    if (error) { notify('error', error.message); return null }
    setVehs(v => [...v, data]); return { id: data.id, label: data.vehicle_number, sublabel: data.vehicle_type }
  }

  // Pick a sales order -> pull its customer, warehouse, PO, SAP invoice and lines
  // (so nothing is typed twice). Each line keeps its so_item_id for tracking.
  const [sos, setSos] = useState<any[]>([])
  useEffect(() => {
    if (!clientId) return
    supabase.from('sales_orders').select('id,so_no,customer_id,warehouse_id,reference_no,billing_doc_no,invoice_no').eq('client_id', clientId).not('status', 'in', '(closed,cancelled)').order('created_at', { ascending: false }).then(({ data }) => setSos(data ?? []))
  }, [clientId])
  const n = (v: any) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }
  const selectSO = async (soId: string) => {
    const so = sos.find((x: any) => x.id === soId)
    if (!so) { set({ sales_order_id: soId }); return }
    const { data: items } = await supabase.from('sales_order_items').select('id,product_id,qty,delivered_qty,unit_price').eq('so_id', soId)
    set({ sales_order_id: soId, customer_id: so.customer_id, warehouse_id: so.warehouse_id,
      po_no: so.reference_no || h.po_no, invoice_no: so.billing_doc_no || so.invoice_no || h.invoice_no })
    setLines((items ?? []).map((it: any) => ({
      product_id: it.product_id, qty: Math.max(0, n(it.qty) - n(it.delivered_qty)),
      unit_price: it.unit_price ?? 0, stock_status: 'good', so_item_id: it.id
    })))
  }

  useEffect(() => {
    if (!h.warehouse_id) { setLocations([]); return }
    supabase.from('locations').select('id,location_code').eq('warehouse_id', h.warehouse_id).then(({ data }) => setLocations(data ?? []))
  }, [h.warehouse_id])

  const save = async () => {
    const invoice = (h.invoice_no || '').trim()
    const validLines = lines.filter((r: LineRow) => r.product_id)
    if (!h.customer_id) { notify('error', 'Customer select korun'); return }
    if (!h.warehouse_id) { notify('error', 'Warehouse select korun (stock-out er jonno)'); return }
    if (!invoice) { notify('error', 'SAP Invoice No din - challan e eta thakbe'); return }
    if (validLines.length === 0) { notify('error', 'Onto ekta product line add korun'); return }
    const badLine = validLines.find((r: LineRow) => !(Number(r.qty) > 0))
    if (badLine) { notify('error', 'Protita line-e Quantity din (0 er beshi)'); return }
    setSaving(true)
    try {
      const totalQty = lines.reduce((s, r) => s + (Number(r.qty) || 0), 0)
      const header = {
        client_id: clientId, sales_order_id: h.sales_order_id || null, customer_id: h.customer_id || null, warehouse_id: h.warehouse_id || null,
        vehicle_id: h.vehicle_id || null, driver_name: h.driver_name || null, invoice_no: invoice,
        challan_date: h.challan_date || today(), total_qty: totalQty,
        po_no: h.po_no || null, dispatch_time: h.dispatch_time || null, lock_no: h.lock_no || null,
        driver_phone: h.driver_phone || null, transport_vendor: h.transport_vendor || null, prepared_by: h.prepared_by || null,
        receiver_name: h.receiver_name || null, receiver_phone: h.receiver_phone || null,
        unloading_point: h.unloading_point || null, bill_to_address: h.bill_to_address || null,
        status: h.status || 'draft', remarks: h.remarks || null
      }
      let challanId = record?.id
      if (record) {
        const { error } = await supabase.from('delivery_challans').update(header).eq('id', record.id)
        if (error) throw error
      } else {
        const challan_no = await nextDocNumber(clientId, 'DC')
        if (!challan_no) throw new Error('Could not generate challan number')
        const { data, error } = await supabase.from('delivery_challans').insert({ ...header, challan_no }).select('id').single()
        if (error) throw error
        challanId = data.id
      }
      await supabase.from('delivery_challan_items').delete().eq('challan_id', challanId)
      const payloadLines = lines.filter(r => r.product_id).map(r => ({
        client_id: clientId, challan_id: challanId, product_id: r.product_id, qty: Number(r.qty) || 0,
        unit_price: Number(r.unit_price) || 0, stock_status: r.stock_status || 'good', location_id: r.location_id || null, so_item_id: (r as any).so_item_id || null
      }))
      if (payloadLines.length) {
        const { error } = await supabase.from('delivery_challan_items').insert(payloadLines)
        if (error) throw error
      }
      notify('success', `Challan ${record ? 'updated' : 'created'}`)
      onDone()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not save challan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`${record ? 'Edit' : 'New'} Delivery Challan`} size="lg">
      <div className="space-y-4">
        {record && <div className="rounded-lg bg-surface-sunken px-3 py-2 text-sm"><span className="text-ink-faint">Challan No: </span><span className="font-semibold">{record.challan_no}</span>{posted && <span className="ml-2"><Badge tone="positive">Issued - stock out</Badge></span>}</div>}
        {posted && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">This challan is issued and stock is deducted. Editing lines will not change posted stock.</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Sales Order (auto-fills customer, items, PO & invoice)" className="sm:col-span-2">
            <Combobox items={sos.map((o: any) => ({ id: o.id, label: o.so_no, sublabel: customers.find((c: any) => c.id === o.customer_id)?.name }))} value={h.sales_order_id ?? ''} onChange={selectSO} placeholder="Search sales order by SO no" />
          </Field>
          <Field label="Customer" required>
            <Combobox items={customers.map((c: any) => ({ id: c.id, label: c.customer_code, sublabel: c.name }))} value={h.customer_id ?? ''} onChange={(id: string) => set({ customer_id: id })} placeholder="Search customer by code or name" />
          </Field>
          <Field label="Warehouse" required>
            <Select value={h.warehouse_id ?? ''} onChange={e => set({ warehouse_id: e.target.value })}>
              <option value="">Select...</option>
              {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.code} - {w.name}</option>)}
            </Select>
          </Field>
          <Field label="SAP Invoice No" required><Input value={h.invoice_no ?? ''} onChange={e => set({ invoice_no: e.target.value })} placeholder="SAP invoice number" /></Field>
          <Field label="Challan Date" required><Input type="date" value={h.challan_date ?? ''} onChange={e => set({ challan_date: e.target.value })} /></Field>
          <Field label="Vehicle">
            <CreatableCombobox items={vehItems} value={h.vehicle_id ?? ''} onChange={(id: string) => set({ vehicle_id: id })} onCreate={createVehicle} noun="vehicle" placeholder="DM TA 00-0000" format={formatVehicleNo} />
          </Field>
          <Field label="Driver Name"><Input value={h.driver_name ?? ''} onChange={e => set({ driver_name: e.target.value })} /></Field>
          <Field label="PO No"><Input value={h.po_no ?? ''} onChange={e => set({ po_no: e.target.value })} /></Field>
          <Field label="Dispatch Time"><Input value={h.dispatch_time ?? ''} onChange={e => set({ dispatch_time: e.target.value })} placeholder="e.g. 30/04/26 12:00 AM" /></Field>
          <Field label="Driver Phone"><Input value={h.driver_phone ?? ''} onChange={e => set({ driver_phone: e.target.value })} /></Field>
          <Field label="Lock No"><Input value={h.lock_no ?? ''} onChange={e => set({ lock_no: e.target.value })} /></Field>
          <Field label="Transport Vendor"><Input value={h.transport_vendor ?? ''} onChange={e => set({ transport_vendor: e.target.value })} /></Field>
          <Field label="Prepared By"><Input value={h.prepared_by ?? ''} onChange={e => set({ prepared_by: e.target.value })} /></Field>
          <Field label="Receiver Name"><Input value={h.receiver_name ?? ''} onChange={e => set({ receiver_name: e.target.value })} /></Field>
          <Field label="Receiver Phone"><Input value={h.receiver_phone ?? ''} onChange={e => set({ receiver_phone: e.target.value })} /></Field>
          <Field label="Unloading Point"><Input value={h.unloading_point ?? ''} onChange={e => set({ unloading_point: e.target.value })} /></Field>
          <Field label="Bill-To Address" className="sm:col-span-2"><Input value={h.bill_to_address ?? ''} onChange={e => set({ bill_to_address: e.target.value })} /></Field>
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

// Read-only 360° view of a challan: header, linked SO & gate pass, line items
// (with per-unit serials) and the full audit trail (WES: connected + audited).
function ChallanOverview({ challan, customerName, vehicles, products, canEdit, onEdit, onClose }: any) {
  const [items, setItems] = useState<any[]>([])
  const [so, setSo] = useState<any>(null)
  const [gatePasses, setGatePasses] = useState<any[]>([])

  useEffect(() => {
    if (!challan?.id) return
    supabase.from('delivery_challan_items').select('*').eq('challan_id', challan.id).then(({ data }) => setItems(data ?? []))
    if (challan.sales_order_id) supabase.from('sales_orders').select('so_no,status,reference_no').eq('id', challan.sales_order_id).single().then(({ data }) => setSo(data))
    // Gate pass auto-created on issue references the challan number in its purpose.
    ;(supabase as any).from('gate_passes').select('gate_pass_no,status,gate_out_date').ilike('purpose', `%${challan.challan_no}%`).then(({ data }: any) => setGatePasses(data ?? []))
  }, [challan?.id])

  const productName = (id: string) => products.find((p: any) => p.id === id)?.name ?? id
  const vehicleNo = vehicles.find((v: any) => v.id === challan.vehicle_id)?.vehicle_number

  const Stat = ({ label, value }: any) => (
    <div className="min-w-0"><p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{label}</p><div className="mt-0.5 text-sm font-medium text-ink break-words">{value}</div></div>
  )
  const Section = ({ title, children }: any) => (<div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{title}</p>{children}</div>)

  return (
    <Modal open onClose={onClose} title={`Delivery Challan — ${challan.challan_no}`} size="lg">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-surface-line bg-surface-sunken/40 p-4 sm:grid-cols-3">
          <Stat label="Customer" value={customerName} />
          <Stat label="Challan Date" value={formatDate(challan.challan_date)} />
          <Stat label="SAP Invoice" value={challan.invoice_no || '—'} />
          <Stat label="PO No" value={challan.po_no || '—'} />
          <Stat label="Vehicle" value={vehicleNo || '—'} />
          <Stat label="Status" value={<div className="flex items-center gap-1"><Badge tone={tone(challan.status)}>{statusLabel(challan.status)}</Badge>{challan.posted_at && <Badge tone="positive">Stock out</Badge>}</div>} />
        </div>

        <Section title="Linked documents">
          <div className="overflow-hidden rounded-xl border border-surface-line">
            {[
              ...(so ? [{ key: 'so', icon: 'shopping_cart', label: `Sales Order · ${so.so_no}`, meta: `${so.status}${so.reference_no ? ' · PO ' + so.reference_no : ''}` }] : []),
              ...gatePasses.map((g: any) => ({ key: g.gate_pass_no, icon: 'door_front', label: `Gate Pass · ${g.gate_pass_no}`, meta: `${g.status} · ${formatDate(g.gate_out_date)}` }))
            ].map((row, i) => (
              <div key={row.key} className={'flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                <span className="flex min-w-0 items-center gap-2 text-ink"><Icon name={row.icon} className="shrink-0 text-[18px] text-ink-faint" /> <span className="truncate">{row.label}</span></span>
                <span className="shrink-0 text-ink-soft">{row.meta}</span>
              </div>
            ))}
            {!so && gatePasses.length === 0 && <p className="p-3.5 text-sm text-ink-faint">No linked documents yet.</p>}
          </div>
        </Section>

        <Section title="Items">
          <div className="overflow-hidden rounded-xl border border-surface-line">
            {items.length === 0 ? <p className="p-3 text-sm text-ink-faint">No items</p> :
              items.map((it: any, i: number) => (
                <div key={it.id} className={'flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                  <span className="min-w-0 truncate text-ink">{productName(it.product_id)}{it.serial_no ? <span className="ml-2 font-mono text-xs text-ink-faint">SN {it.serial_no}</span> : null}</span>
                  <span className="shrink-0 text-ink-soft">{formatNumber(it.qty)}</span>
                </div>
              ))}
          </div>
        </Section>

        <Section title="Activity — who, when & what changed">
          <DocTimeline table="delivery_challans" recordId={challan.id} />
        </Section>

        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          {canEdit && <Button icon="edit" onClick={onEdit}>Edit</Button>}
        </div>
      </div>
    </Modal>
  )
}

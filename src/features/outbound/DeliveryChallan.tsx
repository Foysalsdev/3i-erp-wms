import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { useCollection } from '@/hooks/useCollection'
import { nextChallanNumber } from '@/hooks/useDocNumber'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { ActionMenu } from '@/components/ui/ActionMenu'
import { TrailPanel } from '@/components/shared/TrailPanel'
import { DocVersions } from '@/components/shared/DocVersions'
import { DocumentFlow } from '@/components/shared/DocumentFlow'
import { ConfirmDelete } from '@/components/ui/ConfirmDelete'
import { FilterPanel } from '@/components/ui/FilterPanel'
import { SearchBar } from '@/components/shared/SearchBar'
import { SavedViewsBar } from '@/components/shared/SavedViewsBar'
import { useUrlSearch } from '@/hooks/useUrlSearch'
import { useAutoOpen } from '@/hooks/useAutoOpen'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { SelectBox } from '@/components/ui/SelectBox'
import { LineItems, type LineRow } from '@/components/shared/LineItems'
import { Combobox } from '@/components/shared/Combobox'
import { formatNumber, formatDate, formatVehicleNo } from '@/lib/utils'
import { CreatableCombobox } from '@/components/shared/CreatableCombobox'
import { downloadChallanPdfFor } from './challanPdf'
import { loadSoInvoices, type SoInvoice } from './soInvoices'
import { VehicleLoadingScan } from './VehicleLoadingScan'
import { useRememberedField } from '@/hooks/useRememberedField'
import { DEFAULT_CHALLAN_NOTE } from '@/lib/constants'
import { fetchStockAvailability } from '@/lib/stockAvailability'
import type { Tables } from '@/types/database.types'

export type Challan = Tables<'delivery_challans'>
export type ChallanItem = Tables<'delivery_challan_items'>
export type ChallanView = Challan & { __items?: ChallanItem[] }
// Master lists arrive as narrow projections (only the columns the form needs).
export type CustomerLite = Pick<Tables<'customers'>, 'id' | 'customer_code' | 'name' | 'billing_address' | 'shipping_address'>
export type WarehouseLite = Pick<Tables<'warehouses'>, 'id' | 'code' | 'name'>
export type VehicleLite = Pick<Tables<'vehicles'>, 'id' | 'vehicle_number' | 'vehicle_type' | 'vendor_id' | 'driver_name' | 'driver_phone'>
export type ProductLite = Pick<Tables<'products'>, 'id' | 'material_code' | 'name' | 'barcode' | 'category' | 'uom' | 'plant'>
export type TransportVendorLite = Pick<Tables<'transport_vendors'>, 'id' | 'vendor_code' | 'name'>
export type CourierLite = Pick<Tables<'couriers'>, 'id' | 'courier_code' | 'name' | 'rate_per_unit'>
type Notify = (kind: 'success' | 'error' | 'info', msg: string) => void

const today = () => new Date().toISOString().slice(0, 10)
const tone = (s: string) => s === 'delivered' ? 'positive' : s === 'cancelled' ? 'negative' : s === 'issued' ? 'info' : 'neutral'
// 'issued' (stock deducted, goods on the vehicle) reads as "Dispatched" —
// never "Stock Out": deducting stock for a delivery does not mean the
// warehouse ran out of stock.
const statusLabel = (s: string) => s === 'issued' ? 'Dispatched' : s ? s.charAt(0).toUpperCase() + s.slice(1) : '-'
const DC_STATUS = ['draft', 'issued', 'delivered', 'cancelled']

export function DeliveryChallan() {
  const { data, loading, refresh } = useCollection('delivery_challans', { order: 'created_at' })
  const { currentClientId, can, isPlatformAdmin } = useAuth()
  const notify = useUI(s => s.notify)
  const canEdit = can('outbound.create') || can('outbound.edit')
  const canPost = can('outbound.approve') || can('outbound.post') || isPlatformAdmin
  const [q, setQ] = useUrlSearch()
  const [statusFilter, setStatusFilter] = useState('all')
  const [customerFilter, setCustomerFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<ChallanView | null>(null)
  useAutoOpen(() => { setEditing(null); setModal(true) })
  const [overview, setOverview] = useState<Challan | null>(null)
  const [cnFor, setCnFor] = useState<Challan | null>(null)
  const [loadingScan, setLoadingScan] = useState<Challan | null>(null)
  const [deleting, setDeleting] = useState<Challan | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [customers, setCustomers] = useState<CustomerLite[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseLite[]>([])
  const [vehicles, setVehicles] = useState<VehicleLite[]>([])
  const [products, setProducts] = useState<ProductLite[]>([])
  const [transportVendors, setTransportVendors] = useState<TransportVendorLite[]>([])
  const [couriers, setCouriers] = useState<CourierLite[]>([])

  useEffect(() => {
    if (!currentClientId) return
    supabase.from('customers').select('id,customer_code,name,billing_address,shipping_address').eq('client_id', currentClientId).then(({ data }) => setCustomers(data ?? []))
    supabase.from('warehouses').select('id,code,name').eq('client_id', currentClientId).then(({ data }) => setWarehouses(data ?? []))
    supabase.from('vehicles').select('id,vehicle_number,vehicle_type,vendor_id,driver_name,driver_phone').eq('client_id', currentClientId).then(({ data }) => setVehicles(data ?? []))
    supabase.from('products').select('id,material_code,name,barcode,category,uom,plant').eq('client_id', currentClientId).then(({ data }) => setProducts(data ?? []))
    supabase.from('transport_vendors').select('id,vendor_code,name').eq('client_id', currentClientId).eq('status', 'active').then(({ data }) => setTransportVendors(data ?? []))
    supabase.from('couriers').select('id,courier_code,name,rate_per_unit').eq('client_id', currentClientId).eq('status', 'active').then(({ data }) => setCouriers(data ?? []))
  }, [currentClientId])

  const customerName = (id: string | null) => { const c = customers.find(x => x.id === id); return c ? `${c.customer_code} - ${c.name}` : '-' }

  const rows = useMemo(() => {
    let out = statusFilter === 'all' ? data : data.filter(r => r.status === statusFilter)
    if (customerFilter) out = out.filter(r => r.customer_id === customerFilter)
    if (dateFrom) { const from = new Date(dateFrom); out = out.filter(r => new Date(r.challan_date) >= from) }
    if (dateTo) { const to = new Date(dateTo); to.setHours(23, 59, 59, 999); out = out.filter(r => new Date(r.challan_date) <= to) }
    if (!q.trim()) return out
    const t = q.toLowerCase()
    return out.filter(r =>
      String(r.challan_no ?? '').toLowerCase().includes(t) ||
      String(r.invoice_no ?? '').toLowerCase().includes(t) ||
      String(r.po_no ?? '').toLowerCase().includes(t))
  }, [data, q, statusFilter, customerFilter, dateFrom, dateTo])

  // Issue the challan: one atomic server-side function posts every line, bumps
  // the sales-order fulfilment, tags serials delivered and creates the gate
  // pass — all in one DB transaction. A multi-line challan where a later line
  // is short on stock now rolls back completely instead of leaving earlier
  // lines' stock already deducted while the challan itself stays unposted.
  const issue = async (c: Challan) => {
    if (c.posted_at) { notify('info', 'This challan is already issued & stock deducted'); return }
    if (!c.warehouse_id) { notify('error', 'Set a warehouse on the challan before issuing'); return }
    setBusy(c.id)
    try {
      const { data: gpNo, error } = await supabase.rpc('post_delivery_challan', { p_challan_id: c.id })
      if (error) throw error
      notify('success', `${c.challan_no} dispatched — stock deducted, dispatch time recorded${gpNo ? ' & gate pass ' + gpNo + ' created' : ''}`)
      refresh()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not issue challan')
    } finally {
      setBusy(null)
    }
  }

  const printChallan = async (c: Challan) => {
    try { await downloadChallanPdfFor(c, { customers, vehicles, products }) }
    catch (e: any) { notify('error', e?.message ?? 'Could not generate PDF') }
  }

  const openEdit = async (r: Challan) => {
    const { data: items } = await supabase.from('delivery_challan_items').select('*').eq('challan_id', r.id)
    setEditing({ ...r, __items: items ?? [] }); setModal(true)
  }

  const columns: Column<Challan>[] = [
    { key: 'challan_no', header: 'Challan No', accessor: r => r.challan_no, sortable: true, className: 'font-medium' },
    { key: 'invoice_no', header: 'SAP Invoice', accessor: r => r.invoice_no ?? '-', sortable: true },
    { key: 'customer', header: 'Customer', accessor: r => customerName(r.customer_id), sortable: true },
    { key: 'challan_date', header: 'Date', accessor: r => r.challan_date, render: r => formatDate(r.challan_date), sortable: true },
    { key: 'total_qty', header: 'Qty', accessor: r => r.total_qty, render: r => formatNumber(r.total_qty), className: 'text-right', sortable: true },
    { key: 'status', header: 'Status', accessor: r => r.status, sortable: true, render: r => (
      <div className="flex items-center gap-1">
        <Badge tone={tone(r.status)}>{statusLabel(r.status)}</Badge>
        {r.posted_at && r.status === 'draft' && <Badge tone="info">Stock deducted</Badge>}
      </div>
    ) },
    { key: 'dispatch_time', header: 'Dispatched At', accessor: (r: any) => r.dispatch_time ?? '', sortable: true,
      render: (r: any) => r.dispatch_time ? <span className="text-xs tabular-nums text-ink-soft">{r.dispatch_time}</span> : <span className="text-xs text-ink-faint">—</span> },
    {
      key: '__a', header: '', className: 'w-px whitespace-nowrap',
      render: r => (
        <div className="flex justify-end" onClick={e => e.stopPropagation()}>
          <ActionMenu items={[
            { icon: 'visibility', label: 'View', onClick: () => setOverview(r) },
            ...(canEdit ? [{ icon: 'edit', label: 'Edit', onClick: () => openEdit(r) }] : []),
            { icon: 'print', label: 'Print challan', onClick: () => printChallan(r) },
            // CN arrives when the courier actually picks up — let it be added
            // later without reopening the whole edit form.
            ...(canEdit && r.delivery_method === 'courier' ? [{ icon: 'qr_code', label: r.courier_tracking_no ? 'Update CN / Tracking' : 'Add CN / Tracking', onClick: () => setCnFor(r) }] : []),
            ...(canPost && !r.posted_at ? [{ icon: 'check_circle', label: busy === r.id ? 'Dispatching...' : 'Confirm Dispatch (stock + gate pass)', onClick: () => issue(r) }] : []),
            // Second scan of the workflow: verify what's physically loaded on
            // the vehicle against what was reserved during picking.
            ...(canPost && r.posted_at && r.sales_order_id ? [{ icon: 'qr_code_scanner', label: 'Load & Scan Vehicle', onClick: () => setLoadingScan(r) }] : []),
            // A dispatched (posted) challan has real stock movements behind it —
            // deleting it would orphan the deduction, so it is not deletable.
            ...(isPlatformAdmin && !r.posted_at ? [{ icon: 'delete', label: 'Delete', tone: '!text-bad hover:!text-bad hover:!bg-bad/10', onClick: () => setDeleting(r) }] : [])
          ]} />
        </div>
      )
    }
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-72"><SearchBar value={q} onChange={setQ} placeholder="Search challan / invoice..." /></div>
        <SelectBox value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-auto py-2">
          <option value="all">All statuses</option>
          {DC_STATUS.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </SelectBox>
        <FilterPanel activeCount={(customerFilter ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0)}
          onClear={() => { setCustomerFilter(''); setDateFrom(''); setDateTo('') }}>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Customer</label>
            <Combobox items={customers.map(c => ({ id: c.id, label: `${c.customer_code} — ${c.name}` }))}
              value={customerFilter} onChange={setCustomerFilter} placeholder="All customers" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft">Challan date from</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="fiori-input py-1.5 text-xs" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft">to</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="fiori-input py-1.5 text-xs" />
            </div>
          </div>
        </FilterPanel>
        <span className="text-sm text-ink-soft">{rows.length} records</span>
        {canEdit && <Button className="ml-auto" icon="add" onClick={() => { setEditing(null); setModal(true) }}>New Challan</Button>}
      </div>

      <SavedViewsBar scope="delivery-challan" current={{ q, statusFilter, customerFilter, dateFrom, dateTo }}
        onApply={s => {
          setQ(s.q ?? ''); setStatusFilter(s.statusFilter ?? 'all')
          setCustomerFilter(s.customerFilter ?? ''); setDateFrom(s.dateFrom ?? ''); setDateTo(s.dateTo ?? '')
        }} />

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DataTable fill columns={columns} rows={rows} loading={loading} rowKey={r => r.id}
          onRowClick={canEdit ? openEdit : undefined} emptyTitle="No delivery challans yet" />
      </Card>

      {modal && (
        <ChallanForm record={editing} customers={customers} warehouses={warehouses} vehicles={vehicles} products={products}
          transportVendors={transportVendors} couriers={couriers}
          clientId={currentClientId!} notify={notify}
          onClose={() => setModal(false)} onDone={() => { setModal(false); refresh() }} />
      )}

      {overview && (
        <ChallanOverview challan={overview} customerName={customerName(overview.customer_id)}
          vehicles={vehicles} products={products} transportVendors={transportVendors} couriers={couriers}
          canEdit={canEdit} onEdit={() => { const r = overview; setOverview(null); openEdit(r) }}
          onClose={() => setOverview(null)} />
      )}

      {cnFor && (
        <CnModal challan={cnFor} notify={notify}
          onClose={() => setCnFor(null)} onDone={() => { setCnFor(null); refresh() }} />
      )}

      {loadingScan && (
        <VehicleLoadingScan challan={loadingScan} vehicles={vehicles}
          onClose={() => setLoadingScan(null)} onDone={() => { setLoadingScan(null); refresh() }} />
      )}

      <ConfirmDelete open={!!deleting} onClose={() => setDeleting(null)}
        name={deleting ? `Challan - ${deleting.challan_no}` : undefined}
        onConfirm={async () => {
          const res = await supabase.from('delivery_challans').delete().eq('id', deleting!.id)
          if (!res.error) { setDeleting(null); refresh() }
          return res
        }} />
    </div>
  )
}

// Quick CN entry: the consignment number only exists once the courier picks the
// parcel up, so it's added to an already-created challan without a full edit.
function CnModal({ challan, notify, onClose, onDone }: { challan: Challan; notify: Notify; onClose: () => void; onDone: () => void }) {
  const [cn, setCn] = useState(challan.courier_tracking_no ?? '')
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    const { error } = await supabase.from('delivery_challans')
      .update({ courier_tracking_no: cn.trim() || null }).eq('id', challan.id)
    setSaving(false)
    if (error) { notify('error', error.message); return }
    notify('success', `CN saved for ${challan.challan_no}`)
    onDone()
  }
  return (
    <Modal open onClose={onClose} title={`CN / Tracking — ${challan.challan_no}`} size="md">
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">Courier: <b className="text-ink">{challan.courier_name || '—'}</b></p>
        <Field label="CN / Tracking No">
          <Input autoFocus value={cn} onChange={e => setCn(e.target.value)} placeholder="Consignment / AWB number" />
        </Field>
        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button icon="save" loading={saving} onClick={save}>Save CN</Button>
        </div>
      </div>
    </Modal>
  )
}

// `lockSo` opens the form straight from an order: customer / warehouse / invoice /
// PO are pulled in and locked, and the lines default to the still-pending qty.
type SalesOrderLite = Pick<Tables<'sales_orders'>, 'id' | 'so_no' | 'customer_id' | 'warehouse_id' | 'reference_no' | 'billing_doc_no' | 'invoice_no'>
// delivery_cost may hold the raw input string while the form is being typed into.
type ChallanDraft = Omit<Partial<Challan>, 'delivery_cost'> & { delivery_cost?: number | string | null; __items?: ChallanItem[] }

export function ChallanForm({ record, lockSo, customers, warehouses, vehicles, products, transportVendors = [], couriers = [], clientId, notify, onClose, onDone }: {
  record?: ChallanDraft | null; lockSo?: SalesOrderLite | null
  customers: CustomerLite[]; warehouses: WarehouseLite[]; vehicles: VehicleLite[]; products: ProductLite[]
  transportVendors?: TransportVendorLite[]; couriers?: CourierLite[]
  clientId: string; notify: Notify; onClose: () => void; onDone: () => void
}) {
  const profile = useAuth(s => s.profile)
  // The printed acknowledgement note is always pre-filled and remembers the
  // user's last edit across challans (per browser); an existing challan keeps
  // the note it was saved with.
  const [rememberedNote, rememberNote] = useRememberedField('print_note', DEFAULT_CHALLAN_NOTE, 'challan')
  // Prepared By defaults to whoever is logged in creating the challan.
  const [h, setH] = useState<ChallanDraft>(record ?? { challan_date: today(), status: 'draft', delivery_method: 'transport', prepared_by: profile?.full_name || '', print_note: rememberedNote })
  const [lines, setLines] = useState<LineRow[]>((record?.__items ?? []).map(it => ({
    product_id: it.product_id ?? '', qty: it.qty, unit_price: it.unit_price,
    stock_status: it.stock_status, location_id: it.location_id ?? undefined,
    serial_no: it.serial_no ?? undefined, so_item_id: it.so_item_id ?? undefined
  })))
  // Saleable stock per product, shown in the line picker so a shortage is
  // visible up front — issuing already blocks any line that would drive stock
  // negative, but this surfaces it before that point. The linked SO is
  // excluded so the order this challan fulfils doesn't count against itself.
  const [stockMap, setStockMap] = useState<Record<string, number>>({})
  useEffect(() => {
    if (!clientId) return
    fetchStockAvailability(clientId, h.sales_order_id ?? undefined).then(avail => {
      const m: Record<string, number> = {}
      Object.entries(avail).forEach(([pid, a]) => { m[pid] = a.saleable })
      setStockMap(m)
    })
  }, [clientId, h.sales_order_id])
  // Saved Bill-To / Ship-To addresses for the chosen customer (customer master
  // → Addresses). A customer can have many; the challan picks from them.
  const [custAddresses, setCustAddresses] = useState<Tables<'customer_addresses'>[]>([])
  useEffect(() => {
    if (!h.customer_id) { setCustAddresses([]); return }
    supabase.from('customer_addresses').select('*').eq('customer_id', h.customer_id).then(({ data }) => {
      const list = data ?? []
      setCustAddresses(list)
      // On a NEW challan, prefill from the customer's saved addresses: a
      // Billing-type for Bill-To, a Shipping-type for Ship-To, else the default.
      if (!record && list.length) {
        const def = list.find(a => a.is_default)
        const bill = list.find(a => a.address_type === 'Billing' || a.address_type === 'Both') || def || list[0]
        const ship = list.find(a => a.address_type === 'Shipping' || a.address_type === 'Both') || def || list[0]
        set({
          bill_to_address_id: bill?.id ?? null, bill_to_address: bill?.address ?? h.bill_to_address,
          ship_to_address_id: ship?.id ?? null, ship_to_address: ship?.address ?? h.ship_to_address
        })
      }
    })
  }, [h.customer_id])
  // Driver master for the picker; ad-hoc vendor drivers can still be typed free.
  const [drivers, setDrivers] = useState<Pick<Tables<'drivers'>, 'id' | 'name' | 'phone' | 'driver_code'>[]>([])
  useEffect(() => { supabase.from('drivers').select('id,name,phone,driver_code').order('name').then(({ data }) => setDrivers(data ?? [])) }, [])
  const [locations, setLocations] = useState<Pick<Tables<'locations'>, 'id' | 'location_code'>[]>([])
  const [saving, setSaving] = useState(false)
  const [more, setMore] = useState(false)
  const set = (patch: ChallanDraft) => setH(x => ({ ...x, ...patch }))

  // The order's invoice register: a challan linked to an order is always
  // raised UNDER one invoice, and its lines are capped by that invoice's
  // still-undelivered quantity. Non-invoiced quantity can never be planned.
  const [soInvoices, setSoInvoices] = useState<SoInvoice[]>([])
  const [soItems, setSoItems] = useState<any[]>([])
  const invRemaining = (inv: SoInvoice) => inv.lines.reduce((s, l) => s + Math.max(0, l.qty - l.delivered - l.planned), 0)
  const applyInvoice = (inv: SoInvoice, itemsArg?: any[]) => {
    const its = itemsArg ?? soItems
    set({ invoice_id: inv.id, invoice_no: inv.invoice_no })
    setLines(inv.lines.map((l: any) => {
      const it = its.find((x: any) => x.id === l.so_item_id)
      const remaining = Math.max(0, l.qty - l.delivered - l.planned)
      return {
        product_id: l.product_id, qty: remaining, unit_price: it?.unit_price ?? 0,
        stock_status: 'good', so_item_id: l.so_item_id,
        ordered_qty: Number(it?.qty ?? 0), already_delivered: Number(it?.delivered_qty ?? 0)
      } as LineRow
    }).filter((l: any) => Number(l.qty) > 0))
  }
  useEffect(() => {
    if (!h.sales_order_id) { setSoInvoices([]); setSoItems([]); return }
    let active = true
    loadSoInvoices(h.sales_order_id).then(({ items, invoices }) => {
      if (!active) return
      setSoItems(items); setSoInvoices(invoices)
      if (!record) {
        // New challan: when exactly one invoice still has qty to deliver,
        // pick it automatically and prefill its remaining lines.
        const open = invoices.filter(inv => invRemaining(inv) > 0)
        if (open.length === 1) applyInvoice(open[0], items)
      }
    })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h.sales_order_id])

  // Bill-To / Ship-To: pick a saved customer address (sets the link + copies
  // the text as a snapshot), still fully editable as free text below.
  const renderAddr = (label: string, idKey: 'bill_to_address_id' | 'ship_to_address_id', textKey: 'bill_to_address' | 'ship_to_address') => (
    <Field label={label} className="sm:col-span-2">
      {custAddresses.length > 0 && (
        <SelectBox className="mb-2" value={h[idKey] ?? ''} onChange={e => {
          const a = custAddresses.find(x => x.id === e.target.value)
          set({ [idKey]: e.target.value || null, ...(a ? { [textKey]: a.address } : {}) })
        }}>
          <option value="">— Pick a saved address —</option>
          {custAddresses.map(a => (
            <option key={a.id} value={a.id}>{[a.label, a.address_type].filter(Boolean).join(' · ') || 'Address'}{a.is_default ? ' (default)' : ''}</option>
          ))}
        </SelectBox>
      )}
      <Input value={h[textKey] ?? ''} onChange={e => set({ [idKey]: null, [textKey]: e.target.value })}
        placeholder={custAddresses.length ? 'Or type / edit the address' : 'Auto-filled from customer — or type here'} />
    </Field>
  )
  const posted = !!record?.posted_at
  const mode: 'transport' | 'courier' = h.delivery_method === 'courier' ? 'courier' : 'transport'
  const locked = !!lockSo && !record   // creating a new challan from a specific order
  const [vehs, setVehs] = useState<VehicleLite[]>(vehicles)
  useEffect(() => { setVehs(vehicles) }, [vehicles])
  const [tVendors, setTVendors] = useState<TransportVendorLite[]>(transportVendors)
  useEffect(() => { setTVendors(transportVendors) }, [transportVendors])
  const vehItems = vehs.map(v => ({ id: v.id, label: v.vehicle_number, sublabel: [v.vehicle_type, v.driver_name].filter(Boolean).join(' · ') || undefined }))
  const tVendorItems = tVendors.map(v => ({ id: v.id, label: v.vendor_code, sublabel: v.name }))
  const driverItems = drivers.map(d => ({ id: d.id, label: d.name, sublabel: d.phone || d.driver_code || undefined }))
  const courierItems = couriers.map(v => ({ id: v.id, label: v.courier_code, sublabel: v.name }))

  // Vehicle number is the operator's entry point: picking one auto-identifies
  // the transport vendor and driver it was last used with (remembered on every
  // save below). Both stay overridable — free text keeps working for ad-hoc
  // vendor drivers, and the override becomes the new remembered default.
  const onVehicle = (id: string) => {
    const v = vehs.find((x: any) => x.id === id)
    const vendor = v?.vendor_id ? tVendors.find((t: any) => t.id === v.vendor_id) : null
    set({
      vehicle_id: id,
      ...(v?.driver_name ? { driver_id: null, driver_name: v.driver_name } : {}),
      ...(v?.driver_phone ? { driver_phone: v.driver_phone } : {}),
      ...(vendor ? { transporter_id: vendor.id, transport_vendor: vendor.name } : {})
    })
  }
  const createDriver = async (name: string) => {
    const { data, error } = await (supabase as any).from('drivers').insert({ client_id: clientId, name }).select('*').single()
    if (error) { notify('error', error.message); return null }
    setDrivers(d => [...d, data])
    return { id: data.id, label: data.name, sublabel: data.phone || data.driver_code }
  }
  const createVendor = async (name: string) => {
    const { data, error } = await (supabase as any).from('transport_vendors')
      .insert({ client_id: clientId, name, vendor_code: 'TV' + String(Date.now()).slice(-6), status: 'active' }).select('*').single()
    if (error) { notify('error', error.message); return null }
    setTVendors(v => [...v, data])
    return { id: data.id, label: data.vendor_code, sublabel: data.name }
  }

  // Courier rate card: per-piece rate by product category, falling back to the
  // courier's flat rate_per_unit for categories without one.
  const [courierRates, setCourierRates] = useState<Pick<Tables<'courier_rates'>, 'courier_id' | 'category' | 'rate'>[]>([])
  useEffect(() => {
    if (!clientId) return
    supabase.from('courier_rates').select('courier_id,category,rate').eq('client_id', clientId)
      .then(({ data }) => setCourierRates(data ?? []))
  }, [clientId])
  const courierBill = (courierId: string) => {
    const c = couriers.find(x => x.id === courierId)
    if (!c) return null
    const rateMap: Record<string, number> = Object.fromEntries(courierRates.filter(r => r.courier_id === courierId).map(r => [r.category, Number(r.rate) || 0]))
    const fallback = Number(c.rate_per_unit) || 0
    const byCat: Record<string, number> = {}
    for (const l of lines) {
      if (!l.product_id || !(Number(l.qty) > 0)) continue
      const cat = products.find(p => p.id === l.product_id)?.category || 'Other'
      byCat[cat] = (byCat[cat] || 0) + Number(l.qty)
    }
    let total = 0
    const parts: string[] = []
    for (const [cat, qty] of Object.entries(byCat)) {
      const rate = rateMap[cat] ?? fallback
      total += qty * rate
      parts.push(`${cat} ${qty}×${rate}`)
    }
    return { total, formula: parts.join(' + ') }
  }
  const createVehicle = async (name: string) => {
    const { data, error } = await supabase.from('vehicles').insert({ client_id: clientId, vehicle_number: name }).select('*').single()
    if (error) { notify('error', error.message); return null }
    setVehs(v => [...v, data]); return { id: data.id, label: data.vehicle_number, sublabel: data.vehicle_type ?? undefined }
  }

  // Pull an order's customer, warehouse and PO (so nothing is typed twice).
  // The LINES are not prefilled here any more — they come from the selected
  // invoice (see applyInvoice above), because only invoiced quantity may be
  // planned onto a challan.
  const loadFromSO = async (so: SalesOrderLite) => {
    const cust = customers.find(c => c.id === so.customer_id)
    setH(x => ({ ...x, sales_order_id: so.id, customer_id: so.customer_id, warehouse_id: so.warehouse_id,
      po_no: so.reference_no || x.po_no,
      bill_to_address: x.bill_to_address || cust?.billing_address || '',
      ship_to_address: x.ship_to_address || cust?.shipping_address || '' }))
    setLines([])
  }

  // Order picker (only when not locked to a specific order).
  const [sos, setSos] = useState<SalesOrderLite[]>([])
  useEffect(() => {
    if (!clientId || locked) return
    // Delivered orders have nothing left to plan, and unapproved orders
    // (draft/pending/rejected) may not be delivered at all — the approval
    // step always comes first.
    supabase.from('sales_orders').select('id,so_no,customer_id,warehouse_id,reference_no,billing_doc_no,invoice_no').eq('client_id', clientId).not('status', 'in', '(draft,pending,rejected,delivered,closed,cancelled)').order('created_at', { ascending: false }).then(({ data }) => setSos(data ?? []))
  }, [clientId, locked])
  const selectSO = async (soId: string) => {
    const so = sos.find(x => x.id === soId)
    if (!so) { set({ sales_order_id: soId }); return }
    await loadFromSO(so)
  }
  // When opened from an order, pre-fill once on mount.
  useEffect(() => { if (lockSo && !record) loadFromSO(lockSo) /* eslint-disable-next-line */ }, [])

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
    // Order-linked challans deliver UNDER an invoice, and each line is capped
    // at that invoice's still-unplanned quantity — the non-invoiced remainder
    // of the order physically cannot be put on a challan. (post_delivery_challan
    // re-checks all of this server-side at issue time.)
    if (h.sales_order_id && !posted) {
      if (soInvoices.length === 0) { notify('error', 'No SAP invoice is recorded on this order yet — add it via “Invoices (SAP)” first. Non-invoiced quantity cannot go on a challan.'); return }
      if (!h.invoice_id) { notify('error', 'Select which invoice this challan delivers'); return }
      const inv = soInvoices.find(i => i.id === h.invoice_id)
      for (const r of validLines) {
        const soItemId = (r as any).so_item_id
        if (!soItemId) { notify('error', 'Every line must come from the selected invoice — remove manually added products'); return }
        const l = inv?.lines.find((x: any) => x.so_item_id === soItemId)
        if (!l) { notify('error', `A line is not on invoice ${inv?.invoice_no} — pick the right invoice or remove it`); return }
        // `planned` already counts this challan's previously saved lines; add
        // them back so editing a saved challan doesn't cap against itself.
        const own = record ? Number((record.__items ?? []).find((x: any) => x.so_item_id === soItemId)?.qty ?? 0) : 0
        const cap = Math.max(0, l.qty - l.delivered - l.planned) + own
        if (Number(r.qty) > cap) {
          notify('error', `Invoice ${inv!.invoice_no}: only ${cap} pcs remaining for ${products.find((p: any) => p.id === r.product_id)?.material_code ?? 'this model'}`)
          return
        }
      }
    }
    setSaving(true)
    try {
      const totalQty = lines.reduce((s, r) => s + (Number(r.qty) || 0), 0)
      const header = {
        client_id: clientId, sales_order_id: h.sales_order_id || null, customer_id: h.customer_id || null, warehouse_id: h.warehouse_id || null,
        invoice_id: h.invoice_id || null,
        invoice_no: invoice, challan_date: h.challan_date || today(), total_qty: totalQty, po_no: h.po_no || null,
        delivery_method: mode, delivery_cost: h.delivery_cost === '' || h.delivery_cost == null ? null : Number(h.delivery_cost),
        // transport details
        vehicle_id: mode === 'transport' ? (h.vehicle_id || null) : null,
        driver_id: mode === 'transport' ? (h.driver_id || null) : null,
        driver_name: mode === 'transport' ? (h.driver_name || null) : null,
        driver_phone: mode === 'transport' ? (h.driver_phone || null) : null,
        transporter_id: mode === 'transport' ? (h.transporter_id || null) : null,
        transport_vendor: mode === 'transport' ? (h.transport_vendor || null) : null,
        lock_no: mode === 'transport' ? (h.lock_no || null) : null,
        // courier details
        courier_id: mode === 'courier' ? (h.courier_id || null) : null,
        courier_name: mode === 'courier' ? (h.courier_name || null) : null,
        courier_tracking_no: mode === 'courier' ? (h.courier_tracking_no || null) : null,
        // optional extras
        dispatch_time: h.dispatch_time || null, prepared_by: h.prepared_by || null,
        receiver_name: h.receiver_name || null, receiver_phone: h.receiver_phone || null,
        unloading_point: h.unloading_point || null,
        bill_to_address: h.bill_to_address || null, bill_to_address_id: h.bill_to_address_id || null,
        ship_to_address: h.ship_to_address || null, ship_to_address_id: h.ship_to_address_id || null,
        status: h.status || 'draft', remarks: h.remarks || null,
        print_note: (h.print_note ?? rememberedNote) || null
      }
      // Remember this note as the default for the next challan.
      if (h.print_note) rememberNote(h.print_note)
      let challanId = record?.id
      if (record) {
        const { error } = await supabase.from('delivery_challans').update(header).eq('id', record.id!)
        if (error) throw error
      } else {
        const challan_no = await nextChallanNumber(clientId, invoice)
        if (!challan_no) throw new Error('Could not generate challan number')
        const { data, error } = await supabase.from('delivery_challans').insert({ ...header, challan_no }).select('id').single()
        if (error) throw error
        challanId = data.id
      }
      if (!challanId) throw new Error('Challan id missing after save')
      // A dispatched challan's lines are frozen — they are the record of what
      // physically left (a DB trigger blocks changes too). Only header details
      // (receiver, CN, addresses, remarks) stay editable after dispatch.
      if (!posted) {
        await supabase.from('delivery_challan_items').delete().eq('challan_id', challanId)
        const payloadLines = lines.filter(r => r.product_id).map(r => ({
          client_id: clientId, challan_id: challanId, product_id: r.product_id, qty: Number(r.qty) || 0,
          unit_price: Number(r.unit_price) || 0, stock_status: r.stock_status || 'good', location_id: r.location_id || null, so_item_id: r.so_item_id || null
        }))
        if (payloadLines.length) {
          const { error } = await supabase.from('delivery_challan_items').insert(payloadLines)
          if (error) throw error
        }
      }
      // Remember the vehicle ↔ vendor/driver combination just used, so the
      // next challan with this vehicle auto-fills them (fire-and-forget:
      // failure here must not block the challan itself).
      if (mode === 'transport' && h.vehicle_id) {
        supabase.from('vehicles').update({
          driver_name: h.driver_name || null, driver_phone: h.driver_phone || null, vendor_id: h.transporter_id || null
        }).eq('id', h.vehicle_id).then(() => {})
      }
      notify('success', `Challan ${record ? 'updated' : 'created'}`)
      onDone()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not save challan')
    } finally {
      setSaving(false)
    }
  }

  const ModeButton = ({ m, icon, label }: { m: 'transport' | 'courier'; icon: string; label: string }) => (
    <button type="button" onClick={() => set({ delivery_method: m })}
      className={'flex-1 rounded-lg border px-3 py-2 text-sm font-medium ' + (mode === m ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-surface-line text-ink-soft hover:bg-surface-sunken')}>
      <Icon name={icon} className="mr-1 text-[18px]" /> {label}
    </button>
  )

  return (
    <Modal open onClose={onClose} title={`${record ? 'Edit' : lockSo ? 'Plan Delivery' : 'New'} Delivery Challan${lockSo ? ' — ' + lockSo.so_no : ''}`} size="lg">
      <div className="space-y-4">
        {record && <div className="rounded-lg bg-surface-sunken px-3 py-2 text-sm"><span className="text-ink-faint">Challan No: </span><span className="font-semibold">{record.challan_no}</span>{posted && <span className="ml-2"><Badge tone="info">Dispatched — stock deducted</Badge></span>}{record.dispatch_time && <span className="ml-2 text-xs text-ink-soft">Dispatched at {record.dispatch_time}</span>}</div>}
        {posted && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">This challan is dispatched and stock is deducted. Editing lines will not change posted stock.</p>}

        {locked ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-xl border border-surface-line bg-surface-sunken/40 p-3 text-sm sm:grid-cols-4">
            <div><p className="text-[11px] uppercase tracking-wide text-ink-faint">Customer</p><p className="font-medium text-ink">{customers.find(c => c.id === h.customer_id)?.name ?? '—'}</p></div>
            <div><p className="text-[11px] uppercase tracking-wide text-ink-faint">Order Ref</p><p className="font-medium text-ink">{h.po_no || '—'}</p></div>
            <div><p className="text-[11px] uppercase tracking-wide text-ink-faint">SAP Invoice</p><p className="font-medium text-ink">{h.invoice_no || '—'}</p></div>
            <div><p className="text-[11px] uppercase tracking-wide text-ink-faint">Warehouse</p><p className="font-medium text-ink">{warehouses.find(w => w.id === h.warehouse_id)?.code ?? '—'}</p></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Sales Order (auto-fills customer, PO & invoices)" className="col-span-full">
              <Combobox items={sos.map(o => ({ id: o.id, label: o.so_no, sublabel: customers.find(c => c.id === o.customer_id)?.name }))} value={h.sales_order_id ?? ''} onChange={selectSO} placeholder="Search sales order by SO no" />
            </Field>
            <Field label="Customer" required>
              <Combobox items={customers.map(c => ({ id: c.id, label: c.customer_code, sublabel: c.name }))} value={h.customer_id ?? ''}
                onChange={(id: string) => { const c = customers.find(x => x.id === id); set({ customer_id: id, bill_to_address: c?.billing_address || '', ship_to_address: c?.shipping_address || '' }) }}
                placeholder="Search customer by code or name" />
            </Field>
            <Field label="Warehouse" required>
              <SelectBox value={h.warehouse_id ?? ''} onChange={e => set({ warehouse_id: e.target.value })}>
                <option value="">Select...</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.code} - {w.name}</option>)}
              </SelectBox>
            </Field>
            {!h.sales_order_id && (
              <Field label="SAP Invoice No" required>
                <Input value={h.invoice_no ?? ''} onChange={e => set({ invoice_no: e.target.value })} placeholder="SAP invoice number" />
              </Field>
            )}
          </div>
        )}

        {/* Order-linked challans always deliver UNDER one recorded invoice —
            picking it prefills the lines with that invoice's remaining qty. */}
        {h.sales_order_id && (soInvoices.length === 0 ? (
          <p className="rounded-lg border border-bad/30 bg-bad/5 px-3 py-2 text-sm text-bad">
            No SAP invoice is recorded on this order yet. Record it via the order's “Invoices (SAP)” action first — non-invoiced quantity cannot go on a delivery challan.
          </p>
        ) : (
          <Field label="Deliver Under Invoice" required>
            <SelectBox value={h.invoice_id ?? ''} disabled={posted} onChange={e => {
              const inv = soInvoices.find(i => i.id === e.target.value)
              if (inv) applyInvoice(inv)
            }}>
              <option value="">Select the invoice this challan delivers…</option>
              {soInvoices.map(inv => (
                <option key={inv.id} value={inv.id}>
                  {`${inv.invoice_no} — ${formatNumber(inv.qty)} pcs · ${formatNumber(invRemaining(inv))} still to deliver`}
                </option>
              ))}
            </SelectBox>
            {h.invoice_id && (() => {
              const inv = soInvoices.find(i => i.id === h.invoice_id)
              if (!inv) return null
              return <p className="mt-1 text-[11px] text-ink-faint">Invoice {inv.invoice_no}: {formatNumber(inv.qty)} pcs invoiced · {formatNumber(inv.delivered)} delivered · {formatNumber(invRemaining(inv))} remaining to plan</p>
            })()}
          </Field>
        ))}

        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-soft">Delivery by</p>
          <div className="flex gap-2">
            <ModeButton m="transport" icon="local_shipping" label="Transport" />
            <ModeButton m="courier" icon="local_post_office" label="Courier" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Challan Date" required><Input type="date" value={h.challan_date ?? ''} onChange={e => set({ challan_date: e.target.value })} /></Field>
          {mode === 'transport' ? (
            <>
              <Field label="Vehicle (auto-fills vendor & driver)">
                <CreatableCombobox items={vehItems} value={h.vehicle_id ?? ''} onChange={onVehicle} onCreate={createVehicle} noun="vehicle" placeholder="DM TA 00-0000" format={formatVehicleNo} />
              </Field>
              <Field label="Transport Vendor">
                <CreatableCombobox items={tVendorItems} value={h.transporter_id ?? ''}
                  onChange={(id: string) => { const v = tVendors.find((x: any) => x.id === id); set({ transporter_id: id, transport_vendor: v?.name || '' }) }}
                  onCreate={createVendor} noun="transport vendor" placeholder="Search or add a transporter" />
              </Field>
              <Field label="Driver">
                <CreatableCombobox items={driverItems} value={h.driver_id ?? ''}
                  onChange={(id: string) => { const d = drivers.find(x => x.id === id); set({ driver_id: id, driver_name: d?.name || h.driver_name, driver_phone: d?.phone || h.driver_phone }) }}
                  onCreate={createDriver} noun="driver" placeholder="Search or add a driver" />
              </Field>
              <Field label="Driver Name (free text)"><Input value={h.driver_name ?? ''} onChange={e => set({ driver_id: null, driver_name: e.target.value })} placeholder="Or type — ad-hoc / vendor driver" /></Field>
              <Field label="Driver Phone"><Input value={h.driver_phone ?? ''} onChange={e => set({ driver_phone: e.target.value })} /></Field>
              <Field label="Lock No"><Input value={h.lock_no ?? ''} onChange={e => set({ lock_no: e.target.value })} /></Field>
              <Field label="Transport Cost / Trip (BDT)">
                <Input type="number" value={h.delivery_cost ?? ''} onChange={e => set({ delivery_cost: e.target.value })} placeholder="Vehicle fare for this trip" />
              </Field>
            </>
          ) : (
            <>
              <Field label="Courier">
                <Combobox items={courierItems} value={h.courier_id ?? ''}
                  onChange={(id: string) => {
                    const v = couriers.find(x => x.id === id)
                    // Couriers bill per piece with category-wise rates — prime the
                    // bill from the rate card; stays editable for negotiated cases.
                    const bill = courierBill(id)
                    set({ courier_id: id, courier_name: v?.name || '', ...(bill && bill.total > 0 ? { delivery_cost: bill.total } : {}) })
                  }}
                  placeholder="Search courier by code or name" />
              </Field>
              <Field label="CN / Tracking No"><Input value={h.courier_tracking_no ?? ''} onChange={e => set({ courier_tracking_no: e.target.value })} placeholder="Consignment / AWB number" /></Field>
              <Field label="Courier Bill (BDT)">
                <Input type="number" value={h.delivery_cost ?? ''} onChange={e => set({ delivery_cost: e.target.value })} placeholder="Per-piece billed" />
                {(() => {
                  const bill = h.courier_id ? courierBill(h.courier_id) : null
                  if (!bill || !bill.formula) return null
                  const stale = Number(h.delivery_cost) !== bill.total
                  return (
                    <p className="mt-1 flex items-center gap-2 text-xs text-ink-faint">
                      <span>{bill.formula} = <b className="text-ink-soft">{bill.total}</b></span>
                      {stale && bill.total > 0 && (
                        <button type="button" onClick={() => set({ delivery_cost: bill.total })}
                          className="font-medium text-brand-600 hover:underline">Apply</button>
                      )}
                    </p>
                  )
                })()}
              </Field>
            </>
          )}
        </div>

        <button type="button" onClick={() => setMore(m => !m)} className="text-xs font-medium text-brand-600 hover:underline">
          {more ? '− Hide' : '+ More'} details (receiver, dispatch time, addresses)
        </button>
        {more && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {!locked && <Field label="Order Ref"><Input value={h.po_no ?? ''} onChange={e => set({ po_no: e.target.value })} /></Field>}
            <Field label="Dispatch Date & Time (automatic)">
              {/* System-stamped at the moment the challan is issued — never typed. */}
              <p className="fiori-input flex items-center border-surface-line bg-surface-sunken text-ink-soft">
                {h.dispatch_time || 'Stamped automatically when the challan is issued'}
              </p>
            </Field>
            <Field label="Prepared By"><Input value={h.prepared_by ?? ''} onChange={e => set({ prepared_by: e.target.value })} /></Field>
            <Field label="Receiver Name"><Input value={h.receiver_name ?? ''} onChange={e => set({ receiver_name: e.target.value })} /></Field>
            <Field label="Receiver Phone"><Input value={h.receiver_phone ?? ''} onChange={e => set({ receiver_phone: e.target.value })} /></Field>
            <Field label="Unloading Point"><Input value={h.unloading_point ?? ''} onChange={e => set({ unloading_point: e.target.value })} /></Field>
            {renderAddr('Bill-To Address', 'bill_to_address_id', 'bill_to_address')}
            {renderAddr('Ship-To Address', 'ship_to_address_id', 'ship_to_address')}
          </div>
        )}

        <Field label="Remarks"><Textarea value={h.remarks ?? ''} onChange={e => set({ remarks: e.target.value })} /></Field>

        <Field label="Printed Note (acknowledgement line on the challan)">
          <Textarea value={h.print_note ?? rememberedNote} onChange={e => set({ print_note: e.target.value })}
            placeholder={DEFAULT_CHALLAN_NOTE} className="min-h-[56px]" />
        </Field>

        {posted ? (
          <div>
            <h4 className="mb-2 text-sm font-medium text-ink-soft">Line items (dispatched — locked)</h4>
            <div className="overflow-hidden rounded-lg border border-surface-line">
              {lines.map((r: any, i: number) => {
                const p = products.find((x: any) => x.id === r.product_id)
                return (
                  <div key={i} className={'flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                    <span className="min-w-0 truncate text-ink">{p ? `${p.material_code} — ${p.name}` : r.product_id}</span>
                    <span className="shrink-0 font-medium text-ink">{formatNumber(r.qty)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <LineItems rows={lines} onChange={setLines} products={products} locations={locations} variant="out" stock={stockMap} />
        )}

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
function ChallanOverview({ challan, customerName, vehicles, products, transportVendors = [], couriers = [], canEdit, onEdit, onClose }: {
  challan: Challan; customerName: string; vehicles: VehicleLite[]; products: ProductLite[]
  transportVendors?: TransportVendorLite[]; couriers?: CourierLite[]
  canEdit: boolean; onEdit: () => void; onClose: () => void
}) {
  const [items, setItems] = useState<ChallanItem[]>([])
  const [so, setSo] = useState<Pick<Tables<'sales_orders'>, 'so_no' | 'status' | 'reference_no'> | null>(null)
  const [gatePasses, setGatePasses] = useState<Pick<Tables<'gate_passes'>, 'gate_pass_no' | 'status' | 'gate_out_date'>[]>([])

  useEffect(() => {
    if (!challan?.id) return
    supabase.from('delivery_challan_items').select('*').eq('challan_id', challan.id).then(({ data }) => setItems(data ?? []))
    if (challan.sales_order_id) supabase.from('sales_orders').select('so_no,status,reference_no').eq('id', challan.sales_order_id).single().then(({ data }) => setSo(data))
    // Gate pass auto-created on issue references the challan number in its purpose.
    supabase.from('gate_passes').select('gate_pass_no,status,gate_out_date').ilike('purpose', `%${challan.challan_no}%`).then(({ data }) => setGatePasses(data ?? []))
  }, [challan?.id])

  const productName = (id: string | null) => products.find(p => p.id === id)?.name ?? id ?? '—'
  const vehicleNo = vehicles.find(v => v.id === challan.vehicle_id)?.vehicle_number
  const carrier = challan.delivery_method === 'courier'
    ? (couriers.find(c => c.id === challan.courier_id)?.name || challan.courier_name || '—')
    : (transportVendors.find(v => v.id === challan.transporter_id)?.name || challan.transport_vendor || '—')

  const Stat = ({ label, value }: { label: string; value: ReactNode }) => (
    <div className="min-w-0"><p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{label}</p><div className="mt-0.5 text-sm font-medium text-ink break-words">{value}</div></div>
  )
  const Section = ({ title, children }: { title: string; children: ReactNode }) => (<div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{title}</p>{children}</div>)

  return (
    <Modal open onClose={onClose} title={`Delivery Challan — ${challan.challan_no}`} size="lg">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-surface-line bg-surface-sunken/40 p-4 sm:grid-cols-3">
          <Stat label="Customer" value={customerName} />
          <Stat label="Challan Date" value={formatDate(challan.challan_date)} />
          <Stat label="SAP Invoice" value={challan.invoice_no || '—'} />
          <Stat label="PO No" value={challan.po_no || '—'} />
          <Stat label="Vehicle" value={vehicleNo || '—'} />
          <Stat label={challan.delivery_method === 'courier' ? 'Courier' : 'Transport Vendor'} value={carrier} />
          {challan.delivery_method === 'courier' && <Stat label="CN / Tracking" value={challan.courier_tracking_no || '—'} />}
          <Stat label={challan.delivery_method === 'courier' ? 'Courier Bill' : 'Transport Cost'} value={challan.delivery_cost != null ? formatNumber(challan.delivery_cost) : '—'} />
          <Stat label="Status" value={<div className="flex items-center gap-1"><Badge tone={tone(challan.status)}>{statusLabel(challan.status)}</Badge></div>} />
          <Stat label="Dispatched At" value={challan.dispatch_time || '—'} />
        </div>

        <DocumentFlow nodes={[
          so ? { icon: 'shopping_cart', type: 'Sales Order', number: so.so_no, status: so.status, to: `/outbound/sales-order?q=${encodeURIComponent(so.so_no)}` } : null,
          { icon: 'local_shipping', type: 'Delivery Challan', number: challan.challan_no, status: statusLabel(challan.status), tone: tone(challan.status), current: true },
          ...gatePasses.map(g => ({ icon: 'door_front', type: 'Gate Pass', number: g.gate_pass_no, status: g.status, to: `/outbound/gate-pass?q=${encodeURIComponent(g.gate_pass_no)}` }))
        ]} />

        <Section title="Items">
          <div className="overflow-hidden rounded-xl border border-surface-line">
            {items.length === 0 ? <p className="p-3 text-sm text-ink-faint">No items</p> :
              items.map((it, i) => (
                <div key={it.id} className={'flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                  <span className="min-w-0 truncate text-ink">{productName(it.product_id)}{it.serial_no ? <span className="ml-2 font-mono text-xs text-ink-faint">SN {it.serial_no}</span> : null}</span>
                  <span className="shrink-0 text-ink-soft">{formatNumber(it.qty)}</span>
                </div>
              ))}
          </div>
        </Section>

        <Section title="Activity & stock movement">
          <TrailPanel table="delivery_challans" recordId={challan.id} referenceNo={challan.challan_no} />
        </Section>

        <Section title="Document Versions">
          <DocVersions table="delivery_challans" recordId={challan.id} />
        </Section>

        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          {canEdit && <Button icon="edit" onClick={onEdit}>Edit</Button>}
        </div>
      </div>
    </Modal>
  )
}

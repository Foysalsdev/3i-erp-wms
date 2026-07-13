import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { useCollection } from '@/hooks/useCollection'
import { nextDocNumber } from '@/hooks/useDocNumber'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Icon } from '@/components/ui/Icon'
import { LoadingRing } from '@/components/ui/LoadingRing'
import { Modal } from '@/components/ui/Modal'
import { ActionMenu } from '@/components/ui/ActionMenu'
import { ConfirmDelete } from '@/components/ui/ConfirmDelete'
import { Tabs } from '@/components/ui/Tabs'
import { FilterPanel } from '@/components/ui/FilterPanel'
import { SearchBar } from '@/components/shared/SearchBar'
import { SavedViewsBar } from '@/components/shared/SavedViewsBar'
import { useUrlSearch } from '@/hooks/useUrlSearch'
import { useAutoOpen } from '@/hooks/useAutoOpen'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { SelectBox } from '@/components/ui/SelectBox'
import { LineItems, lineUnitPrice, lineTotal, type LineRow } from '@/components/shared/LineItems'
import { Combobox } from '@/components/shared/Combobox'
import { SerialScan } from './SerialScan'
import { ChallanForm } from './DeliveryChallan'
import { formatNumber, formatDate, formatDateTime, cn } from '@/lib/utils'
import { fetchStockAvailability } from '@/lib/stockAvailability'
import { TimelinePanel, NotesPanel } from '@/features/masters/components/Panels'
import { DocVersions } from '@/components/shared/DocVersions'
import { WorkflowPanel } from './WorkflowPanel'
import { DocumentFlow } from '@/components/shared/DocumentFlow'
import { workflowState } from './workflow'
import { OrderTimeline } from './OrderTimeline'
import { downloadChallanPdfFor } from './challanPdf'
import { loadSoInvoices, invoiceDeliveryTone, invoiceDeliveryLabel, type SoInvoice } from './soInvoices'

const SO_STATUS = ['draft', 'pending', 'approved', 'rejected', 'picking', 'packed', 'invoiced', 'dispatched', 'delivered', 'closed', 'cancelled']
const today = () => new Date().toISOString().slice(0, 10)
import type { Tables } from '@/types/database.types'
import type { Challan } from './DeliveryChallan'
import type { ReactNode } from 'react'

type SalesOrder = Tables<'sales_orders'>
type SalesOrderItem = Tables<'sales_order_items'>
type SalesOrderView = SalesOrder & { __items?: SalesOrderItem[] }
type CustomerLite = Pick<Tables<'customers'>, 'id' | 'customer_code' | 'name' | 'email' | 'billing_address' | 'shipping_address' | 'sap_customer_code'>
type WarehouseLite = Pick<Tables<'warehouses'>, 'id' | 'code' | 'name'>
type ProductLite = Pick<Tables<'products'>, 'id' | 'material_code' | 'name' | 'barcode' | 'category' | 'uom' | 'plant'>
type UserLite = Pick<Tables<'profiles'>, 'id' | 'full_name'>

const tone = (s: string) => ['delivered', 'closed'].includes(s) ? 'positive' : ['cancelled', 'rejected'].includes(s) ? 'negative' : s === 'draft' ? 'neutral' : ['dispatched', 'packed', 'picking'].includes(s) ? 'info' : 'critical'

// An order that hasn't cleared approval yet: invoicing / delivery actions are
// locked until the Pending Approval step runs (also enforced by a DB trigger).
const preApproval = (status?: string) => ['draft', 'pending', 'rejected'].includes(status ?? 'pending')

// Delivery progress label from the order-level delivered counter maintained by
// post_delivery_challan: says clearly how much of the order has physically
// left, instead of the old misleading "stock out" style wording.
function DeliveryProgress({ so }: { so: any }) {
  const delivered = Number(so.delivered_qty || 0), total = Number(so.total_qty || 0)
  if (delivered <= 0 || total <= 0) return null
  const full = delivered >= total
  return (
    <span className="flex items-center gap-1 text-[11px] text-ink-soft">
      <Badge tone={full ? 'positive' : 'info'}>{full ? 'Fully Delivered' : 'Partially Delivered'}</Badge>
      <span className="tabular-nums">{formatNumber(delivered)}/{formatNumber(total)}</span>
    </span>
  )
}

// Compact "what's next & who owns it" cell for the order list (WES #6).
function NextActionCell({ order, ownerName }: { order: SalesOrder; ownerName?: string | null }) {
  const wf = workflowState(order)
  if (wf.cancelled) return <span className="text-xs text-ink-faint">—</span>
  const done = !wf.next
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-xs">
        <span className={'truncate ' + (done ? 'text-ink-faint' : 'text-ink')}>{wf.action}</span>
        {wf.overdue && <Badge tone="negative">Overdue</Badge>}
      </div>
      {!done && <div className="truncate text-[11px] text-ink-faint">{ownerName || wf.role}</div>}
    </div>
  )
}

// Row-expand preview (DataTable's `expand`): a quick look at what's in the
// order — ordered/delivered/pending per line — without opening the full
// overview modal. Lines are fetched lazily, only when a row is expanded.
export type ProductMini = Pick<Tables<'products'>, 'id' | 'material_code' | 'name'>
export function OrderLinesPreview({ so, products, onView }: { so: SalesOrder; products: ProductMini[]; onView: () => void }) {
  const [items, setItems] = useState<SalesOrderItem[] | null>(null)
  useEffect(() => {
    let active = true
    supabase.from('sales_order_items').select('*').eq('so_id', so.id).then(({ data }) => { if (active) setItems(data ?? []) })
    return () => { active = false }
  }, [so.id])

  if (items === null) return (
    <div className="flex items-center gap-2 py-1 text-sm text-ink-faint">
      <LoadingRing className="h-4 w-4" /> Loading lines…
    </div>
  )
  if (!items.length) return <p className="py-1 text-sm text-ink-faint">No line items yet.</p>

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-xl border border-surface-line bg-surface">
        {items.map((it, i) => {
          const p = products.find(x => x.id === it.product_id)
          const pending = Math.max(0, Number(it.qty) - Number(it.delivered_qty || 0))
          return (
            <div key={it.id} className={cn('flex items-center justify-between gap-3 px-3.5 py-2 text-sm', i > 0 && 'border-t border-surface-line')}>
              <span className="min-w-0 truncate text-ink">{p ? `${p.material_code} — ${p.name}` : it.product_id}</span>
              <span className="shrink-0 text-xs text-ink-soft">
                ordered {formatNumber(it.qty)} · delivered {formatNumber(it.delivered_qty || 0)}
                {pending > 0 ? <span className="ml-1 font-medium text-bad">· {formatNumber(pending)} pending</span> : <span className="ml-1 font-medium text-ok">· complete</span>}
              </span>
            </div>
          )
        })}
      </div>
      <button type="button" onClick={onView} className="text-xs font-medium text-brand-700 hover:underline">View full order →</button>
    </div>
  )
}

export function OutboundSalesOrders() {
  const { data, loading, refresh } = useCollection('sales_orders', { order: 'created_at' })
  const { currentClientId, can, isPlatformAdmin, clients, session } = useAuth()
  const clientName = clients.find(c => c.id === currentClientId)?.name ?? ''
  // Warehouse/dispatch actions are hidden from sales-only users (no inventory access).
  const dispatchAccess = isPlatformAdmin || can('inventory.view')
  const notify = useUI(s => s.notify)
  const canEdit = can('outbound.create') || can('outbound.edit')
  // Gate for the approval step: a 'pending' order must clear this before the
  // warehouse can pick it (see workflow.ts + SerialScan.tsx's block).
  const canApprove = can('outbound.approve') || isPlatformAdmin
  const [q, setQ] = useUrlSearch()
  const [statusFilter, setStatusFilter] = useState('all')
  const [mineOnly, setMineOnly] = useState(false)
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [customerFilter, setCustomerFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<SalesOrderView | null>(null)
  useAutoOpen(() => { setEditing(null); setModal(true) })
  const [scanning, setScanning] = useState<SalesOrder | null>(null)
  const [invoicing, setInvoicing] = useState<SalesOrder | null>(null)
  const [deleting, setDeleting] = useState<SalesOrder | null>(null)
  const [customers, setCustomers] = useState<CustomerLite[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseLite[]>([])
  const [products, setProducts] = useState<ProductLite[]>([])
  const [vehicles, setVehicles] = useState<Pick<Tables<'vehicles'>, 'id' | 'vehicle_number' | 'vehicle_type' | 'vendor_id' | 'driver_name' | 'driver_phone'>[]>([])
  const [transportVendors, setTransportVendors] = useState<Pick<Tables<'transport_vendors'>, 'id' | 'vendor_code' | 'name'>[]>([])
  const [couriers, setCouriers] = useState<Pick<Tables<'couriers'>, 'id' | 'courier_code' | 'name' | 'rate_per_unit'>[]>([])
  const [planning, setPlanning] = useState<SalesOrder | null>(null)
  const [users, setUsers] = useState<UserLite[]>([])
  const [overview, setOverview] = useState<SalesOrder | null>(null)

  useEffect(() => {
    if (!currentClientId) return
    supabase.from('customers').select('id,customer_code,name,email,billing_address,shipping_address,sap_customer_code').then(({ data }) => setCustomers(data ?? []))
    supabase.from('warehouses').select('id,code,name').then(({ data }) => setWarehouses(data ?? []))
    supabase.from('products').select('id,material_code,name,barcode,category,uom,plant').then(({ data }) => setProducts(data ?? []))
    supabase.from('vehicles').select('id,vehicle_number,vehicle_type,vendor_id,driver_name,driver_phone').then(({ data }) => setVehicles(data ?? []))
    supabase.from('transport_vendors').select('id,vendor_code,name').eq('status', 'active').then(({ data }) => setTransportVendors(data ?? []))
    supabase.from('couriers').select('id,courier_code,name,rate_per_unit').eq('status', 'active').then(({ data }) => setCouriers(data ?? []))
    supabase.from('profiles').select('id,full_name').eq('status', 'active').then(({ data }) => setUsers(data ?? []))
  }, [currentClientId])

  const customerName = (id: string | null) => { const c = customers.find(x => x.id === id); return c ? `${c.customer_code} — ${c.name}` : '—' }
  const userName = (id?: string | null) => users.find(u => u.id === id)?.full_name ?? null

  // The filter dropdown should only offer statuses that actually occur in the
  // data — not the full hardcoded workflow list (SO_STATUS), which shows dead
  // options (e.g. 'rejected') when nothing is currently in that state.
  const presentStatuses = useMemo(() => {
    const present = new Set(data.map(r => r.status).filter((s): s is string => !!s))
    return SO_STATUS.filter(s => present.has(s))
  }, [data])

  const rows = useMemo(() => {
    let out = statusFilter === 'all' ? data : data.filter(r => r.status === statusFilter)
    if (mineOnly) out = out.filter(r => r.assigned_to === session?.user.id)
    if (overdueOnly) out = out.filter(r => workflowState(r).overdue)
    if (customerFilter) out = out.filter(r => r.customer_id === customerFilter)
    if (dateFrom) { const from = new Date(dateFrom); out = out.filter(r => new Date(r.order_date) >= from) }
    if (dateTo) { const to = new Date(dateTo); to.setHours(23, 59, 59, 999); out = out.filter(r => new Date(r.order_date) <= to) }
    if (!q.trim()) return out
    const t = q.toLowerCase()
    const fields = ['so_no', 'reference_no', 'invoice_no', 'sap_so_no', 'outbound_delivery_no', 'transfer_order_no', 'billing_doc_no']
    return out.filter(r => fields.some(f => String(r[f as keyof SalesOrder] ?? '').toLowerCase().includes(t)))
  }, [data, q, statusFilter, mineOnly, overdueOnly, customerFilter, dateFrom, dateTo, session])

  const closeRemaining = async (r: SalesOrder) => {
    if (!window.confirm(`Close remaining (undelivered) qty for ${r.so_no}? The order will be marked closed.`)) return
    const { error } = await supabase.from('sales_orders').update({ status: 'closed' }).eq('id', r.id)
    if (error) notify('error', error.message)
    else { notify('success', `${r.so_no} closed`); refresh() }
  }

  // Undo an approval/rejection decision — admin-only escape hatch for a
  // mistaken Approve/Reject click (see SalesOrderApprovals.tsx for the actual
  // Approve/Reject actions, which live in the dedicated Pending Approval tab).
  // Scoped to the order still sitting exactly at 'approved' — once picking has
  // started, unwinding back to 'pending' is no longer safe/meaningful.
  const undoApproval = async (r: SalesOrder) => {
    if (!window.confirm(`Undo the approval on ${r.so_no}? It will go back to Pending Approval.`)) return
    const { error } = await supabase.from('sales_orders')
      .update({ status: 'pending', approved_by: null, approved_at: null }).eq('id', r.id)
    if (error) notify('error', error.message)
    else { notify('success', `${r.so_no} approval undone`); refresh() }
  }
  const undoRejection = async (r: SalesOrder) => {
    if (!window.confirm(`Undo the rejection on ${r.so_no}? It will go back to Pending Approval.`)) return
    const { error } = await supabase.from('sales_orders')
      .update({ status: 'pending', rejected_by: null, rejected_at: null, rejection_reason: null }).eq('id', r.id)
    if (error) notify('error', error.message)
    else { notify('success', `${r.so_no} rejection undone`); refresh() }
  }

  const openEdit = async (r: SalesOrder) => {
    const { data: items } = await supabase.from('sales_order_items').select('*').eq('so_id', r.id)
    setEditing({ ...r, __items: items ?? [] }); setModal(true)
  }

  // Build the printable line list (product name + qty + price) for a sales order.
  const soLines = async (r: SalesOrder) => {
    const { data: items } = await supabase.from('sales_order_items').select('*').eq('so_id', r.id)
    return (items ?? []).map(it => ({
      name: products.find(p => p.id === it.product_id)?.name ?? it.product_id ?? '—',
      qty: Number(it.qty), price: Number(it.unit_price ?? 0)
    }))
  }

  const soMeta = (r: SalesOrder) => [
    { label: 'Date', value: formatDate(r.order_date) },
    { label: 'Customer', value: customerName(r.customer_id) },
    ...(r.reference_no ? [{ label: 'Customer PO', value: r.reference_no }] : []),
    { label: 'Status', value: r.status }
  ]

  const printSO = async (r: SalesOrder) => {
    try {
      const lines = await soLines(r)
      const { downloadDocPDF } = await import('@/pdf/DocumentPDF')  // lazy: pdf chunk loads on demand
      await downloadDocPDF({ client: clientName, title: 'Sales Order', docNo: r.so_no ?? '', meta: soMeta(r), lines, showPrice: true })
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not generate PDF')
    }
  }

  // "Mail" opens the user's email client pre-filled to the customer; the PDF is
  // downloaded alongside so it can be attached. (No mail server needed.)
  const mailSO = async (r: SalesOrder) => {
    await printSO(r)
    const cust = customers.find(c => c.id === r.customer_id)
    const to = cust?.email ?? ''
    const subject = `Sales Order ${r.so_no ?? ''}`
    const body = `Dear ${cust?.name ?? 'Customer'},\n\nPlease find attached Sales Order ${r.so_no ?? ''} dated ${formatDate(r.order_date)}.\n(The PDF has just been downloaded to your computer - please attach it to this email.)\n\nRegards,\n${clientName}`
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    if (!to) notify('info', 'No email on file for this customer - add the recipient manually.')
  }

  const exportPrework = async (r: SalesOrder) => {
    const prodById = (id: string | null) => products.find(p => p.id === id)
    const [{ data: items }, { data: serials }] = await Promise.all([
      supabase.from('sales_order_items').select('*').eq('so_id', r.id),
      supabase.from('serial_numbers').select('serial_no,product_id').eq('reference_no', r.so_no)
    ])
    const cust = customers.find(c => c.id === r.customer_id)
    const lines = (items ?? []).map((it, i) => ({
      sl: i + 1, code: prodById(it.product_id)?.material_code ?? '', name: prodById(it.product_id)?.name ?? '',
      qty: Number(it.qty) || 0, basic: Number(it.basic_price) || 0, vat: Number(it.vat_rate) || 0, total: Number(it.line_total) || 0
    }))
    const serialRows = (serials ?? []).map(s => ({ model: prodById(s.product_id)?.material_code ?? '', serial: s.serial_no }))
    const { downloadPrework } = await import('@/lib/preworkExport')  // lazy: keeps exceljs out of the main bundle
    await downloadPrework({
      soNo: r.so_no, poNo: r.reference_no ?? '', customerName: cust?.name ?? '', sapCustomerCode: cust?.sap_customer_code ?? '',
      invoiceAmount: Number(r.total_amount) || 0,
      sapSoNo: r.sap_so_no ?? '', outboundDeliveryNo: r.outbound_delivery_no ?? '', transferOrderNo: r.transfer_order_no ?? '', billingDocNo: r.billing_doc_no ?? '',
      lines, serials: serialRows
    })
    notify('info', 'Prework Excel downloaded')
  }

  const columns: Column<SalesOrder>[] = [
    { key: 'so_no', header: 'SO No', accessor: r => r.so_no, sortable: true, className: 'font-medium',
      render: r => (
        <button type="button" onClick={e => { e.stopPropagation(); setOverview(r) }}
          className="font-medium text-brand-700 underline-offset-2 hover:underline">{r.so_no}</button>
      ) },
    { key: 'customer', header: 'Customer', accessor: r => customerName(r.customer_id), sortable: true },
    { key: 'order_date', header: 'Date', accessor: r => r.order_date, render: r => formatDate(r.order_date), sortable: true },
    { key: 'total_qty', header: 'Qty', accessor: r => r.total_qty, render: r => formatNumber(r.total_qty), className: 'text-right', sortable: true },
    { key: 'total_amount', header: 'Amount', accessor: r => r.total_amount, render: r => formatNumber(r.total_amount), className: 'text-right', sortable: true },
    { key: 'status', header: 'Status', accessor: r => r.status, sortable: true, render: r => (
      <div className="flex flex-col items-start gap-0.5">
        <StatusBadge status={r.status} />
        <DeliveryProgress so={r} />
      </div>
    ) },
    { key: 'next_action', header: 'Next Action', render: r => <NextActionCell order={r} ownerName={userName(r.assigned_to)} /> },
    {
      key: '__actions', header: '', className: 'w-px whitespace-nowrap',
      render: r => (
        <div className="flex justify-end" onClick={e => e.stopPropagation()}>
          <ActionMenu items={[
            { icon: 'visibility', label: 'View', onClick: () => setOverview(r) },
            ...(canEdit ? [{ icon: 'edit', label: 'Edit', onClick: () => openEdit(r) }] : []),
            { icon: 'print', label: 'Print', onClick: () => printSO(r) },
            { icon: 'mail', label: 'Mail', onClick: () => mailSO(r) },
            ...(canEdit && dispatchAccess && !preApproval(r.status) ? [{ icon: 'qr_code_scanner', label: 'Scan Serials', onClick: () => setScanning(r) }] : []),
            { icon: 'download', label: 'Export Prework (Excel)', onClick: () => exportPrework(r) },
            // Invoicing & delivery only exist after approval — the approval
            // step can never be skipped (also blocked server-side).
            ...(canEdit && !preApproval(r.status) && !['cancelled'].includes(r.status) ? [{ icon: 'receipt_long', label: 'Invoices (SAP)', onClick: () => setInvoicing(r) }] : []),
            ...(canEdit && dispatchAccess && !preApproval(r.status) && !['delivered', 'closed', 'cancelled'].includes(r.status) ? [{ icon: 'local_shipping', label: 'Plan Delivery', onClick: () => setPlanning(r) }] : []),
            // Closing short only makes sense once the order is in fulfilment —
            // unapproved orders are rejected/cancelled instead of closed.
            ...(canEdit && dispatchAccess && !preApproval(r.status) && !['delivered', 'closed', 'cancelled'].includes(r.status) ? [{ icon: 'block', label: 'Close remaining', onClick: () => closeRemaining(r) }] : []),
            ...(isPlatformAdmin && r.status === 'approved' ? [{ icon: 'undo', label: 'Undo Approval', onClick: () => undoApproval(r) }] : []),
            ...(isPlatformAdmin && r.status === 'rejected' ? [{ icon: 'undo', label: 'Undo Rejection', onClick: () => undoRejection(r) }] : []),
            ...(isPlatformAdmin ? [{ icon: 'delete', label: 'Delete', tone: '!text-bad hover:!text-bad hover:!bg-bad/10', onClick: () => setDeleting(r) }] : [])
          ]} />
        </div>
      )
    }
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-72"><SearchBar value={q} onChange={setQ} placeholder="Search SO…" /></div>
        <SelectBox value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-auto py-2">
          <option value="all">All statuses</option>
          {presentStatuses.map(s => <option key={s} value={s}>{s}</option>)}
        </SelectBox>
        <button type="button" onClick={() => setMineOnly(v => !v)}
          className={cn('rounded-lg border px-2.5 py-1.5 text-xs font-semibold',
            mineOnly ? 'border-brand-400 bg-brand-500/10 text-brand-700' : 'border-surface-line text-ink-soft hover:bg-surface-sunken')}>
          Assigned to me
        </button>
        <button type="button" onClick={() => setOverdueOnly(v => !v)}
          className={cn('rounded-lg border px-2.5 py-1.5 text-xs font-semibold',
            overdueOnly ? 'border-bad/40 bg-bad/10 text-bad' : 'border-surface-line text-ink-soft hover:bg-surface-sunken')}>
          Overdue only
        </button>
        <FilterPanel activeCount={(customerFilter ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0)}
          onClear={() => { setCustomerFilter(''); setDateFrom(''); setDateTo('') }}>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Customer</label>
            <Combobox items={customers.map(c => ({ id: c.id, label: `${c.customer_code} — ${c.name}` }))}
              value={customerFilter} onChange={setCustomerFilter} placeholder="All customers" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft">Order date from</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="fiori-input py-1.5 text-xs" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft">to</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="fiori-input py-1.5 text-xs" />
            </div>
          </div>
        </FilterPanel>
        <span className="text-sm text-ink-soft">{rows.length} records</span>
        {canEdit && <Button className="ml-auto" icon="add" onClick={() => { setEditing(null); setModal(true) }}>New Order</Button>}
      </div>

      <SavedViewsBar scope="sales-orders" current={{ q, statusFilter, mineOnly, overdueOnly, customerFilter, dateFrom, dateTo }}
        onApply={s => {
          setQ(s.q ?? ''); setStatusFilter(s.statusFilter ?? 'all'); setMineOnly(!!s.mineOnly); setOverdueOnly(!!s.overdueOnly)
          setCustomerFilter(s.customerFilter ?? ''); setDateFrom(s.dateFrom ?? ''); setDateTo(s.dateTo ?? '')
        }} />

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DataTable fill columns={columns} rows={rows} loading={loading} rowKey={r => r.id}
          emptyTitle="No sales orders yet"
          expand={{ render: (r: SalesOrder) => <OrderLinesPreview so={r} products={products} onView={() => setOverview(r)} /> }} />
      </Card>

      {modal && (
        <SOForm record={editing} customers={customers} warehouses={warehouses} products={products} users={users}
          clientId={currentClientId!} notify={notify} canApprove={canApprove}
          onClose={() => setModal(false)} onDone={() => { setModal(false); refresh() }} />
      )}

      {scanning && (
        <Modal open onClose={() => setScanning(null)} title={`Scan Serials — ${scanning.so_no}`} size="xl">
          <SerialScan lockSoId={scanning.id} onDone={() => { refresh() }} />
        </Modal>
      )}

      {invoicing && (
        <InvoiceModal order={invoicing} products={products} notify={notify}
          onClose={() => setInvoicing(null)} onDone={() => { setInvoicing(null); refresh() }} />
      )}

      {planning && (
        <ChallanForm lockSo={planning} customers={customers} warehouses={warehouses} vehicles={vehicles} products={products}
          transportVendors={transportVendors} couriers={couriers}
          clientId={currentClientId!} notify={notify}
          onClose={() => setPlanning(null)} onDone={() => { setPlanning(null); refresh() }} />
      )}

      {overview && (
        <SOOverview so={overview} customerName={customerName(overview.customer_id)} products={products}
          customers={customers} vehicles={vehicles}
          ownerName={userName(overview.assigned_to)} approvedByName={userName(overview.approved_by)} rejectedByName={userName(overview.rejected_by)}
          canEdit={canEdit} onEdit={() => { const r = overview; setOverview(null); openEdit(r) }}
          onScanned={refresh} onDownloadSO={() => printSO(overview)}
          onClose={() => setOverview(null)} />
      )}

      <ConfirmDelete open={!!deleting} onClose={() => setDeleting(null)}
        name={deleting ? `SO · ${deleting.so_no}` : undefined}
        onConfirm={async () => {
          if (!deleting) return { error: null }
          // An order with delivery challans has real dispatch history — block it
          // rather than tear down the downstream documents.
          const { count } = await supabase.from('delivery_challans')
            .select('id', { count: 'exact', head: true }).eq('sales_order_id', deleting.id)
          if (count && count > 0) {
            return { error: { message: `Cannot delete ${deleting.so_no} — it has delivery challans. Cancel/delete those first.` } }
          }
          // Release any serials reserved against this order back into stock and
          // unlink them, so they survive and no longer block the line-item delete.
          const { data: items } = await supabase.from('sales_order_items').select('id').eq('so_id', deleting.id)
          const itemIds = (items ?? []).map(i => i.id)
          if (itemIds.length) {
            await supabase.from('serial_numbers')
              .update({ so_item_id: null, reference_no: null, status: 'in_stock' })
              .in('so_item_id', itemIds)
          }
          const res = await supabase.from('sales_orders').delete().eq('id', deleting.id)
          if (!res.error) { setDeleting(null); refresh() }
          return res
        }} />
    </div>
  )
}

type Notify = (kind: 'success' | 'error' | 'info', msg: string) => void
// deposited_amount may hold the raw input string mid-edit.
type SODraft = Omit<Partial<SalesOrder>, 'deposited_amount'> & { deposited_amount?: number | string | null; __items?: SalesOrderItem[]; __readOnly?: boolean }

function SOForm({ record, customers, warehouses, products, users, clientId, notify, canApprove, onClose, onDone }: {
  record: SODraft | null; customers: CustomerLite[]; warehouses: WarehouseLite[]; products: ProductLite[]
  users: UserLite[]; clientId: string; notify: Notify; canApprove: boolean; onClose: () => void; onDone: () => void
}) {
  const [h, setH] = useState<SODraft>(record ?? { order_date: today(), status: 'pending' })
  // Lines keep their DB id — updates happen in place (see save below), because
  // item ids are referenced by challan lines, serials and invoice items and
  // carry the delivered_qty counter.
  const [lines, setLines] = useState<LineRow[]>((record?.__items ?? []).map(it => ({
    id: it.id, product_id: it.product_id ?? '', qty: it.qty, unit_price: it.unit_price,
    basic_price: it.basic_price ?? undefined, vat_rate: it.vat_rate ?? undefined,
    remarks: it.remarks ?? undefined, delivered_qty: it.delivered_qty ?? undefined
  } as LineRow)))
  const [saving, setSaving] = useState(false)
  const readOnly = !!record?.__readOnly
  const set = (patch: SODraft) => setH(x => ({ ...x, ...patch }))
  // Has the order cleared the approval step? Until it has, the status can't be
  // pushed past pending and the SAP invoice numbers can't be entered — the
  // approval sequence always executes (a DB trigger backstops this rule).
  const approvalCleared = !!record && !preApproval(record.status ?? 'pending')
  // 'approved'/'rejected' are decision outcomes, not manual choices — they're
  // only reachable through the Approve/Reject actions on the Pending Approval
  // tab (which always records who/when/why), so the dropdown hides them here
  // except to show read-only on an order that's already at that status.
  const statusOptions = (approvalCleared
    ? SO_STATUS
    : SO_STATUS.filter(s => ['draft', 'pending', 'cancelled'].includes(s) || s === record?.status)
  ).filter(s =>
    (s !== 'approved' || canApprove || record?.status === 'approved') &&
    (s !== 'rejected' || record?.status === 'rejected'))
  const [genning, setGenning] = useState(false)
  const genPO = async () => {
    setGenning(true)
    try {
      const d = new Date()
      const day = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
      const { data } = await supabase.from('sales_orders').select('reference_no').like('reference_no', `PO-${day}-%`)
      let max = 0
      for (const row of data ?? []) { const m = /-(\d+)$/.exec(row.reference_no || ''); if (m) max = Math.max(max, parseInt(m[1], 10)) }
      set({ reference_no: `PO-${day}-${String(max + 1).padStart(3, '0')}` })
    } finally { setGenning(false) }
  }

  // Saleable stock per product — on-hand minus manual holds AND whatever's
  // already committed to other open orders (not just this one), so Sales
  // can't quote qty that's really already spoken for. See lib/stockAvailability.
  const [stockMap, setStockMap] = useState<Record<string, number>>({})
  useEffect(() => {
    if (!clientId) return
    fetchStockAvailability(clientId, record?.id).then(avail => {
      const m: Record<string, number> = {}
      Object.entries(avail).forEach(([pid, a]) => { m[pid] = a.saleable })
      setStockMap(m)
    })
  }, [clientId])

  const save = async () => {
    // An edited line can never drop below what has already been delivered.
    const under: any = lines.find((r: any) => r.id && Number(r.delivered_qty || 0) > 0 && Number(r.qty) < Number(r.delivered_qty))
    if (under) { notify('error', `A line cannot go below its already-delivered qty (${under.delivered_qty})`); return }
    setSaving(true)
    try {
      const totalQty = lines.reduce((s, r) => s + (Number(r.qty) || 0), 0)
      const totalAmount = lines.reduce((s, r) => s + lineTotal(r), 0)
      // billing_doc_no is the one SAP number that means "invoiced" — entering it
      // here must advance the workflow exactly like the Invoices modal does,
      // otherwise the order sits at picking/packed forever. Only after approval:
      // an unapproved order can never jump to invoiced (DB trigger enforces too).
      const preInvoice = ['approved', 'picking', 'packed']
      const status = approvalCleared && String(h.billing_doc_no || '').trim() && preInvoice.includes(h.status || 'pending')
        ? 'invoiced' : (h.status || 'pending')
      const header = {
         customer_id: h.customer_id || null, warehouse_id: h.warehouse_id || null,
        reference_no: h.reference_no || null, order_date: h.order_date || today(), required_date: h.required_date || null,
        total_qty: totalQty, total_amount: totalAmount, status, remarks: h.remarks || null,
        mail_ref: h.mail_ref || null, assigned_to: h.assigned_to || null,
        payment_status: h.payment_status || 'unpaid', deposited_amount: Number(h.deposited_amount) || 0, deposited_date: h.deposited_date || null,
        sap_so_no: h.sap_so_no || null, outbound_delivery_no: h.outbound_delivery_no || null,
        transfer_order_no: h.transfer_order_no || null, billing_doc_no: h.billing_doc_no || null
      }
      let soId = record?.id
      if (record) {
        const { error } = await supabase.from('sales_orders').update(header).eq('id', record.id!)
        if (error) throw error
      } else {
        const so_no = await nextDocNumber(clientId, 'SO')
        if (!so_no) throw new Error('Could not generate SO number')
        const { data, error } = await supabase.from('sales_orders').insert({ ...header, so_no }).select('id').single()
        if (error) throw error
        soId = data.id
      }
      if (!soId) throw new Error('Order id missing after save')
      // Lines are updated IN PLACE, never delete+reinsert: item ids are
      // referenced by challan lines, reserved serials and invoice items, and
      // each row carries the delivered_qty counter — recreating rows either
      // fails on those references or silently resets delivery tracking.
      const lineVals = (r: LineRow) => ({
        qty: Number(r.qty) || 0,
        basic_price: Number(r.basic_price) || 0, vat_rate: Number(r.vat_rate) || 0,
        unit_price: lineUnitPrice(r), line_total: lineTotal(r),
        remarks: r.remarks || null
      })
      const kept = lines.filter(r => r.product_id && r.id)
      const added = lines.filter(r => r.product_id && !r.id)
      if (record) {
        const keepIds = kept.map(r => r.id!)
        const delQ = supabase.from('sales_order_items').delete().eq('so_id', soId)
        const { error: delErr } = keepIds.length ? await delQ.not('id', 'in', `(${keepIds.join(',')})`) : await delQ
        if (delErr) throw new Error(delErr.message.includes('foreign key')
          ? 'A removed line already has deliveries/serials against it — it cannot be deleted.' : delErr.message)
        for (const r of kept) {
          const { error } = await supabase.from('sales_order_items').update(lineVals(r)).eq('id', r.id!)
          if (error) throw error
        }
      }
      if (added.length) {
        const { error } = await supabase.from('sales_order_items').insert(added.map(r => ({
           so_id: soId, product_id: r.product_id, ...lineVals(r)
        })))
        if (error) throw error
      }
      // Billing doc typed straight into the form (instead of the Invoices
      // modal): make sure an invoice record exists, covering the full ordered
      // qty, so challans and the fulfilment panel see it. The Invoices modal
      // is the place for partial/multiple invoices.
      const bdn = String(h.billing_doc_no || '').trim()
      if (bdn && approvalCleared) {
        const { count } = await (supabase as any).from('so_invoices').select('id', { count: 'exact', head: true }).eq('so_id', soId)
        if (!count) {
          const { data: curItems } = await supabase.from('sales_order_items').select('id,product_id,qty').eq('so_id', soId)
          const { data: inv, error: invErr } = await (supabase as any).from('so_invoices')
            .insert({  so_id: soId, invoice_no: bdn }).select('id').single()
          if (!invErr && inv) {
            await (supabase as any).from('so_invoice_items').insert((curItems ?? []).map((it: any) => ({
               invoice_id: inv.id, so_item_id: it.id, product_id: it.product_id, qty: it.qty
            })))
          }
        }
      }
      notify('success', `Order ${record ? 'updated' : 'created'}`)
      onDone()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not save sales order')
    } finally {
      setSaving(false)
    }
  }

  const selCust = customers.find(c => c.id === h.customer_id)

  return (
    <Modal open onClose={onClose} title={`${readOnly ? 'View' : record ? 'Edit' : 'New'} Order`} size="lg">
      <fieldset disabled={readOnly} className="m-0 border-0 p-0">
      <div className="space-y-4">
        {record && <div className="rounded-lg bg-surface-sunken px-3 py-2 text-sm"><span className="text-ink-faint">SO No: </span><span className="font-semibold">{record.so_no}</span></div>}
        {record && (() => {
          const dt = (record.__items ?? []).reduce((a, l) => a + Number(l.delivered_qty || 0), 0)
          const ot = (record.__items ?? []).reduce((a, l) => a + Number(l.qty || 0), 0)
          return ot > 0 ? <p className="text-xs text-ink-soft">Delivered <span className="font-semibold text-ink">{dt}</span> / {ot}{dt > 0 && dt < ot ? ' · partially fulfilled' : ''}</p> : null
        })()}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Customer (Dealer)">
            <Combobox items={customers.map(c => ({ id: c.id, label: c.customer_code, sublabel: c.name }))} value={h.customer_id ?? ''} onChange={(id: string) => set({ customer_id: id })} placeholder="Search customer by code or name" />
            {selCust?.sap_customer_code && <p className="mt-1 text-[11px] text-ink-faint">SAP customer code: <span className="font-mono text-ink-soft">{selCust.sap_customer_code}</span></p>}
          </Field>
          <Field label="Warehouse">
            <SelectBox value={h.warehouse_id ?? ''} onChange={e => set({ warehouse_id: e.target.value })}>
              <option value="">Select…</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
            </SelectBox>
          </Field>
          <Field label="Order Ref">
            <div className="flex gap-2">
              <Input value={h.reference_no ?? ''} onChange={e => set({ reference_no: e.target.value })} placeholder="Distributor order ref (optional)" />
              <button type="button" onClick={genPO} disabled={!!(h.reference_no && String(h.reference_no).trim()) || genning}
                className="shrink-0 rounded-lg border border-surface-line px-3 text-sm font-medium text-ink-soft hover:bg-surface-sunken disabled:opacity-40 disabled:hover:bg-transparent">
                {genning ? '...' : 'Auto'}
              </button>
            </div>
          </Field>
          <Field label="Order Date" required><Input type="date" value={h.order_date ?? ''} onChange={e => set({ order_date: e.target.value })} /></Field>
          <Field label="Required Date"><Input type="date" value={h.required_date ?? ''} onChange={e => set({ required_date: e.target.value })} /></Field>
          <Field label="Status" required>
            <SelectBox value={h.status ?? 'pending'} onChange={e => set({ status: e.target.value })}>
              {statusOptions.map((s: string) => <option key={s} value={s}>{s}</option>)}
            </SelectBox>
            {!['approved', 'rejected'].includes(h.status ?? '') && <p className="mt-1 text-[11px] text-ink-faint">Approve/Reject are separate actions on the Pending Approval tab, not a status choice here.</p>}
          </Field>
          <Field label="Follow-up Person">
            <Combobox items={(users ?? []).map(u => ({ id: u.id, label: u.full_name || u.id }))} value={h.assigned_to ?? ''} onChange={(id: string) => set({ assigned_to: id })} placeholder="Who follows this order through?" />
            <p className="mt-1 text-[11px] text-ink-faint">The person responsible for pushing this order to completion — shown under “Next Action” in the order list.</p>
          </Field>
          <Field label="Mail Ref / Link" className="col-span-full">
            <Input value={h.mail_ref ?? ''} onChange={e => set({ mail_ref: e.target.value })} placeholder="Mail subject or link (the mail thread holds the full record — no file upload needed)" />
          </Field>

          <div className="col-span-full mt-1 border-t border-surface-line pt-3"><p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Payment</p></div>
          <Field label="Payment Status">
            <SelectBox value={h.payment_status ?? 'unpaid'} onChange={e => set({ payment_status: e.target.value })}>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </SelectBox>
          </Field>
          <Field label="Deposited Amount"><Input type="number" min={0} step="any" value={h.deposited_amount ?? ''} onChange={e => set({ deposited_amount: e.target.value })} placeholder="How much has the customer paid/deposited" /></Field>
          <Field label="Deposited Date"><Input type="date" value={h.deposited_date ?? ''} onChange={e => set({ deposited_date: e.target.value })} /></Field>

          <div className="col-span-full mt-1 border-t border-surface-line pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">SAP References (enter once when invoiced)</p>
            {!approvalCleared && <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">Locked until the order is approved — invoicing can never skip the approval step.</p>}
          </div>
          <Field label="SAP Sales Order No"><Input disabled={!approvalCleared} value={h.sap_so_no ?? ''} onChange={e => set({ sap_so_no: e.target.value })} placeholder="e.g. 1465006426" /></Field>
          <Field label="Outbound Delivery No"><Input disabled={!approvalCleared} value={h.outbound_delivery_no ?? ''} onChange={e => set({ outbound_delivery_no: e.target.value })} placeholder="e.g. 1723056387" /></Field>
          <Field label="Transfer Order No"><Input disabled={!approvalCleared} value={h.transfer_order_no ?? ''} onChange={e => set({ transfer_order_no: e.target.value })} placeholder="e.g. 8777" /></Field>
          <Field label="Billing Document No"><Input disabled={!approvalCleared} value={h.billing_doc_no ?? ''} onChange={e => set({ billing_doc_no: e.target.value })} placeholder="e.g. 8815005379" /></Field>
          <Field label="Remarks" className="col-span-full"><Textarea value={h.remarks ?? ''} onChange={e => set({ remarks: e.target.value })} /></Field>
        </div>

        <LineItems rows={lines} onChange={setLines} products={products} variant="po" priced stock={stockMap} />
      </div>
      </fieldset>

      <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
        <Button variant="ghost" onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</Button>
        {!readOnly && <Button icon="save" loading={saving} onClick={save}>{record ? 'Update' : 'Create'}</Button>}
      </div>
    </Modal>
  )
}

// Invoice register for one order. An order can be invoiced in parts (SAP
// billing documents); every invoice is its own record with per-model
// quantities, so the operator always sees: how many invoices exist, which
// quantities belong to which invoice, which are delivered and which still
// wait — plus how much of the order has no invoice at all.
function InvoiceModal({ order, products, notify, onClose, onDone }: {
  order: SalesOrder; products: ProductLite[]; notify: Notify; onClose: () => void; onDone: () => void
}) {
  const { currentClientId } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [changed, setChanged] = useState(false)
  const [h, setH] = useState<any>({
    billing_doc_no: '', invoice_date: today(),
    sap_so_no: order.sap_so_no ?? '',
    outbound_delivery_no: order.outbound_delivery_no ?? '', transfer_order_no: order.transfer_order_no ?? ''
  })
  const [qtys, setQtys] = useState<Record<string, string>>({})
  const set = (patch: any) => setH((x: any) => ({ ...x, ...patch }))

  const reload = () => loadSoInvoices(order.id).then(({ items, invoices }) => { setItems(items); setInvoices(invoices) })
  useEffect(() => { reload() }, [order.id])

  const productLabel = (id: string) => { const p = products.find((x: any) => x.id === id); return p ? `${p.material_code} — ${p.name}` : id }
  // Invoiced so far, per order line — the new invoice can only cover the rest.
  const invoicedFor = (soItemId: string) => invoices.reduce((s, inv) =>
    s + inv.lines.filter((l: any) => l.so_item_id === soItemId).reduce((a: number, l: any) => a + Number(l.qty || 0), 0), 0)

  const ordered = items.reduce((s, it) => s + Number(it.qty || 0), 0)
  const invoicedTotal = invoices.reduce((s, inv) => s + inv.qty, 0)
  const notInvoiced = Math.max(0, ordered - invoicedTotal)

  const startAdd = () => {
    const q: Record<string, string> = {}
    items.forEach(it => { q[it.id] = String(Math.max(0, Number(it.qty) - invoicedFor(it.id))) })
    setQtys(q); setAdding(true)
  }

  const saveInvoice = async () => {
    const invoiceNo = String(h.billing_doc_no || '').trim()
    if (!invoiceNo) { notify('error', 'Billing Document / Invoice No is required'); return }
    const lines = items
      .map(it => ({ it, q: Number(qtys[it.id]) || 0 }))
      .filter(({ q }) => q > 0)
    if (!lines.length) { notify('error', 'Enter the quantity this invoice covers (at least one line)'); return }
    const over = lines.find(({ it, q }) => q > Number(it.qty) - invoicedFor(it.id))
    if (over) { notify('error', `${productLabel(over.it.product_id)}: only ${Number(over.it.qty) - invoicedFor(over.it.id)} left to invoice`); return }
    setSaving(true)
    try {
      const { data: inv, error } = await (supabase as any).from('so_invoices').insert({
         so_id: order.id, invoice_no: invoiceNo, invoice_date: h.invoice_date || today()
      }).select('id').single()
      if (error) throw error
      const { error: e2 } = await (supabase as any).from('so_invoice_items').insert(lines.map(({ it, q }) => ({
         invoice_id: inv.id, so_item_id: it.id, product_id: it.product_id, qty: q
      })))
      if (e2) throw e2
      // Order-level SAP refs + status. billing_doc_no/invoice_no mirror the
      // FIRST invoice so older reports keep working; status moves to invoiced.
      const patch: any = {
        sap_so_no: h.sap_so_no || null, outbound_delivery_no: h.outbound_delivery_no || null,
        transfer_order_no: h.transfer_order_no || null
      }
      if (!order.billing_doc_no) { patch.billing_doc_no = invoiceNo; patch.invoice_no = invoiceNo }
      if (['approved', 'picking', 'packed'].includes(order.status)) patch.status = 'invoiced'
      const { error: e3 } = await supabase.from('sales_orders').update(patch).eq('id', order.id)
      if (e3) throw e3
      notify('success', `Invoice ${invoiceNo} recorded for ${order.so_no}`)
      setAdding(false); setChanged(true); reload()
    } catch (e: any) {
      notify('error', e?.message?.includes('duplicate') ? `Invoice ${invoiceNo} already exists on this order` : (e?.message ?? 'Could not save invoice'))
    } finally { setSaving(false) }
  }

  const deleteInvoice = async (inv: any) => {
    if (inv.challans.length) { notify('error', `Invoice ${inv.invoice_no} already has challan(s) — cancel those first`); return }
    if (!window.confirm(`Delete invoice ${inv.invoice_no} (${formatNumber(inv.qty)} pcs)?`)) return
    const { error } = await (supabase as any).from('so_invoices').delete().eq('id', inv.id)
    if (error) { notify('error', error.message); return }
    setChanged(true); reload()
  }

  const close = () => changed ? onDone() : onClose()

  if (preApproval(order.status)) return (
    <Modal open onClose={onClose} title={`Invoices (SAP) — ${order.so_no}`} size="md">
      <div className="space-y-4">
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
          This order has not been approved yet. Invoicing only opens after the Pending Approval step — the approval sequence can never be skipped.
        </p>
        <div className="flex justify-end border-t border-surface-line pt-4"><Button variant="ghost" onClick={onClose}>Close</Button></div>
      </div>
    </Modal>
  )

  return (
    <Modal open onClose={close} title={`Invoices (SAP) — ${order.so_no}`} size="lg">
      <div className="space-y-4">
        {/* The five levels, always visible */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: 'Ordered', value: ordered },
            { label: 'Invoiced', value: invoicedTotal },
            { label: 'Not Yet Invoiced', value: notInvoiced, bad: notInvoiced > 0 },
            { label: 'Delivered', value: invoices.reduce((s, i) => s + i.delivered, 0) },
            { label: 'Remaining Under Invoice', value: Math.max(0, invoicedTotal - invoices.reduce((s, i) => s + i.delivered, 0)) }
          ].map(t => (
            <div key={t.label} className="rounded-xl border border-surface-line bg-surface-sunken/40 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{t.label}</p>
              <p className={'text-lg font-bold tabular-nums ' + (t.bad ? 'text-bad' : 'text-ink')}>{formatNumber(t.value)}</p>
            </div>
          ))}
        </div>

        {/* Every invoice with its own tracking */}
        <div className="overflow-hidden rounded-xl border border-surface-line">
          {invoices.length === 0 && <p className="p-3 text-sm text-ink-faint">No invoice recorded yet.</p>}
          {invoices.map((inv, i) => (
            <div key={inv.id} className={'px-3.5 py-2.5 ' + (i ? 'border-t border-surface-line' : '')}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Icon name="receipt" className="text-[18px] text-ink-faint" />
                <span className="font-semibold text-ink">Invoice {inv.invoice_no}</span>
                <span className="text-ink-soft">· {formatDate(inv.invoice_date)} · {formatNumber(inv.qty)} pcs</span>
                <Badge tone={invoiceDeliveryTone(inv)}>{invoiceDeliveryLabel(inv)}</Badge>
                <span className="text-xs text-ink-soft">Delivered {formatNumber(inv.delivered)} · Remaining {formatNumber(Math.max(0, inv.qty - inv.delivered))}</span>
                {inv.challans.length === 0 && (
                  <button type="button" title="Delete invoice" onClick={() => deleteInvoice(inv)}
                    className="ml-auto rounded-md p-1 text-ink-faint hover:bg-bad/10 hover:text-bad"><Icon name="delete" className="text-[16px]" /></button>
                )}
              </div>
              <p className="mt-1 pl-7 text-xs text-ink-faint">
                {inv.lines.map((l: any) => `${products.find((p: any) => p.id === l.product_id)?.material_code ?? '?'}×${formatNumber(l.qty)}`).join('  ·  ')}
                {inv.challans.length > 0 && <span> — challan {inv.challans.map((c: any) => c.challan_no).join(', ')}</span>}
              </p>
            </div>
          ))}
          {notInvoiced > 0 && (
            <div className="flex items-center gap-2 border-t border-dashed border-surface-line bg-surface-sunken/40 px-3.5 py-2.5 text-sm">
              <Icon name="pending" className="text-[18px] text-ink-faint" />
              <span className="text-ink-soft">Invoice not created yet for</span>
              <span className="font-semibold text-bad">{formatNumber(notInvoiced)} pcs</span>
              <span className="text-xs text-ink-faint">— this quantity cannot go on a delivery challan</span>
            </div>
          )}
        </div>

        {!adding ? (
          notInvoiced > 0 && <Button icon="add" variant="secondary" onClick={startAdd}>Add Invoice</Button>
        ) : (
          <div className="space-y-4 rounded-xl border border-brand-500/40 bg-brand-50/40 p-4 dark:bg-brand-500/5">
            <p className="text-sm font-semibold text-ink">New invoice</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Billing Document / Invoice No" required><Input autoFocus value={h.billing_doc_no} onChange={e => set({ billing_doc_no: e.target.value })} placeholder="e.g. 8815005417" /></Field>
              <Field label="Invoice Date"><Input type="date" value={h.invoice_date} onChange={e => set({ invoice_date: e.target.value })} /></Field>
              <Field label="SAP Sales Order No"><Input value={h.sap_so_no} onChange={e => set({ sap_so_no: e.target.value })} placeholder="e.g. 1465006470" /></Field>
              <Field label="Outbound Delivery No"><Input value={h.outbound_delivery_no} onChange={e => set({ outbound_delivery_no: e.target.value })} placeholder="e.g. 1723056430" /></Field>
              <Field label="Transfer Order No"><Input value={h.transfer_order_no} onChange={e => set({ transfer_order_no: e.target.value })} placeholder="e.g. 8892" /></Field>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-ink-soft">Quantities on this invoice</p>
              <div className="overflow-hidden rounded-lg border border-surface-line">
                {items.map((it, i) => {
                  const left = Math.max(0, Number(it.qty) - invoicedFor(it.id))
                  return (
                    <div key={it.id} className={'flex items-center gap-3 px-3 py-2 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                      <span className="min-w-0 flex-1 truncate text-ink">{productLabel(it.product_id)}</span>
                      <span className="shrink-0 text-xs text-ink-faint">ordered {formatNumber(it.qty)} · uninvoiced {formatNumber(left)}</span>
                      <input type="number" min={0} max={left} value={qtys[it.id] ?? ''} disabled={left <= 0}
                        onChange={e => setQtys(q => ({ ...q, [it.id]: e.target.value }))}
                        className="fiori-input h-8 w-20 shrink-0 text-right" />
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              <Button icon="receipt_long" loading={saving} onClick={saveInvoice}>Save Invoice</Button>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={close}>Close</Button>
        </div>
      </div>
    </Modal>
  )
}

type DeliveryWithItems = Challan & { items: Pick<Tables<'delivery_challan_items'>, 'challan_id' | 'product_id' | 'qty'>[] }

function SOOverview({ so, customerName, products, customers, vehicles, ownerName, approvedByName, rejectedByName, canEdit, onEdit, onScanned, onDownloadSO, onClose }: {
  so: SalesOrder; customerName: string; products: ProductLite[]; customers: CustomerLite[]
  vehicles: Pick<Tables<'vehicles'>, 'id' | 'vehicle_number' | 'vehicle_type'>[]
  ownerName?: string | null; approvedByName?: string | null; rejectedByName?: string | null
  canEdit: boolean; onEdit: () => void; onScanned: () => void; onDownloadSO: () => void; onClose: () => void
}) {
  const notify = useUI(s => s.notify)
  const [tab, setTab] = useState<'details' | 'scan' | 'notes'>('details')
  const [items, setItems] = useState<SalesOrderItem[]>([])
  const [deliveries, setDeliveries] = useState<DeliveryWithItems[]>([])
  const [invoices, setInvoices] = useState<SoInvoice[]>([])

  useEffect(() => {
    if (!so?.id) return
    supabase.from('sales_order_items').select('*').eq('so_id', so.id).then(({ data }) => setItems(data ?? []))
    loadSoInvoices(so.id).then(({ invoices }) => setInvoices(invoices))
    // Deliveries = the challans raised against this order, each with its mode and product lines.
    ;(async () => {
      // Full row (not a narrow column list) so the same object can also be handed
      // straight to downloadChallanPdfFor for the "Download" button below.
      const { data: chs } = await supabase.from('delivery_challans')
        .select('*')
        .eq('sales_order_id', so.id).order('challan_date', { ascending: true })
      const ids = (chs ?? []).map(c => c.id)
      const byCh: Record<string, DeliveryWithItems['items']> = {}
      if (ids.length) {
        const { data: cis } = await supabase.from('delivery_challan_items').select('challan_id,product_id,qty').in('challan_id', ids)
        ;(cis ?? []).forEach(ci => { (byCh[ci.challan_id] ??= []).push(ci) })
      }
      setDeliveries((chs ?? []).map(c => ({ ...c, items: byCh[c.id] ?? [] })))
    })()
  }, [so?.id])

  const productCode = (id: string | null) => products.find(p => p.id === id)?.material_code ?? '?'
  const productName = (id: string | null) => products.find(p => p.id === id)?.name ?? id ?? '—'

  const Stat = ({ label, value }: { label: string; value: ReactNode }) => (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <div className="mt-0.5 text-sm font-medium text-ink break-words">{value}</div>
    </div>
  )
  const Section = ({ title, children }: { title: string; children: ReactNode }) => (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{title}</p>
      {children}
    </div>
  )

  return (
    <Modal open onClose={onClose} title={`Order — ${so.so_no}`} size="xl">
      <div className="space-y-5">
        <Tabs tabs={[{ key: 'details', label: 'Details' }, { key: 'scan', label: 'Scan Serials' }, { key: 'notes', label: 'Notes' }]} active={tab} onChange={k => setTab(k as 'details' | 'scan' | 'notes')} />

        {tab === 'details' && <>
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" icon="download" onClick={onDownloadSO}>Download Invoice (PDF)</Button>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-surface-line bg-surface-sunken/40 p-4 sm:grid-cols-3">
          <Stat label="Customer" value={customerName} />
          <Stat label="Order Date" value={formatDate(so.order_date)} />
          <Stat label="Customer PO" value={so.reference_no ?? '—'} />
          <Stat label="Status" value={<StatusBadge status={so.status} />} />
          <Stat label="Total Qty" value={formatNumber(so.total_qty)} />
          <Stat label="Total Amount" value={formatNumber(so.total_amount)} />
          <Stat label="Owner" value={ownerName || '— unassigned'} />
          <Stat label="Payment" value={`${so.payment_status ?? 'unpaid'}${Number(so.deposited_amount) > 0 ? ` · ${formatNumber(so.deposited_amount)} deposited` : ''}${so.deposited_date ? ` (${formatDate(so.deposited_date)})` : ''}`} />
          {so.approved_by && <Stat label="Approved By" value={`${approvedByName || '—'} · ${formatDateTime(so.approved_at)}`} />}
          {so.rejected_by && <Stat label="Rejected By" value={`${rejectedByName || '—'} · ${formatDateTime(so.rejected_at)}`} />}
        </div>
        {so.status === 'rejected' && so.rejection_reason && (
          <div className="rounded-xl border border-bad/30 bg-bad/5 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-bad">Rejection Reason</p>
            <p className="mt-0.5 text-sm text-ink">{so.rejection_reason}</p>
          </div>
        )}

        <DocumentFlow nodes={[
          { icon: 'shopping_cart', type: 'Sales Order', number: so.so_no, status: so.status, tone: tone(so.status), current: true },
          ...deliveries.map(d => ({ icon: 'local_shipping', type: 'Delivery Challan', number: d.challan_no, status: d.status, to: `/outbound/delivery-challan?q=${encodeURIComponent(d.challan_no)}` }))
        ]} />

        <Section title="Workflow">
          <WorkflowPanel order={so} responsibleName={ownerName} />
        </Section>

        {/* The five tracking levels: ordered → invoiced → delivered, with the
            two gaps (not-yet-invoiced, remaining-under-invoice) always visible. */}
        <Section title="Fulfilment — Order → Invoice → Delivery">
          {(() => {
            const ordered = items.reduce((s: number, it: any) => s + Number(it.qty || 0), 0)
            const invoicedTotal = invoices.reduce((s: number, i: any) => s + i.qty, 0)
            const delivered = items.reduce((s: number, it: any) => s + Number(it.delivered_qty || 0), 0)
            const notInvoiced = Math.max(0, ordered - invoicedTotal)
            const tiles = [
              { label: 'Ordered', value: ordered },
              { label: 'Invoiced', value: invoicedTotal },
              { label: 'Not Yet Invoiced', value: notInvoiced, bad: notInvoiced > 0 },
              { label: 'Delivered', value: delivered },
              { label: 'Remaining Under Invoice', value: Math.max(0, invoicedTotal - delivered) }
            ]
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {tiles.map(t => (
                    <div key={t.label} className="rounded-xl border border-surface-line bg-surface-sunken/40 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{t.label}</p>
                      <p className={'text-lg font-bold tabular-nums ' + (t.bad ? 'text-bad' : 'text-ink')}>{formatNumber(t.value)}</p>
                    </div>
                  ))}
                </div>
                <div className="overflow-hidden rounded-xl border border-surface-line">
                  {invoices.length === 0 && <p className="p-3 text-sm text-ink-faint">No invoice recorded yet — use “Invoices (SAP)”.</p>}
                  {invoices.map((inv: any, i: number) => (
                    <div key={inv.id} className={'flex flex-wrap items-center gap-2 px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                      <Icon name="receipt" className="text-[18px] text-ink-faint" />
                      <span className="font-semibold text-ink">Invoice {inv.invoice_no}</span>
                      <span className="text-ink-soft">· {formatNumber(inv.qty)} pcs</span>
                      <Badge tone={invoiceDeliveryTone(inv)}>{invoiceDeliveryLabel(inv)}</Badge>
                      <span className="text-xs text-ink-soft">Delivered {formatNumber(inv.delivered)} · Remaining {formatNumber(Math.max(0, inv.qty - inv.delivered))}</span>
                      {inv.challans.length > 0 && <span className="text-xs text-ink-faint">— {inv.challans.map((c: any) => c.challan_no).join(', ')}</span>}
                    </div>
                  ))}
                  {notInvoiced > 0 && (
                    <div className="flex items-center gap-2 border-t border-dashed border-surface-line bg-surface-sunken/40 px-3.5 py-2.5 text-sm">
                      <Icon name="pending" className="text-[18px] text-ink-faint" />
                      <span className="text-ink-soft">Invoice not created yet for</span>
                      <span className="font-semibold text-bad">{formatNumber(notInvoiced)} pcs</span>
                      <span className="text-xs text-ink-faint">— cannot go on a delivery challan</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </Section>

        {/* Wide screens: operational sections left, history right — less scrolling */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-5">
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
              items.map((it, i) => {
                const pending = Math.max(0, Number(it.qty) - Number(it.delivered_qty || 0))
                return (
                  <div key={it.id} className={'flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                    <span className="min-w-0 truncate text-ink">{productName(it.product_id)}</span>
                    <span className="shrink-0 text-ink-soft">
                      ordered {formatNumber(it.qty)} · delivered {formatNumber(it.delivered_qty || 0)}
                      {pending > 0 ? <span className="ml-1 font-medium text-bad">· {formatNumber(pending)} pending</span> : <span className="ml-1 font-medium text-ok">· complete</span>}
                    </span>
                  </div>
                )
              })}
          </div>
        </Section>

        <Section title="Deliveries — which transport/courier carried what">
          <div className="overflow-hidden rounded-xl border border-surface-line">
            {deliveries.length === 0 ? (
              <div className="flex items-center gap-2 p-3.5 text-sm text-ink-faint">
                <Icon name="local_shipping" className="text-[18px]" /> No deliveries yet — use “Plan Delivery”.
              </div>
            ) : deliveries.map((d, i) => {
              const courier = d.delivery_method === 'courier'
              const carrier = courier
                ? `Courier · ${d.courier_name || '—'}${d.courier_tracking_no ? ` (${d.courier_tracking_no})` : ''}`
                : `Transport · ${d.transport_vendor || d.driver_name || '—'}`
              return (
                <div key={d.id} className={'px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-ink">
                      <Icon name={courier ? 'local_post_office' : 'local_shipping'} className="shrink-0 text-[18px] text-ink-faint" />
                      <span className="truncate font-medium">{d.challan_no}</span>
                      <span className="truncate text-ink-soft">· {carrier}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-ink-soft">
                      {formatDate(d.challan_date)} {d.status === 'delivered' ? <StatusBadge status="delivered" /> : d.posted_at ? <StatusBadge status="dispatched" /> : <StatusBadge status={d.status} />}
                      <button type="button" title="Download challan PDF" onClick={() => downloadChallanPdfFor(d, { customers, vehicles, products }).catch((e: Error) => notify('error', e?.message ?? 'Could not generate PDF'))}
                        className="rounded-lg p-1 text-ink-faint hover:bg-surface-sunken hover:text-brand-600"><Icon name="download" className="text-[16px]" /></button>
                    </span>
                  </div>
                  {d.items.length > 0 && (
                    <p className="mt-1 pl-7 text-xs text-ink-faint">{d.items.map(it => `${productCode(it.product_id)}×${formatNumber(it.qty)}`).join('  ·  ')}</p>
                  )}
                </div>
              )
            })}
          </div>
        </Section>
        </div>

        <div className="space-y-5">
        <Section title="Order Timeline">
          <OrderTimeline so={so} />
        </Section>

        <Section title="Document Versions">
          <DocVersions table="sales_orders" recordId={so.id} />
        </Section>
        </div>
        </div>
        </>}

        {tab === 'scan' && <SerialScan lockSoId={so.id} onDone={onScanned} />}

        {tab === 'notes' && <NotesPanel entityType="sales_orders" entityId={so.id} />}

        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          {canEdit && tab === 'details' && <Button icon="edit" onClick={onEdit}>Edit</Button>}
        </div>
      </div>
    </Modal>
  )
}


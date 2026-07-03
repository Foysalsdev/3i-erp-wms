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
import { Tabs } from '@/components/ui/Tabs'
import { SearchBar } from '@/components/shared/SearchBar'
import { useUrlSearch } from '@/hooks/useUrlSearch'
import { Field, Select, Input, Textarea } from '@/components/ui/Field'
import { LineItems, lineUnitPrice, lineTotal, type LineRow } from '@/components/shared/LineItems'
import { Combobox } from '@/components/shared/Combobox'
import { SerialScan } from './SerialScan'
import { ChallanForm } from './DeliveryChallan'
import { formatNumber, formatDate, formatDateTime } from '@/lib/utils'
import { downloadDocPDF } from '@/pdf/DocumentPDF'
import { TimelinePanel } from '@/features/masters/components/Panels'
import { DocVersions } from '@/components/shared/DocVersions'
import { WorkflowPanel } from './WorkflowPanel'
import { workflowState } from './workflow'
import { OrderTimeline } from './OrderTimeline'
import { downloadChallanPdfFor } from './challanPdf'

const SO_STATUS = ['draft', 'pending', 'approved', 'picking', 'packed', 'invoiced', 'dispatched', 'delivered', 'closed', 'cancelled']
const today = () => new Date().toISOString().slice(0, 10)
const tone = (s: string) => ['delivered', 'closed'].includes(s) ? 'positive' : s === 'cancelled' ? 'negative' : s === 'draft' ? 'neutral' : ['dispatched', 'packed', 'picking'].includes(s) ? 'info' : 'critical'

// Compact "what's next & who owns it" cell for the order list (WES #6).
function NextActionCell({ order, ownerName }: { order: any; ownerName?: string | null }) {
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

export function OutboundSalesOrders() {
  const { data, loading, refresh } = useCollection('sales_orders', { order: 'created_at' })
  const { currentClientId, can, isPlatformAdmin, clients } = useAuth()
  const clientName = clients.find((c: any) => c.id === currentClientId)?.name ?? ''
  // Warehouse/dispatch actions are hidden from sales-only users (no inventory access).
  const dispatchAccess = isPlatformAdmin || can('inventory.view')
  const notify = useUI(s => s.notify)
  const canEdit = can('outbound.create') || can('outbound.edit')
  const [q, setQ] = useUrlSearch()
  const [statusFilter, setStatusFilter] = useState('all')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [scanning, setScanning] = useState<any>(null)
  const [invoicing, setInvoicing] = useState<any>(null)
  const [deleting, setDeleting] = useState<any>(null)
  const [customers, setCustomers] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [transportVendors, setTransportVendors] = useState<any[]>([])
  const [couriers, setCouriers] = useState<any[]>([])
  const [planning, setPlanning] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [overview, setOverview] = useState<any>(null)

  useEffect(() => {
    if (!currentClientId) return
    supabase.from('customers').select('id,customer_code,name,email,billing_address,sap_customer_code').eq('client_id', currentClientId).then(({ data }) => setCustomers(data ?? []))
    supabase.from('warehouses').select('id,code,name').eq('client_id', currentClientId).then(({ data }) => setWarehouses(data ?? []))
    supabase.from('products').select('id,material_code,name,barcode,category,uom,plant').eq('client_id', currentClientId).then(({ data }) => setProducts(data ?? []))
    supabase.from('vehicles').select('id,vehicle_number,vehicle_type').eq('client_id', currentClientId).then(({ data }) => setVehicles(data ?? []))
    supabase.from('transport_vendors').select('id,vendor_code,name').eq('client_id', currentClientId).eq('status', 'active').then(({ data }) => setTransportVendors(data ?? []))
    ;(supabase as any).from('couriers').select('id,courier_code,name,rate_per_unit').eq('client_id', currentClientId).eq('status', 'active').then(({ data }: any) => setCouriers(data ?? []))
    supabase.from('profiles').select('id,full_name').eq('status', 'active').then(({ data }) => setUsers(data ?? []))
  }, [currentClientId])

  const customerName = (id: string) => { const c = customers.find(x => x.id === id); return c ? `${c.customer_code} — ${c.name}` : '—' }
  const userName = (id?: string | null) => users.find(u => u.id === id)?.full_name ?? null

  const rows = useMemo(() => {
    const byStatus = statusFilter === 'all' ? (data as any[]) : (data as any[]).filter(r => r.status === statusFilter)
    if (!q.trim()) return byStatus
    const t = q.toLowerCase()
    const fields = ['so_no', 'reference_no', 'invoice_no', 'sap_so_no', 'outbound_delivery_no', 'transfer_order_no', 'billing_doc_no']
    return byStatus.filter(r => fields.some(f => String(r[f] ?? '').toLowerCase().includes(t)))
  }, [data, q, statusFilter])

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

  const exportPrework = async (r: any) => {
    const prodById = (id: string) => products.find(p => p.id === id)
    const [{ data: items }, { data: serials }] = await Promise.all([
      supabase.from('sales_order_items').select('*').eq('so_id', r.id),
      supabase.from('serial_numbers').select('serial_no,product_id').eq('client_id', currentClientId!).eq('reference_no', r.so_no)
    ])
    const cust = customers.find(c => c.id === r.customer_id)
    const lines = (items ?? []).map((it: any, i: number) => ({
      sl: i + 1, code: prodById(it.product_id)?.material_code ?? '', name: prodById(it.product_id)?.name ?? '',
      qty: Number(it.qty) || 0, basic: Number(it.basic_price) || 0, vat: Number(it.vat_rate) || 0, total: Number(it.line_total) || 0
    }))
    const serialRows = (serials ?? []).map((s: any) => ({ model: prodById(s.product_id)?.material_code ?? '', serial: s.serial_no }))
    const { downloadPrework } = await import('@/lib/preworkExport')  // lazy: keeps exceljs out of the main bundle
    await downloadPrework({
      soNo: r.so_no, poNo: r.reference_no ?? '', customerName: cust?.name ?? '', sapCustomerCode: cust?.sap_customer_code ?? '',
      invoiceAmount: Number(r.total_amount) || 0,
      sapSoNo: r.sap_so_no ?? '', outboundDeliveryNo: r.outbound_delivery_no ?? '', transferOrderNo: r.transfer_order_no ?? '', billingDocNo: r.billing_doc_no ?? '',
      lines, serials: serialRows
    })
    notify('info', 'Prework Excel downloaded')
  }

  const columns = [
    { key: 'so_no', header: 'SO No', accessor: (r: any) => r.so_no, sortable: true, className: 'font-medium',
      render: (r: any) => (
        <button type="button" onClick={e => { e.stopPropagation(); setOverview(r) }}
          className="font-medium text-brand-700 underline-offset-2 hover:underline">{r.so_no}</button>
      ) },
    { key: 'customer', header: 'Customer', accessor: (r: any) => customerName(r.customer_id), sortable: true },
    { key: 'order_date', header: 'Date', accessor: (r: any) => r.order_date, render: (r: any) => formatDate(r.order_date), sortable: true },
    { key: 'total_qty', header: 'Qty', accessor: (r: any) => r.total_qty, render: (r: any) => formatNumber(r.total_qty), className: 'text-right', sortable: true },
    { key: 'total_amount', header: 'Amount', accessor: (r: any) => r.total_amount, render: (r: any) => formatNumber(r.total_amount), className: 'text-right', sortable: true },
    { key: 'status', header: 'Status', accessor: (r: any) => r.status, render: (r: any) => <Badge tone={tone(r.status)}>{r.status}</Badge>, sortable: true },
    { key: 'next_action', header: 'Next Action', render: (r: any) => <NextActionCell order={r} ownerName={userName(r.assigned_to)} /> },
    {
      key: '__actions', header: '', className: 'w-px whitespace-nowrap',
      render: (r: any) => (
        <div className="flex justify-end" onClick={e => e.stopPropagation()}>
          <ActionMenu items={[
            { icon: 'visibility', label: 'View', onClick: () => setOverview(r) },
            ...(canEdit ? [{ icon: 'edit', label: 'Edit', onClick: () => openEdit(r) }] : []),
            { icon: 'print', label: 'Print', onClick: () => printSO(r) },
            { icon: 'mail', label: 'Mail', onClick: () => mailSO(r) },
            ...(canEdit && dispatchAccess ? [{ icon: 'qr_code_scanner', label: 'Scan Serials', onClick: () => setScanning(r) }] : []),
            { icon: 'download', label: 'Export Prework (Excel)', onClick: () => exportPrework(r) },
            ...(canEdit ? [{ icon: 'receipt_long', label: 'Enter Invoice (SAP)', onClick: () => setInvoicing(r) }] : []),
            ...(canEdit && dispatchAccess ? [{ icon: 'local_shipping', label: 'Plan Delivery', onClick: () => setPlanning(r) }] : []),
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
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="fiori-input w-auto py-2">
          <option value="all">All statuses</option>
          {SO_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-sm text-ink-soft">{rows.length} records</span>
        {canEdit && <Button className="ml-auto" icon="add" onClick={() => { setEditing(null); setModal(true) }}>New Sales Order</Button>}
      </div>

      <Card className="overflow-hidden">
        <DataTable columns={columns} rows={rows} loading={loading} rowKey={(r: any) => r.id}
          emptyTitle="No sales orders yet" />
      </Card>

      {modal && (
        <SOForm record={editing} customers={customers} warehouses={warehouses} products={products} users={users}
          clientId={currentClientId!} notify={notify}
          onClose={() => setModal(false)} onDone={() => { setModal(false); refresh() }} />
      )}

      {scanning && (
        <Modal open onClose={() => setScanning(null)} title={`Scan Serials — ${scanning.so_no}`} size="xl">
          <SerialScan lockSoId={scanning.id} onDone={() => { refresh() }} />
        </Modal>
      )}

      {invoicing && (
        <InvoiceModal order={invoicing} notify={notify}
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
          ownerName={userName(overview.assigned_to)}
          canEdit={canEdit} onEdit={() => { const r = overview; setOverview(null); openEdit(r) }}
          onScanned={refresh} onDownloadSO={() => printSO(overview)}
          onClose={() => setOverview(null)} />
      )}

      <ConfirmDelete open={!!deleting} onClose={() => setDeleting(null)}
        name={deleting ? `SO · ${deleting.so_no}` : undefined}
        onConfirm={async () => {
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
          const itemIds = (items ?? []).map((i: any) => i.id)
          if (itemIds.length) {
            await supabase.from('serial_numbers')
              .update({ so_item_id: null, reference_no: null, status: 'in_stock' })
              .eq('client_id', currentClientId!).in('so_item_id', itemIds)
          }
          const res = await supabase.from('sales_orders').delete().eq('id', deleting.id)
          if (!res.error) { setDeleting(null); refresh() }
          return res
        }} />
    </div>
  )
}

function SOForm({ record, customers, warehouses, products, users, clientId, notify, onClose, onDone }: any) {
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
      const totalAmount = lines.reduce((s, r) => s + lineTotal(r), 0)
      // billing_doc_no is the one SAP number that means "invoiced" — entering it
      // here must advance the workflow exactly like the Enter Invoice modal does,
      // otherwise the order sits at picking/packed forever.
      const preInvoice = ['draft', 'pending', 'approved', 'picking', 'packed']
      const status = String(h.billing_doc_no || '').trim() && preInvoice.includes(h.status || 'pending')
        ? 'invoiced' : (h.status || 'pending')
      const header = {
        client_id: clientId, customer_id: h.customer_id || null, warehouse_id: h.warehouse_id || null,
        reference_no: h.reference_no || null, order_date: h.order_date || today(), required_date: h.required_date || null,
        total_qty: totalQty, total_amount: totalAmount, status, remarks: h.remarks || null,
        mail_ref: h.mail_ref || null, assigned_to: h.assigned_to || null,
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
        qty: Number(r.qty) || 0,
        basic_price: Number(r.basic_price) || 0, vat_rate: Number(r.vat_rate) || 0,
        unit_price: lineUnitPrice(r), line_total: lineTotal(r),
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

  const selCust = customers.find((c: any) => c.id === h.customer_id)

  return (
    <Modal open onClose={onClose} title={`${readOnly ? 'View' : record ? 'Edit' : 'New'} Order`} size="lg">
      <fieldset disabled={readOnly} className="m-0 border-0 p-0">
      <div className="space-y-4">
        {record && <div className="rounded-lg bg-surface-sunken px-3 py-2 text-sm"><span className="text-ink-faint">SO No: </span><span className="font-semibold">{record.so_no}</span></div>}
        {record && (() => {
          const dt = (record.__items ?? []).reduce((a: number, l: any) => a + Number(l.delivered_qty || 0), 0)
          const ot = (record.__items ?? []).reduce((a: number, l: any) => a + Number(l.qty || 0), 0)
          return ot > 0 ? <p className="text-xs text-ink-soft">Delivered <span className="font-semibold text-ink">{dt}</span> / {ot}{dt > 0 && dt < ot ? ' · partially fulfilled' : ''}</p> : null
        })()}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Customer (Dealer)">
            <Combobox items={customers.map((c: any) => ({ id: c.id, label: c.customer_code, sublabel: c.name }))} value={h.customer_id ?? ''} onChange={(id: string) => set({ customer_id: id })} placeholder="Search customer by code or name" />
            {selCust?.sap_customer_code && <p className="mt-1 text-[11px] text-ink-faint">SAP customer code: <span className="font-mono text-ink-soft">{selCust.sap_customer_code}</span></p>}
          </Field>
          <Field label="Warehouse">
            <Select value={h.warehouse_id ?? ''} onChange={e => set({ warehouse_id: e.target.value })}>
              <option value="">Select…</option>
              {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
            </Select>
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
            <Select value={h.status ?? 'pending'} onChange={e => set({ status: e.target.value })}>
              {SO_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Owner (responsible)">
            <Combobox items={(users ?? []).map((u: any) => ({ id: u.id, label: u.full_name || u.id }))} value={h.assigned_to ?? ''} onChange={(id: string) => set({ assigned_to: id })} placeholder="Assign a responsible user" />
          </Field>
          <Field label="Mail Ref / Link" className="sm:col-span-2">
            <Input value={h.mail_ref ?? ''} onChange={e => set({ mail_ref: e.target.value })} placeholder="Mail subject or link (the mail thread holds the full record — no file upload needed)" />
          </Field>

          <div className="sm:col-span-2 mt-1 border-t border-surface-line pt-3"><p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">SAP References (enter once when invoiced)</p></div>
          <Field label="SAP Sales Order No"><Input value={h.sap_so_no ?? ''} onChange={e => set({ sap_so_no: e.target.value })} placeholder="e.g. 1465006426" /></Field>
          <Field label="Outbound Delivery No"><Input value={h.outbound_delivery_no ?? ''} onChange={e => set({ outbound_delivery_no: e.target.value })} placeholder="e.g. 1723056387" /></Field>
          <Field label="Transfer Order No"><Input value={h.transfer_order_no ?? ''} onChange={e => set({ transfer_order_no: e.target.value })} placeholder="e.g. 8777" /></Field>
          <Field label="Billing Document No"><Input value={h.billing_doc_no ?? ''} onChange={e => set({ billing_doc_no: e.target.value })} placeholder="e.g. 8815005379" /></Field>
          <Field label="Remarks" className="sm:col-span-2"><Textarea value={h.remarks ?? ''} onChange={e => set({ remarks: e.target.value })} /></Field>
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

// Single place to record the SAP outputs after invoicing — no re-typing into the
// challan or reports. Marks the order 'invoiced'.
function InvoiceModal({ order, notify, onClose, onDone }: any) {
  const [h, setH] = useState<any>({
    sap_so_no: order.sap_so_no ?? '',
    outbound_delivery_no: order.outbound_delivery_no ?? '', transfer_order_no: order.transfer_order_no ?? '',
    billing_doc_no: order.billing_doc_no ?? order.invoice_no ?? ''
  })
  const [saving, setSaving] = useState(false)
  const set = (patch: any) => setH((x: any) => ({ ...x, ...patch }))
  const save = async () => {
    setSaving(true)
    try {
      // billing_doc_no is the one SAP number that means "invoiced" — invoice_no just
      // mirrors it so older search/reports that key off invoice_no keep working.
      const { error } = await supabase.from('sales_orders').update({
        invoice_no: h.billing_doc_no || null, sap_so_no: h.sap_so_no || null, outbound_delivery_no: h.outbound_delivery_no || null,
        transfer_order_no: h.transfer_order_no || null, billing_doc_no: h.billing_doc_no || null, status: 'invoiced'
      } as any).eq('id', order.id)
      if (error) throw error
      notify('success', `${order.so_no} marked invoiced`)
      onDone()
    } catch (e: any) { notify('error', e?.message ?? 'Could not save invoice details') } finally { setSaving(false) }
  }
  return (
    <Modal open onClose={onClose} title={`Enter Invoice (SAP) — ${order.so_no}`} size="md">
      <div className="space-y-4">
        <p className="text-xs text-ink-soft">After invoicing in SAP, paste the numbers here once. They flow to the challan, gate pass and reports automatically.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Billing Document No" required className="sm:col-span-2"><Input value={h.billing_doc_no} onChange={e => set({ billing_doc_no: e.target.value })} placeholder="e.g. 8815005417" /></Field>
          <Field label="SAP Sales Order No"><Input value={h.sap_so_no} onChange={e => set({ sap_so_no: e.target.value })} placeholder="e.g. 1465006470" /></Field>
          <Field label="Outbound Delivery No"><Input value={h.outbound_delivery_no} onChange={e => set({ outbound_delivery_no: e.target.value })} placeholder="e.g. 1723056430" /></Field>
          <Field label="Transfer Order No"><Input value={h.transfer_order_no} onChange={e => set({ transfer_order_no: e.target.value })} placeholder="e.g. 8892" /></Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button icon="receipt_long" loading={saving} onClick={save}>Mark Invoiced</Button>
        </div>
      </div>
    </Modal>
  )
}

function SOOverview({ so, customerName, products, customers, vehicles, ownerName, canEdit, onEdit, onScanned, onDownloadSO, onClose }: any) {
  const [tab, setTab] = useState<'details' | 'scan'>('details')
  const [items, setItems] = useState<any[]>([])
  const [deliveries, setDeliveries] = useState<any[]>([])

  useEffect(() => {
    if (!so?.id) return
    supabase.from('sales_order_items').select('*').eq('so_id', so.id).then(({ data }) => setItems(data ?? []))
    // Deliveries = the challans raised against this order, each with its mode and product lines.
    ;(async () => {
      // Full row (not a narrow column list) so the same object can also be handed
      // straight to downloadChallanPdfFor for the "Download" button below.
      const { data: chs } = await supabase.from('delivery_challans')
        .select('*')
        .eq('sales_order_id', so.id).order('challan_date', { ascending: true })
      const ids = (chs ?? []).map((c: any) => c.id)
      const byCh: Record<string, any[]> = {}
      if (ids.length) {
        const { data: cis } = await supabase.from('delivery_challan_items').select('challan_id,product_id,qty').in('challan_id', ids)
        ;(cis ?? []).forEach((ci: any) => { (byCh[ci.challan_id] ??= []).push(ci) })
      }
      setDeliveries((chs ?? []).map((c: any) => ({ ...c, items: byCh[c.id] ?? [] })))
    })()
  }, [so?.id])

  const productCode = (id: string) => products.find((p: any) => p.id === id)?.material_code ?? '?'
  const productName = (id: string) => products.find((p: any) => p.id === id)?.name ?? id

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
    <Modal open onClose={onClose} title={`Sales Order — ${so.so_no}`} size="xl">
      <div className="space-y-5">
        <Tabs tabs={[{ key: 'details', label: 'Details' }, { key: 'scan', label: 'Scan Serials' }]} active={tab} onChange={(k: any) => setTab(k)} />

        {tab === 'details' && <>
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" icon="download" onClick={onDownloadSO}>Download Invoice (PDF)</Button>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-surface-line bg-surface-sunken/40 p-4 sm:grid-cols-3">
          <Stat label="Customer" value={customerName} />
          <Stat label="Order Date" value={formatDate(so.order_date)} />
          <Stat label="Customer PO" value={so.reference_no ?? '—'} />
          <Stat label="Status" value={<Badge tone={tone(so.status)}>{so.status}</Badge>} />
          <Stat label="Total Qty" value={formatNumber(so.total_qty)} />
          <Stat label="Total Amount" value={formatNumber(so.total_amount)} />
          <Stat label="Owner" value={ownerName || '— unassigned'} />
        </div>

        <Section title="Workflow">
          <WorkflowPanel order={so} responsibleName={ownerName} />
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
              items.map((it: any, i: number) => {
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
            ) : deliveries.map((d: any, i: number) => {
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
                      {formatDate(d.challan_date)} {d.posted_at ? <Badge tone="positive">Stock out</Badge> : <Badge tone={tone(d.status)}>{d.status}</Badge>}
                      <button type="button" title="Download challan PDF" onClick={() => downloadChallanPdfFor(d, { customers, vehicles, products })}
                        className="rounded-lg p-1 text-ink-faint hover:bg-surface-sunken hover:text-brand-600"><Icon name="download" className="text-[16px]" /></button>
                    </span>
                  </div>
                  {d.items.length > 0 && (
                    <p className="mt-1 pl-7 text-xs text-ink-faint">{d.items.map((it: any) => `${productCode(it.product_id)}×${formatNumber(it.qty)}`).join('  ·  ')}</p>
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

        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          {canEdit && tab === 'details' && <Button icon="edit" onClick={onEdit}>Edit</Button>}
        </div>
      </div>
    </Modal>
  )
}


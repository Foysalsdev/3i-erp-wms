import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { useCollection } from '@/hooks/useCollection'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Modal } from '@/components/ui/Modal'
import { ActionMenu } from '@/components/ui/ActionMenu'
import { ConfirmDelete } from '@/components/ui/ConfirmDelete'
import { SearchBar } from '@/components/shared/SearchBar'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { SelectBox } from '@/components/ui/SelectBox'
import { formatNumber, formatDate } from '@/lib/utils'
import { LineItems, type LineRow } from '@/components/shared/LineItems'
import { Combobox } from '@/components/shared/Combobox'
import { GrnSerialScan } from './GrnSerialScan'
import { TrailPanel } from '@/components/shared/TrailPanel'
import { useAutoOpen } from '@/hooks/useAutoOpen'

const today = () => new Date().toISOString().slice(0, 10)
const tone = (s: string) => s === 'approved' ? 'positive' : s === 'completed' ? 'info' : s === 'cancelled' ? 'negative' : s === 'draft' ? 'neutral' : 'critical'
const statusLabel = (s: string) => s === 'approved' ? 'Approved' : s === 'completed' ? 'Complete' : s.charAt(0).toUpperCase() + s.slice(1)

// Status follows the SAP reference rule:
//  - SAP GRN ref only            -> Draft
//  - SAP MIRO ref present        -> Complete
//  - approved (stock posted)     -> stays Approved
import type { Tables } from '@/types/database.types'

type Grn = Tables<'goods_receipts'>
type GrnItem = Tables<'goods_receipt_items'>
type GrnView = Grn & { __items?: GrnItem[] }
type SupplierLite = Pick<Tables<'suppliers'>, 'id' | 'supplier_code' | 'name'>
type WarehouseLite = Pick<Tables<'warehouses'>, 'id' | 'code' | 'name'>
type ProductLite = Pick<Tables<'products'>, 'id' | 'material_code' | 'name' | 'barcode' | 'category' | 'uom' | 'plant'>
type Notify = (kind: 'success' | 'error' | 'info', msg: string) => void

function deriveStatus(current: string | undefined, grnRef?: string | null, miroRef?: string | null) {
  if (current === 'approved') return 'approved'
  if (current === 'cancelled') return 'cancelled'
  if (miroRef && miroRef.trim()) return 'completed'
  if (grnRef && grnRef.trim()) return 'draft'
  return 'pending'
}

export function InboundGRN() {
  const { data, loading, refresh } = useCollection('goods_receipts', { order: 'created_at' })
  const { currentClientId, can, isPlatformAdmin } = useAuth()
  const notify = useUI(s => s.notify)
  const canEdit = can('inbound.create') || can('inbound.edit')
  const canApprove = can('inbound.approve') || can('inbound.post') || isPlatformAdmin
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<GrnView | null>(null)
  useAutoOpen(() => { setEditing(null); setModal(true) })
  const [viewing, setViewing] = useState<GrnView | null>(null)
  const [scanning, setScanning] = useState<Grn | null>(null)
  const [deleting, setDeleting] = useState<Grn | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<SupplierLite[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseLite[]>([])
  const [products, setProducts] = useState<ProductLite[]>([])

  useEffect(() => {
    if (!currentClientId) return
    supabase.from('suppliers').select('id,supplier_code,name').then(({ data }) => setSuppliers(data ?? []))
    supabase.from('warehouses').select('id,code,name').then(({ data }) => setWarehouses(data ?? []))
    supabase.from('products').select('id,material_code,name,barcode,category,uom,plant').then(({ data }) => setProducts(data ?? []))
  }, [currentClientId])

  const supplierName = (id: string | null) => { const s = suppliers.find(x => x.id === id); return s ? `${s.supplier_code} — ${s.name}` : '—' }

  const rows = useMemo(() => {
    if (!q.trim()) return data
    const t = q.toLowerCase()
    return data.filter(r =>
      String(r.grn_no ?? '').toLowerCase().includes(t) ||
      String(r.sap_grn_ref ?? '').toLowerCase().includes(t) ||
      String(r.sap_miro_ref ?? '').toLowerCase().includes(t))
  }, [data, q])

  // Approval posts every GRN line into inventory, then marks the GRN approved.
  const approve = async (grn: Grn) => {
    if (grn.posted_at) { notify('info', 'This GRN is already approved & in stock'); return }
    if (grn.status !== 'completed') { notify('error', 'Add the SAP MIRO ref (Complete) before approving'); return }
    if (!grn.warehouse_id) { notify('error', 'Set a warehouse on the GRN before approving'); return }
    setBusy(grn.id)
    try {
      const { data: items } = await supabase.from('goods_receipt_items').select('*').eq('grn_id', grn.id)
      if (!items || items.length === 0) { notify('error', 'Add line items before approving'); return }
      for (const it of items) {
        const postQty = Number(it.received_qty) > 0 ? Number(it.received_qty) : Number(it.qty)
        if (!it.product_id || !(postQty > 0)) continue
        const { error } = await supabase.rpc('post_stock_movement', {
           p_product: it.product_id, p_warehouse: grn.warehouse_id!,
          p_location: it.location_id ?? undefined, p_stock_status: it.stock_status || 'good',
          p_qty_in: postQty, p_qty_out: 0, p_movement_type: 'GRN',
          p_reference_type: 'goods_receipt', p_reference_id: grn.id, p_reference_no: grn.grn_no ?? undefined,
          p_serial_no: undefined,
          p_remarks: `GRN ${grn.grn_no}${grn.sap_grn_ref ? ' · SAP ' + grn.sap_grn_ref : ''}`
        })
        if (error) throw error
      }
      const { error } = await supabase.from('goods_receipts').update({ posted_at: new Date().toISOString(), status: 'approved', billable: true }).eq('id', grn.id)
      if (error) throw error
      notify('success', `${grn.grn_no} approved — stock added to inventory`)
      refresh()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not approve GRN')
    } finally {
      setBusy(null)
    }
  }

  const openEdit = async (r: Grn) => {
    const { data: items } = await supabase.from('goods_receipt_items').select('*').eq('grn_id', r.id)
    setEditing({ ...r, __items: items ?? [] }); setModal(true)
  }

  const openView = async (r: Grn) => {
    const { data: items } = await supabase.from('goods_receipt_items').select('*').eq('grn_id', r.id)
    setViewing({ ...r, __items: items ?? [] })
  }

  const columns: Column<Grn>[] = [
    { key: 'grn_no', header: 'GRN (MIGO)', accessor: r => r.grn_no, sortable: true, className: 'font-medium' },
    { key: 'sap_miro_ref', header: 'SAP MIRO', accessor: r => r.sap_miro_ref ?? '—' },
    { key: 'supplier', header: 'Supplier', render: r => supplierName(r.supplier_id) },
    { key: 'total_qty', header: 'Qty', accessor: r => formatNumber(r.total_qty), className: 'text-right' },
    { key: 'status', header: 'Status', render: r => (
      <div className="flex items-center gap-1">
        <StatusBadge status={r.status} label={statusLabel(r.status)} />
        {r.billable && <Badge tone="info">Billable</Badge>}
      </div>
    ) },
    {
      key: '__a', header: '', className: 'w-px whitespace-nowrap',
      render: r => (
        <div className="flex justify-end" onClick={e => e.stopPropagation()}>
          <ActionMenu items={[
            { icon: 'visibility', label: 'View', onClick: () => openView(r) },
            ...(canEdit ? [{ icon: 'edit', label: 'Edit', onClick: () => openEdit(r) }] : []),
            ...(canEdit ? [{ icon: 'qr_code_scanner', label: 'Scan Serials (optional)', onClick: () => setScanning(r) }] : []),
            ...(canApprove && !r.posted_at && r.status === 'completed' ? [{ icon: 'check_circle', label: busy === r.id ? 'Approving…' : 'Approve & Add to Stock', onClick: () => approve(r) }] : []),
            ...(isPlatformAdmin ? [{ icon: 'delete', label: 'Delete', tone: '!text-bad hover:!text-bad hover:!bg-bad/10', onClick: () => setDeleting(r) }] : [])
          ]} />
        </div>
      )
    }
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-72"><SearchBar value={q} onChange={setQ} placeholder="Search GRN / SAP ref…" /></div>
        <span className="text-sm text-ink-soft">{rows.length} records</span>
        {canEdit && <Button className="ml-auto" icon="add" onClick={() => { setEditing(null); setModal(true) }}>New GRN</Button>}
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DataTable fill columns={columns} rows={rows} loading={loading} rowKey={r => r.id}
          onRowClick={canEdit ? openEdit : openView} emptyTitle="No goods receipts yet" />
      </Card>

      {modal && (
        <GRNForm record={editing} suppliers={suppliers} warehouses={warehouses} products={products}
          clientId={currentClientId!} notify={notify}
          onClose={() => setModal(false)} onDone={() => { setModal(false); refresh() }} />
      )}

      {viewing && (
        <GRNOverview grn={viewing} supplierName={supplierName(viewing.supplier_id)}
          warehouseName={warehouses.find(w => w.id === viewing.warehouse_id)?.name ?? '—'}
          products={products} canEdit={canEdit}
          onEdit={() => { const r = viewing; setViewing(null); openEdit(r) }}
          onClose={() => setViewing(null)} />
      )}

      {scanning && (
        <GrnSerialScan grn={scanning} clientId={currentClientId!} notify={notify}
          onClose={() => setScanning(null)} />
      )}

      <ConfirmDelete open={!!deleting} onClose={() => setDeleting(null)}
        name={deleting ? `GRN · ${deleting.grn_no}` : undefined}
        onConfirm={async () => {
          if (!deleting) return { error: null }
          const res = await supabase.from('goods_receipts').delete().eq('id', deleting.id)
          if (!res.error) { setDeleting(null); refresh() }
          return res
        }} />
    </div>
  )
}

function GRNForm({ record, suppliers, warehouses, products, clientId, notify, onClose, onDone }: {
  record: GrnView | null; suppliers: SupplierLite[]; warehouses: WarehouseLite[]; products: ProductLite[]
  clientId: string; notify: Notify; onClose: () => void; onDone: () => void
}) {
  const [h, setH] = useState<Partial<Grn>>(record ?? { receipt_date: today() })
  const [lines, setLines] = useState<LineRow[]>((record?.__items ?? []).map(it => ({
    product_id: it.product_id ?? '', qty: it.qty, expected_qty: it.expected_qty ?? undefined,
    unit_price: it.unit_price, stock_status: it.stock_status, location_id: it.location_id ?? undefined
  })))
  const [locations, setLocations] = useState<Pick<Tables<'locations'>, 'id' | 'location_code'>[]>([])
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<Grn>) => setH(x => ({ ...x, ...patch }))
  const approved = record?.status === 'approved'
  const previewStatus = deriveStatus(record?.status, h.sap_grn_ref, h.sap_miro_ref)

  useEffect(() => {
    if (!h.warehouse_id) { setLocations([]); return }
    supabase.from('locations').select('id,location_code').eq('warehouse_id', h.warehouse_id).then(({ data }) => setLocations(data ?? []))
  }, [h.warehouse_id])

  const save = async () => {
    // GRN is tracked by the SAP MIGO reference — no separate internal number.
    const migo = (h.sap_grn_ref || '').trim()
    const validLines = lines.filter((r: LineRow) => r.product_id)
    if (!migo) { notify('error', 'SAP MIGO No din — eta diyei GRN track hobe'); return }
    if (!h.warehouse_id) { notify('error', 'Warehouse select korun'); return }
    if (validLines.length === 0) { notify('error', 'Onto ekta product line add korun (product select kora)'); return }
    const badLine = validLines.find((r: LineRow) => !(Number(r.qty) > 0))
    if (badLine) { notify('error', 'Protita product line-e Received Qty din (0 er beshi)'); return }
    setSaving(true)
    try {
      const totalQty = lines.reduce((s, r) => s + (Number(r.qty) || 0), 0)
      const status = deriveStatus(record?.status, h.sap_grn_ref, h.sap_miro_ref)
      const header = {
         supplier_id: h.supplier_id || null, warehouse_id: h.warehouse_id || null,
        reference_no: h.reference_no || null, receipt_date: h.receipt_date || today(),
        sap_grn_ref: h.sap_grn_ref || null, sap_miro_ref: h.sap_miro_ref || null,
        gate_vehicle_no: h.gate_vehicle_no || null, gate_driver: h.gate_driver || null,
        gate_transporter: h.gate_transporter || null, gate_in_at: h.gate_in_at || null,
        billable: !!(h.sap_miro_ref && h.sap_miro_ref.trim()),
        total_items: lines.filter(r => r.product_id).length, total_qty: totalQty,
        status, remarks: h.remarks || null
      }
      let grnId = record?.id
      if (record) {
        const { error } = await supabase.from('goods_receipts').update(header).eq('id', record.id)
        if (error) throw error
      } else {
        // Use the SAP MIGO reference itself as the GRN identifier.
        const { data, error } = await supabase.from('goods_receipts').insert({ ...header, grn_no: migo }).select('id').single()
        if (error) throw error
        grnId = data.id
      }
      if (!grnId) throw new Error('GRN id missing after save')
      await supabase.from('goods_receipt_items').delete().eq('grn_id', grnId)
      const payloadLines = lines.filter(r => r.product_id).map(r => ({
         grn_id: grnId, product_id: r.product_id, qty: Number(r.qty) || 0,
        expected_qty: Number(r.expected_qty) || 0, received_qty: Number(r.qty) || 0,
        unit_price: Number(r.unit_price) || 0, stock_status: r.stock_status || 'good', location_id: r.location_id || null
      }))
      if (payloadLines.length) {
        const { error } = await supabase.from('goods_receipt_items').insert(payloadLines)
        if (error) throw error
      }
      notify('success', `GRN ${record ? 'updated' : 'created'} · ${statusLabel(status)}`)
      onDone()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not save GRN')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`${record ? 'Edit' : 'New'} GRN`} size="lg">
      <div className="space-y-4">
        {record && <div className="rounded-lg bg-surface-sunken px-3 py-2 text-sm"><span className="text-ink-faint">GRN No: </span><span className="font-semibold">{record.grn_no}</span>{approved && <span className="ml-2"><Badge tone="positive">Approved · in stock</Badge></span>}</div>}
        {approved && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">This GRN is approved and posted to inventory. Editing lines will not change posted stock.</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Supplier">
            <Combobox items={suppliers.map(s => ({ id: s.id, label: s.supplier_code, sublabel: s.name }))} value={h.supplier_id ?? ''} onChange={(id: string) => set({ supplier_id: id })} placeholder="Search supplier by code or name" />
          </Field>
          <Field label="Warehouse">
            <SelectBox value={h.warehouse_id ?? ''} onChange={e => set({ warehouse_id: e.target.value })}>
              <option value="">Select…</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
            </SelectBox>
          </Field>
          <Field label="SAP MIGO No" required><Input value={h.sap_grn_ref ?? ''} onChange={e => set({ sap_grn_ref: e.target.value })} placeholder="GRN identity — e.g. 500012345" /></Field>
          <Field label="SAP MIRO No"><Input value={h.sap_miro_ref ?? ''} onChange={e => set({ sap_miro_ref: e.target.value })} placeholder="Adding this marks the GRN Complete & billable" /></Field>
          <Field label="Reference (PR / other)"><Input value={h.reference_no ?? ''} onChange={e => set({ reference_no: e.target.value })} /></Field>
          <Field label="Receipt Date" required><Input type="date" value={h.receipt_date ?? ''} onChange={e => set({ receipt_date: e.target.value })} /></Field>
          <Field label="Remarks" className="sm:col-span-2"><Textarea value={h.remarks ?? ''} onChange={e => set({ remarks: e.target.value })} /></Field>
        </div>

        <details className="rounded-lg border border-surface-line px-3 py-2">
          <summary className="cursor-pointer select-none text-sm font-semibold text-ink">
            Gate Entry <span className="text-xs font-normal text-ink-faint">(optional — vehicle in)</span>
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Vehicle No"><Input value={h.gate_vehicle_no ?? ''} onChange={e => set({ gate_vehicle_no: e.target.value })} placeholder="e.g. DHK-METRO-11-2345" /></Field>
            <Field label="Driver Name"><Input value={h.gate_driver ?? ''} onChange={e => set({ gate_driver: e.target.value })} /></Field>
            <Field label="Transporter"><Input value={h.gate_transporter ?? ''} onChange={e => set({ gate_transporter: e.target.value })} /></Field>
            <Field label="Gate-in Date/Time"><Input type="datetime-local" value={h.gate_in_at ?? ''} onChange={e => set({ gate_in_at: e.target.value })} /></Field>
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-sunken px-3 py-2 text-sm">
          <span className="text-ink-faint">Status on save:</span>
          <StatusBadge status={previewStatus} label={statusLabel(previewStatus)} />
          <span className="text-xs text-ink-faint">{previewStatus === 'completed' ? '· ready to approve into stock' : previewStatus === 'draft' ? '· add SAP MIRO No to complete' : ''}</span>
          {h.sap_miro_ref && h.sap_miro_ref.trim() && <Badge tone="info">Billable</Badge>}
        </div>

        <LineItems rows={lines} onChange={setLines} products={products} locations={locations} variant="grn" />

        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button icon="save" loading={saving} onClick={save}>{record ? 'Update' : 'Create'}</Button>
        </div>
      </div>
    </Modal>
  )
}

// Read-only 360° view of a GRN: header, SAP trail, items, and the merged
// activity + stock-movement trail (audit_logs + inventory_ledger legs posted
// on approval) — one place to see everything that happened to this receipt.
function GRNOverview({ grn, supplierName, warehouseName, products, canEdit, onEdit, onClose }: {
  grn: GrnView; supplierName: string; warehouseName: string; products: ProductLite[]
  canEdit: boolean; onEdit: () => void; onClose: () => void
}) {
  const items: GrnItem[] = grn.__items ?? []
  const productLabel = (id: string | null) => { const p = products.find(x => x.id === id); return p ? `${p.material_code} — ${p.name}` : id ?? '—' }
  const Stat = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="min-w-0"><p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{label}</p><div className="mt-0.5 text-sm font-medium text-ink break-words">{value}</div></div>
  )
  return (
    <Modal open onClose={onClose} title={`GRN — ${grn.grn_no}`} size="lg">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-surface-line bg-surface-sunken/40 p-4 sm:grid-cols-3">
          <Stat label="Supplier" value={supplierName} />
          <Stat label="Warehouse" value={warehouseName} />
          <Stat label="Receipt Date" value={formatDate(grn.receipt_date)} />
          <Stat label="SAP MIGO" value={grn.sap_grn_ref || '—'} />
          <Stat label="SAP MIRO" value={grn.sap_miro_ref || <span className="text-ink-faint">pending</span>} />
          <Stat label="Status" value={<div className="flex items-center gap-1"><StatusBadge status={grn.status} label={statusLabel(grn.status)} />{grn.posted_at && <Badge tone="positive">In stock</Badge>}</div>} />
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Items</p>
          <div className="overflow-hidden rounded-xl border border-surface-line">
            {items.length === 0 ? <p className="p-3 text-sm text-ink-faint">No items</p> :
              items.map((it, i) => (
                <div key={it.id ?? i} className={'flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                  <span className="min-w-0 truncate text-ink">{productLabel(it.product_id)}</span>
                  <span className="shrink-0 text-ink-soft">{formatNumber(Number(it.received_qty) > 0 ? it.received_qty : it.qty)}</span>
                </div>
              ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Activity & stock movement</p>
          <TrailPanel table="goods_receipts" recordId={grn.id} referenceNo={grn.grn_no} />
        </div>

        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          {canEdit && <Button icon="edit" onClick={onEdit}>Edit</Button>}
        </div>
      </div>
    </Modal>
  )
}

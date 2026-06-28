import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Icon } from '@/components/ui/Icon'

interface Hit { cat: string; icon: string; label: string; sub: string; path: string }

// ---------------------------------------------------------------------------
// Universal Search (WES principle #4 "Search First").
// One search retrieves the complete operational chain — a user can find a
// transaction by Serial, PO, Invoice, Sales Order, Outbound Delivery,
// Transfer Order, Billing Document, Delivery Challan, Gate Pass, CN/tracking
// or Customer, and jump straight to the filtered record.
// ---------------------------------------------------------------------------

// Master records — navigate to the master list.
const MASTERS = [
  { table: 'products', icon: 'inventory_2', cat: 'Product', label: 'name', sub: 'material_code', cols: 'id,name,material_code', search: ['name', 'material_code', 'barcode'], path: '/masters/products' },
  { table: 'customers', icon: 'badge', cat: 'Customer', label: 'name', sub: 'customer_code', cols: 'id,name,customer_code', search: ['name', 'customer_code'], path: '/masters/customers' },
  { table: 'suppliers', icon: 'local_shipping', cat: 'Supplier', label: 'name', sub: 'supplier_code', cols: 'id,name,supplier_code', search: ['name', 'supplier_code'], path: '/masters/suppliers' },
  { table: 'warehouses', icon: 'warehouse', cat: 'Warehouse', label: 'name', sub: 'code', cols: 'id,name,code', search: ['name', 'code'], path: '/masters/warehouses' },
  { table: 'assets', icon: 'category', cat: 'Asset', label: 'name', sub: 'asset_code', cols: 'id,name,asset_code', search: ['name', 'asset_code'], path: '/masters/assets' }
] as const

// Transaction documents — navigate to the relevant tab pre-filtered (?q=) on the
// document's own number, so the destination list lands directly on the record.
const TXNS = [
  { table: 'sales_orders', icon: 'shopping_cart', cat: 'Sales Order', idField: 'so_no',
    cols: 'id,so_no,reference_no,invoice_no,sap_so_no,outbound_delivery_no,transfer_order_no,billing_doc_no',
    search: ['so_no', 'reference_no', 'invoice_no', 'sap_so_no', 'outbound_delivery_no', 'transfer_order_no', 'billing_doc_no'],
    sub: (r: any) => r.reference_no ? `PO ${r.reference_no}` : r.sap_so_no ? `SAP SO ${r.sap_so_no}` : '', path: '/outbound/sales-order' },
  { table: 'delivery_challans', icon: 'receipt', cat: 'Delivery Challan', idField: 'challan_no',
    cols: 'id,challan_no,invoice_no,po_no', search: ['challan_no', 'invoice_no', 'po_no'],
    sub: (r: any) => r.invoice_no ? `Invoice ${r.invoice_no}` : r.po_no ? `PO ${r.po_no}` : '', path: '/outbound/delivery-challan' },
  { table: 'gate_passes', icon: 'door_front', cat: 'Gate Pass', idField: 'gate_pass_no',
    cols: 'id,gate_pass_no,driver_name,purpose', search: ['gate_pass_no', 'driver_name'],
    sub: (r: any) => r.driver_name || r.purpose || '', path: '/outbound/gate-pass' },
  { table: 'proof_of_delivery', icon: 'task_alt', cat: 'Customer POD', idField: 'pod_no',
    cols: 'id,pod_no,received_by', search: ['pod_no', 'received_by'],
    sub: (r: any) => r.received_by ? `Received by ${r.received_by}` : '', path: '/outbound/pod-upload' },
  { table: 'courier_shipments', icon: 'local_post_office', cat: 'Courier / CN', idField: 'shipment_no',
    cols: 'id,shipment_no,tracking_no', search: ['shipment_no', 'tracking_no'],
    sub: (r: any) => r.tracking_no ? `CN ${r.tracking_no}` : '', path: '/transport/courier' },
  { table: 'serial_numbers', icon: 'qr_code_2', cat: 'Serial', idField: 'serial_no',
    cols: 'id,serial_no,reference_no,status', search: ['serial_no', 'reference_no'],
    sub: (r: any) => [r.status, r.reference_no].filter(Boolean).join(' · '), path: '/inventory/serials' }
] as const

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const clientId = useAuth(s => s.currentClientId)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    if (!open) { setQ(''); setHits([]) }
  }, [open])

  useEffect(() => {
    const term = q.trim()
    if (!term || !clientId) { setHits([]); return }
    // Strip PostgREST-sensitive chars so the .or() filter stays valid.
    const safe = term.replace(/[,()]/g, ' ').trim()
    if (!safe) { setHits([]); return }
    const t = setTimeout(async () => {
      setLoading(true)
      const orFilter = (cols: readonly string[]) => cols.map(c => `${c}.ilike.%${safe}%`).join(',')

      const masterHits = Promise.all(MASTERS.map(async s => {
        const { data } = await supabase.from(s.table as any).select(s.cols)
          .eq('client_id', clientId).or(orFilter(s.search)).limit(5)
        return (data ?? []).map((r: any) => ({
          cat: s.cat, icon: s.icon, label: r[s.label] ?? r[s.sub] ?? '—',
          sub: `${s.cat} · ${r[s.sub] ?? ''}`, path: s.path
        })) as Hit[]
      }))

      const txnHits = Promise.all(TXNS.map(async s => {
        const { data } = await supabase.from(s.table as any).select(s.cols)
          .eq('client_id', clientId).or(orFilter(s.search)).limit(5)
        return (data ?? []).map((r: any) => {
          const id = r[s.idField] ?? ''
          const extra = s.sub(r)
          return {
            cat: s.cat, icon: s.icon, label: id || '—',
            sub: `${s.cat}${extra ? ' · ' + extra : ''}`,
            path: `${s.path}?q=${encodeURIComponent(id)}`
          }
        }) as Hit[]
      }))

      const [m, x] = await Promise.all([masterHits, txnHits])
      // Documents first (most specific), then masters.
      setHits([...x.flat(), ...m.flat()])
      setLoading(false)
    }, 250)
    return () => clearTimeout(t)
  }, [q, clientId])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh]" onClick={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-card bg-surface shadow-fiori-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-horizon-line px-4">
          <Icon name="search" className="text-slate-400" />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search SO, PO, invoice, challan, gate pass, CN, serial, customer…"
            className="w-full py-3.5 text-sm outline-none" />
          {loading && <Icon name="progress_activity" className="animate-spin text-brand-500" />}
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {hits.length === 0 && q && !loading && <p className="px-3 py-6 text-center text-sm text-horizon-muted">No matches</p>}
          {hits.map((h, i) => (
            <button key={i} onClick={() => { nav(h.path); onClose() }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-brand-50/60">
              <Icon name={h.icon} className="text-[20px] text-brand-500" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{h.label}</p>
                <p className="truncate text-xs text-horizon-muted">{h.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

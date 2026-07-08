import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Icon } from '@/components/ui/Icon'
import { LoadingRing } from '@/components/ui/LoadingRing'
import { MODULES } from '@/lib/constants'
import { MASTERS, MASTER_ORDER } from '@/features/masters/registry'
import { OPERATIONS } from '@/features/operations/registry'
import { cn } from '@/lib/utils'

interface Hit { cat: string; icon: string; label: string; sub: string; path: string }

// ---------------------------------------------------------------------------
// Universal Search + Command Palette (WES principle #4 "Search First").
// One search retrieves the complete operational chain — a user can find a
// transaction by Serial, PO, Invoice, Sales Order, Outbound Delivery,
// Transfer Order, Billing Document, Delivery Challan, Gate Pass, CN/tracking
// or Customer — AND jump straight to any module/tab, or land directly in a
// "New X" create form (the target list picks up ?new=1 via useAutoOpen).
// ---------------------------------------------------------------------------

// Master records — navigate to the master list.
const SEARCH_MASTERS = [
  { table: 'products', icon: 'inventory_2', cat: 'Product', label: 'name', sub: 'material_code', cols: 'id,name,material_code', search: ['name', 'material_code', 'barcode'], path: '/masters/products' },
  { table: 'customers', icon: 'badge', cat: 'Customer', label: 'name', sub: 'customer_code', cols: 'id,name,customer_code', search: ['name', 'customer_code'], path: '/masters/customers' },
  { table: 'suppliers', icon: 'local_shipping', cat: 'Supplier', label: 'name', sub: 'supplier_code', cols: 'id,name,supplier_code', search: ['name', 'supplier_code'], path: '/masters/suppliers' },
  { table: 'warehouses', icon: 'warehouse', cat: 'Warehouse', label: 'name', sub: 'code', cols: 'id,name,code', search: ['name', 'code'], path: '/masters/warehouses' },
  { table: 'assets', icon: 'category', cat: 'Asset', label: 'name', sub: 'asset_code', cols: 'id,name,asset_code', search: ['name', 'asset_code'], path: '/masters/assets' }
] as const

// Transaction documents — navigate to the relevant tab pre-filtered (?q=) on the
// document's own number, so the destination list lands directly on the record.
const TXNS = [
  { table: 'sales_orders', icon: 'shopping_cart', cat: 'Order', idField: 'so_no',
    cols: 'id,so_no,reference_no,invoice_no,sap_so_no,outbound_delivery_no,transfer_order_no,billing_doc_no',
    search: ['so_no', 'reference_no', 'invoice_no', 'sap_so_no', 'outbound_delivery_no', 'transfer_order_no', 'billing_doc_no'],
    sub: (r: any) => r.reference_no ? `PO ${r.reference_no}` : r.sap_so_no ? `SAP SO ${r.sap_so_no}` : '', path: '/outbound/sales-order' },
  { table: 'delivery_challans', icon: 'receipt', cat: 'Delivery Challan', idField: 'challan_no',
    cols: 'id,challan_no,invoice_no,po_no,courier_tracking_no', search: ['challan_no', 'invoice_no', 'po_no', 'courier_tracking_no'],
    sub: (r: any) => r.courier_tracking_no ? `CN ${r.courier_tracking_no}` : r.invoice_no ? `Invoice ${r.invoice_no}` : r.po_no ? `PO ${r.po_no}` : '', path: '/outbound/delivery-challan' },
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

// Inbound/outbound doc types with a live "New X" create flow, generic via
// OperationList — excludes registry entries (picking/dispatch/packing…) that
// don't have an actual tab in MODULES yet.
const INBOUND_OPS = ['putaway', 'purchase-return', 'supplier-invoice']
const OUTBOUND_OPS = ['gate-pass', 'pod-upload']

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const clientId = useAuth(s => s.currentClientId)
  const can = useAuth(s => s.can)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [loading, setLoading] = useState(false)
  const [hi, setHi] = useState(0)
  const nav = useNavigate()

  // "Go to <module> · <tab>" — every tab the user actually has access to.
  const navCommands = useMemo(() => {
    const out: Hit[] = []
    MODULES.forEach(m => {
      if (m.permission && !can(m.permission)) return
      if (m.tabs?.length) {
        m.tabs.forEach(t => out.push({ cat: 'Go to', icon: m.icon, label: `${m.label} · ${t.label}`, sub: 'Navigate', path: `${m.path}/${t.key}` }))
      } else {
        out.push({ cat: 'Go to', icon: m.icon, label: m.label, sub: 'Navigate', path: m.path })
      }
    })
    return out
  }, [can])

  // "New <thing>" — lands straight in the create form (?new=1, see useAutoOpen).
  const createCommands = useMemo(() => {
    const out: Hit[] = []
    if (can('masters.create')) {
      MASTER_ORDER.forEach(k => {
        const d = MASTERS[k]
        if (d) out.push({ cat: 'Create', icon: d.icon, label: `New ${d.singular}`, sub: 'Masters', path: `/masters/${k}?new=1` })
      })
    }
    if (can('outbound.create')) {
      out.push({ cat: 'Create', icon: 'shopping_cart', label: 'New Sales Order', sub: 'Outbound', path: '/outbound/sales-order?new=1' })
      out.push({ cat: 'Create', icon: 'receipt', label: 'New Delivery Challan', sub: 'Outbound', path: '/outbound/delivery-challan?new=1' })
      OUTBOUND_OPS.forEach(k => { const d = OPERATIONS[k]; if (d) out.push({ cat: 'Create', icon: d.icon, label: `New ${d.singular}`, sub: 'Outbound', path: `/outbound/${k}?new=1` }) })
    }
    if (can('inbound.create')) {
      out.push({ cat: 'Create', icon: 'inventory', label: 'New GRN', sub: 'Inbound', path: '/inbound/grn?new=1' })
      out.push({ cat: 'Create', icon: 'assignment', label: 'New Inward Requisition', sub: 'Inbound', path: '/inbound/purchase-requisition?new=1' })
      INBOUND_OPS.forEach(k => { const d = OPERATIONS[k]; if (d) out.push({ cat: 'Create', icon: d.icon, label: `New ${d.singular}`, sub: 'Inbound', path: `/inbound/${k}?new=1` }) })
    }
    if (can('transport.create')) {
      Object.values(OPERATIONS).filter(d => d.module === 'transport').forEach(d => out.push({ cat: 'Create', icon: d.icon, label: `New ${d.singular}`, sub: 'Transport', path: `/transport/${d.key}?new=1` }))
    }
    // Finance is a separate, secret module — it is reached only from inside
    // /finance, never surfaced on the shared global command palette.
    return out
  }, [can])

  const staticCommands = useMemo(() => [...createCommands, ...navCommands], [createCommands, navCommands])

  const matchedCommands = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return staticCommands.slice(0, 8)
    return staticCommands.filter(c => c.label.toLowerCase().includes(term) || c.sub.toLowerCase().includes(term)).slice(0, 8)
  }, [staticCommands, q])

  const combined = [...matchedCommands, ...hits]

  useEffect(() => {
    if (!open) { setQ(''); setHits([]) }
  }, [open])

  useEffect(() => { setHi(0) }, [q])

  useEffect(() => {
    const term = q.trim()
    if (!term || !clientId) { setHits([]); return }
    // Strip PostgREST-sensitive chars so the .or() filter stays valid.
    const safe = term.replace(/[,()]/g, ' ').trim()
    if (!safe) { setHits([]); return }
    const t = setTimeout(async () => {
      setLoading(true)
      const orFilter = (cols: readonly string[]) => cols.map(c => `${c}.ilike.%${safe}%`).join(',')

      const masterHits = Promise.all(SEARCH_MASTERS.map(async s => {
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

      // Vehicle number → the documents that moved on that vehicle (challans &
      // gate passes), so a vehicle search reveals its operational history.
      const vehicleHits = (async (): Promise<Hit[]> => {
        const { data: vehs } = await supabase.from('vehicles').select('id,vehicle_number')
          .eq('client_id', clientId).ilike('vehicle_number', `%${safe}%`).limit(3)
        if (!vehs || vehs.length === 0) return []
        const ids = vehs.map((v: any) => v.id)
        const vmap: Record<string, string> = Object.fromEntries(vehs.map((v: any) => [v.id, v.vehicle_number]))
        const [{ data: ch }, { data: gp }] = await Promise.all([
          supabase.from('delivery_challans').select('challan_no,vehicle_id,challan_date').eq('client_id', clientId).in('vehicle_id', ids).limit(8),
          supabase.from('gate_passes').select('gate_pass_no,vehicle_id,gate_out_date').eq('client_id', clientId).in('vehicle_id', ids).limit(8)
        ])
        const out: Hit[] = []
        ;(ch ?? []).forEach((c: any) => out.push({ cat: 'Vehicle', icon: 'local_shipping', label: c.challan_no, sub: `Delivery Challan · Vehicle ${vmap[c.vehicle_id] ?? ''}`, path: `/outbound/delivery-challan?q=${encodeURIComponent(c.challan_no)}` }))
        ;(gp ?? []).forEach((g: any) => out.push({ cat: 'Vehicle', icon: 'door_front', label: g.gate_pass_no, sub: `Gate Pass · Vehicle ${vmap[g.vehicle_id] ?? ''}`, path: `/outbound/gate-pass?q=${encodeURIComponent(g.gate_pass_no)}` }))
        return out
      })()

      const [m, x, v] = await Promise.all([masterHits, txnHits, vehicleHits])
      // Documents first (most specific), then vehicle-linked docs, then masters.
      setHits([...x.flat(), ...v, ...m.flat()])
      setLoading(false)
    }, 250)
    return () => clearTimeout(t)
  }, [q, clientId])

  const choose = (h: Hit) => { nav(h.path); onClose() }

  if (!open) return null
  // Portal to <body> so this overlay escapes the Topbar's stacking context and
  // always covers the full viewport.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh]" onClick={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-card bg-surface shadow-fiori-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-horizon-line px-4">
          <Icon name="search" className="text-ink-faint" />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search or run a command — try “New GRN”, “Go to Masters”, SO, invoice, serial…"
            className="w-full py-3.5 text-sm outline-none"
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setHi(i => Math.min(i + 1, combined.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(i => Math.max(i - 1, 0)) }
              else if (e.key === 'Enter') { e.preventDefault(); if (combined[hi]) choose(combined[hi]) }
              else if (e.key === 'Escape') onClose()
            }} />
          {loading && <LoadingRing className="h-5 w-5 text-brand-500" />}
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {combined.length === 0 && q && !loading && <p className="px-3 py-6 text-center text-sm text-horizon-muted">No matches</p>}
          {combined.map((h, i) => (
            <button key={`${h.path}-${i}`} onMouseEnter={() => setHi(i)} onClick={() => choose(h)}
              className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left', i === hi ? 'bg-surface-sunken' : 'hover:bg-surface-sunken')}>
              <Icon name={h.icon} className="text-[20px] text-brand-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{h.label}</p>
                <p className="truncate text-xs text-horizon-muted">{h.sub}</p>
              </div>
              {h.cat === 'Create' && <Icon name="add" className="shrink-0 text-[16px] text-ink-faint" />}
              {h.cat === 'Go to' && <Icon name="arrow_forward" className="shrink-0 text-[16px] text-ink-faint" />}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}

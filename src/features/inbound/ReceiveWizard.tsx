import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert } from '@/types/database.types'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { Spinner, EmptyState } from '@/components/ui/States'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Combobox } from '@/components/shared/Combobox'
import { formatNumber, formatDate } from '@/lib/utils'
import { normaliseSerial, describeSerialHistory, type SerialHistoryItem } from '@/lib/serials'
import { SerialHistoryModal } from '@/components/shared/SerialHistoryModal'
import { CONDITION_LIST, conditionLabel } from '@/lib/conditions'

// ---------------------------------------------------------------------------
// Receive — the task-first inbound flow. One continuous journey instead of
// separate forms: Arrival → Count/Scan → SAP refs → Review & post.
// The queue shows what needs receiving (expected PRs) and what's mid-flight
// (GRNs not yet posted), each with its SAP trail: MIGO → MIRO → Stock.
// GRN identity stays the SAP MIGO number, exactly like the GRN register.
// ---------------------------------------------------------------------------

const today = () => new Date().toISOString().slice(0, 10)

interface SRow { serial: string; original?: string; existingId?: string; status?: string }
interface WLine {
  product_id: string
  expected: number          // from PR (0 = no expectation)
  qty: string               // received qty (editable)
  stock_status: string      // key from the condition registry (lib/conditions)
  location_id: string
  serials: SRow[]
  scanOpen?: boolean
  scanInput?: string
}

type Grn = Tables<'goods_receipts'>
type PR = Tables<'purchase_requisitions'>
type SupplierLite = Pick<Tables<'suppliers'>, 'id' | 'supplier_code' | 'name'>
type WarehouseLite = Pick<Tables<'warehouses'>, 'id' | 'code' | 'name'>
type LocationLite = Pick<Tables<'locations'>, 'id' | 'location_code' | 'warehouse_id'>
type ProductLite = Pick<Tables<'products'>, 'id' | 'material_code' | 'name' | 'uom' | 'china_code' | 'barcode'>
type Notify = (kind: 'success' | 'error' | 'info', msg: string) => void

// SAP trail chip: filled = done, hollow = pending.
function SapChip({ done, label }: { done: boolean; label: string }) {
  return (
    <span className={'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ' +
      (done ? 'bg-ok/10 text-ok' : 'bg-surface-sunken text-ink-faint')}>
      <Icon name={done ? 'check_circle' : 'radio_button_unchecked'} className="text-[13px]" /> {label}
    </span>
  )
}

export function ReceiveTab() {
  const clientId = useAuth(s => s.currentClientId)
  const [suppliers, setSuppliers] = useState<SupplierLite[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseLite[]>([])
  const [locations, setLocations] = useState<LocationLite[]>([])
  const [products, setProducts] = useState<ProductLite[]>([])
  useEffect(() => {
    if (!clientId) return
    supabase.from('suppliers').select('id,supplier_code,name').eq('status', 'active').then(({ data }) => setSuppliers(data ?? []))
    supabase.from('warehouses').select('id,code,name').eq('status', 'active').then(({ data }) => setWarehouses(data ?? []))
    supabase.from('locations').select('id,location_code,warehouse_id').then(({ data }) => setLocations(data ?? []))
    supabase.from('products').select('id,material_code,name,uom,china_code,barcode').eq('status', 'active')
      .then(({ data }) => setProducts(data ?? []))
  }, [clientId])

  const { can, isPlatformAdmin } = useAuth()
  const canEdit = can('inbound.create') || can('inbound.edit')
  const canPost = can('inbound.approve') || can('inbound.post') || isPlatformAdmin
  const notify = useUI(s => s.notify)

  const [queueLoading, setQueueLoading] = useState(true)
  const [pendingGrns, setPendingGrns] = useState<Grn[]>([])
  const [expectedPrs, setExpectedPrs] = useState<PR[]>([])
  const [wizard, setWizard] = useState<{ grn?: Grn; pr?: PR } | null>(null)

  const loadQueue = () => {
    if (!clientId) return
    setQueueLoading(true)
    Promise.all([
      supabase.from('goods_receipts').select('*').is('posted_at', null)
        .neq('status', 'cancelled').order('created_at', { ascending: false }).limit(50),
      supabase.from('purchase_requisitions').select('*')
        .in('status', ['pending', 'approved']).order('created_at', { ascending: false }).limit(50)
    ]).then(([g, p]) => {
      setPendingGrns(g.data ?? []); setExpectedPrs(p.data ?? []); setQueueLoading(false)
    })
  }
  useEffect(loadQueue, [clientId])

  const supName = (id: string | null) => { const s = suppliers.find(x => x.id === id); return s ? s.name : '—' }

  if (wizard) {
    return <Wizard clientId={clientId!} grn={wizard.grn} pr={wizard.pr}
      suppliers={suppliers} warehouses={warehouses} locations={locations} products={products}
      canPost={canPost} notify={notify}
      onExit={() => { setWizard(null); loadQueue() }} />
  }

  if (queueLoading) return <Spinner label="Loading receiving queue…" />

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-ink-soft">Everything waiting to be received or finished, with its SAP trail.</p>
        {canEdit && <Button className="ml-auto" icon="add" onClick={() => setWizard({})}>Receive Now</Button>}
      </div>

      {pendingGrns.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">In progress — tap to continue</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pendingGrns.map(g => (
              <button key={g.id} type="button" onClick={() => canEdit && setWizard({ grn: g })}
                className="rounded-xl border border-surface-line bg-surface p-4 text-left transition hover:border-brand-400 hover:shadow-card">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-mono text-sm font-semibold text-ink">{g.grn_no}</p>
                  <span className="shrink-0 text-xs text-ink-faint">{formatDate(g.receipt_date)}</span>
                </div>
                <p className="mt-0.5 truncate text-sm text-ink-soft">{supName(g.supplier_id)} · {formatNumber(g.total_qty)} pcs</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <SapChip done={!!g.sap_grn_ref} label="MIGO" />
                  <SapChip done={!!g.sap_miro_ref} label="MIRO" />
                  <SapChip done={!!g.posted_at} label="Stock" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {expectedPrs.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Expected — from inward requisitions</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {expectedPrs.map(p => (
              <button key={p.id} type="button" onClick={() => canEdit && setWizard({ pr: p })}
                className="rounded-xl border border-dashed border-surface-line bg-surface p-4 text-left transition hover:border-brand-400 hover:shadow-card">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-mono text-sm font-semibold text-ink">{p.pr_no}</p>
                  <Badge tone={p.status === 'approved' ? 'info' : 'neutral'}>{p.status}</Badge>
                </div>
                <p className="mt-0.5 truncate text-sm text-ink-soft">{supName(p.supplier_id)} · {formatNumber(p.total_qty)} pcs expected</p>
                <p className="mt-1 text-xs text-ink-faint">{p.expected_date ? `Required by ${formatDate(p.expected_date)}` : `Raised ${formatDate(p.order_date)}`}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {pendingGrns.length === 0 && expectedPrs.length === 0 && (
        <Card className="p-2"><EmptyState icon="move_to_inbox" title="Nothing waiting to be received"
          hint="Pending inward requisitions and unposted GRNs appear here. Use Receive Now for a direct receipt." /></Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// The wizard itself: Arrival → Items → SAP → Review.
// ---------------------------------------------------------------------------
const STEPS = ['Arrival', 'Items & Scan', 'SAP Refs', 'Review & Post']

function Wizard({ clientId, grn, pr, suppliers, warehouses, locations, products, canPost, notify, onExit }: {
  clientId: string; grn?: Grn; pr?: PR
  suppliers: SupplierLite[]; warehouses: WarehouseLite[]; locations: LocationLite[]; products: ProductLite[]
  canPost: boolean; notify: Notify; onExit: () => void
}) {
  const profile = useAuth(s => s.profile)
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(!!grn)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState<SerialHistoryItem[] | null>(null)
  const [seeded, setSeeded] = useState<Record<string, { id: string; serial: string; status: string }[]>>({})
  const [h, setH] = useState({
    supplier_id: pr?.supplier_id ?? '', warehouse_id: pr?.warehouse_id ?? '', receipt_date: today(),
    reference_no: pr?.pr_no ?? '', sap_grn_ref: '', sap_miro_ref: '', remarks: '',
    gate_vehicle_no: '', gate_driver: '', gate_transporter: '', gate_in_at: ''
  })
  const [lines, setLines] = useState<WLine[]>([])
  const set = (patch: Partial<typeof h>) => setH(x => ({ ...x, ...patch }))
  const setLine = (i: number, patch: Partial<WLine>) => setLines(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l))

  // Resume an existing GRN or prefill from a PR.
  useEffect(() => {
    (async () => {
      if (grn) {
        const [{ data: items }, { data: serials }] = await Promise.all([
          supabase.from('goods_receipt_items').select('*').eq('grn_id', grn.id),
          supabase.from('serial_numbers').select('id,serial_no,product_id,status').eq('reference_no', grn.grn_no)
        ])
        setH(x => ({
          ...x, supplier_id: grn.supplier_id ?? '', warehouse_id: grn.warehouse_id ?? '',
          receipt_date: grn.receipt_date ?? today(), reference_no: grn.reference_no ?? '',
          sap_grn_ref: grn.sap_grn_ref ?? '', sap_miro_ref: grn.sap_miro_ref ?? '', remarks: grn.remarks ?? '',
          gate_vehicle_no: grn.gate_vehicle_no ?? '', gate_driver: grn.gate_driver ?? '',
          gate_transporter: grn.gate_transporter ?? '', gate_in_at: grn.gate_in_at ?? ''
        }))
        const sMap: Record<string, { id: string; serial: string; status: string }[]> = {}
        ;(serials ?? []).forEach(s => { if (s.product_id) (sMap[s.product_id] ??= []).push({ id: s.id, serial: s.serial_no, status: s.status }) })
        setSeeded(sMap)
        setLines((items ?? []).map(it => ({
          product_id: it.product_id ?? '', expected: Number(it.expected_qty) || 0,
          qty: String(Number(it.received_qty) > 0 ? it.received_qty : it.qty),
          stock_status: (it.stock_status || 'good') as WLine['stock_status'], location_id: it.location_id ?? '',
          serials: (sMap[it.product_id ?? ''] ?? []).map(s => ({ serial: s.serial, existingId: s.id, status: s.status }))
        })))
        setLoading(false)
      } else if (pr) {
        const { data: items } = await supabase.from('purchase_requisition_items').select('*').eq('pr_id', pr.id)
        setLines((items ?? []).map(it => ({
          product_id: it.product_id ?? '', expected: Number(it.qty) || 0, qty: String(it.qty ?? ''),
          stock_status: 'good', location_id: '', serials: []
        })))
      }
    })()
    // eslint-disable-next-line
  }, [])

  const prodById = useMemo(() => Object.fromEntries(products.map(p => [p.id, p])) as Record<string, ProductLite>, [products])
  const prodLabel = (id: string) => { const p = prodById[id]; return p ? `${p.material_code} — ${p.name}` : '' }
  const whLocs = locations.filter(l => l.warehouse_id === h.warehouse_id)
  const totalQty = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0)

  // ---- serial capture (per line, inline) ----------------------------------
  const allSerials = useMemo(() => {
    const set = new Set<string>()
    lines.forEach(l => l.serials.forEach(r => set.add(r.serial.toUpperCase())))
    return set
  }, [lines])

  const addSerials = (i: number, raws: string[]) => {
    const p: Partial<ProductLite> = prodById[lines[i].product_id] ?? {}
    let dupes = 0
    const fresh: SRow[] = []
    for (const raw of raws) {
      const r: SRow = normaliseSerial(raw, p)
      if (!r.serial) continue
      const up = r.serial.toUpperCase()
      if (allSerials.has(up) || fresh.some(f => f.serial.toUpperCase() === up)) { dupes++; continue }
      fresh.push(r)
    }
    if (fresh.length) setLine(i, { serials: [...fresh, ...lines[i].serials] })
    if (dupes) notify('info', `${dupes} duplicate serial(s) skipped`)
  }

  const removeSerial = (i: number, r: SRow) => {
    if (r.existingId && r.status && r.status !== 'in_stock') {
      notify('error', `${r.serial} is already ${r.status} — it can't be removed`); return
    }
    setLine(i, { serials: lines[i].serials.filter(x => x !== r) })
  }

  // ---- step gates ----------------------------------------------------------
  const next = () => {
    if (step === 0 && !h.warehouse_id) { notify('error', 'Warehouse select korun — stock ekhane dhukbe'); return }
    if (step === 1) {
      const valid = lines.filter(l => l.product_id)
      if (!valid.length) { notify('error', 'Onto ekta product line add korun'); return }
      if (valid.some(l => !(Number(l.qty) > 0))) { notify('error', 'Protita line-e Received Qty din (0 er beshi)'); return }
    }
    if (step === 2 && !String(h.sap_grn_ref).trim()) { notify('error', 'SAP MIGO No din — eta diyei GRN track hobe'); return }
    setStep(s => Math.min(s + 1, 3))
  }

  // ---- persist -------------------------------------------------------------
  const persist = async (postStock: boolean) => {
    setSaving(true)
    try {
      const migo = String(h.sap_grn_ref).trim()
      const valid = lines.filter(l => l.product_id && Number(l.qty) > 0)
      const status = postStock ? 'approved' : (h.sap_miro_ref?.trim() ? 'completed' : 'draft')
      const header: Omit<TablesInsert<'goods_receipts'>, 'grn_no'> = {
         supplier_id: h.supplier_id || null, warehouse_id: h.warehouse_id || null,
        reference_no: h.reference_no || null, receipt_date: h.receipt_date || today(),
        sap_grn_ref: migo, sap_miro_ref: h.sap_miro_ref?.trim() || null,
        gate_vehicle_no: h.gate_vehicle_no || null, gate_driver: h.gate_driver || null,
        gate_transporter: h.gate_transporter || null, gate_in_at: h.gate_in_at || null,
        billable: !!h.sap_miro_ref?.trim(), total_items: valid.length, total_qty: totalQty,
        status, remarks: h.remarks || null
      }
      let grnId = grn?.id
      let grnNo = grn?.grn_no ?? migo
      if (grn) {
        const { error } = await supabase.from('goods_receipts').update(header).eq('id', grn.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('goods_receipts').insert({ ...header, grn_no: migo }).select('id,grn_no').single()
        if (error) throw error
        grnId = data.id; grnNo = data.grn_no
      }
      if (!grnId) throw new Error('GRN id missing after save')
      await supabase.from('goods_receipt_items').delete().eq('grn_id', grnId)
      const payload = valid.map(l => ({
         grn_id: grnId, product_id: l.product_id, qty: Number(l.qty) || 0,
        expected_qty: l.expected || 0, received_qty: Number(l.qty) || 0,
        unit_price: 0, stock_status: l.stock_status, location_id: l.location_id || null
      }))
      if (payload.length) {
        const { error } = await supabase.from('goods_receipt_items').insert(payload)
        if (error) throw error
      }

      // -- serials: diff against seeded; prior-history serials are re-registered
      const toInsert: TablesInsert<'serial_numbers'>[] = []
      const keptIds = new Set<string>()
      for (const l of valid) {
        l.serials.forEach(r => { if (r.existingId) keptIds.add(r.existingId); else toInsert.push({
           product_id: l.product_id, serial_no: r.serial,
          reference_no: grnNo, warehouse_id: h.warehouse_id || null, status: 'in_stock'
        }) })
      }
      const toDelete = Object.values(seeded).flat().filter(s => !keptIds.has(s.id)).map(s => s.id)
      let reused: Pick<Tables<'serial_numbers'>, 'id' | 'serial_no' | 'reference_no' | 'status'>[] = []
      if (toInsert.length) {
        const { data: clash } = await supabase.from('serial_numbers').select('id,serial_no,reference_no,status')
          .in('serial_no', toInsert.map(r => r.serial_no))
        reused = (clash ?? []).filter(c => c.reference_no !== grnNo)
      }
      if (toDelete.length) {
        const { error } = await supabase.from('serial_numbers').delete().in('id', toDelete)
        if (error) throw error
      }
      let hist: SerialHistoryItem[] = []
      if (reused.length) {
        hist = await describeSerialHistory(clientId, reused)
        const { error } = await supabase.from('serial_numbers')
          .update({ reference_no: grnNo, warehouse_id: h.warehouse_id || null, status: 'in_stock', so_item_id: null })
          .in('id', reused.map(r => r.id))
        if (error) throw error
      }
      const reusedSet = new Set(reused.map(r => r.serial_no))
      const inserts = toInsert.filter(r => !reusedSet.has(r.serial_no))
      if (inserts.length) {
        const { error } = await supabase.from('serial_numbers').insert(inserts)
        if (error) throw error
      }

      // -- post to stock (same movement engine as the GRN register)
      if (postStock) {
        for (const l of valid) {
          const { error } = await supabase.rpc('post_stock_movement', {
             p_product: l.product_id, p_warehouse: h.warehouse_id!,
            p_location: l.location_id || undefined, p_stock_status: l.stock_status,
            p_qty_in: Number(l.qty), p_qty_out: 0, p_movement_type: 'GRN',
            p_reference_type: 'goods_receipt', p_reference_id: grnId, p_reference_no: grnNo,
            p_serial_no: undefined, p_remarks: `GRN ${grnNo}${migo ? ' · SAP ' + migo : ''} · received by ${profile?.full_name ?? ''}`
          })
          if (error) throw error
        }
        const { error } = await supabase.from('goods_receipts').update({ posted_at: new Date().toISOString(), status: 'approved', billable: true }).eq('id', grnId)
        if (error) throw error
        // Close the loop on the source PR.
        if (pr?.id) await supabase.from('purchase_requisitions').update({ status: 'received' }).eq('id', pr.id)
      }

      notify('success', postStock ? `${grnNo} received — stock posted to inventory` : `${grnNo} saved · ${status === 'completed' ? 'ready to post' : 'add SAP MIRO to complete'}`)
      if (hist.length) setHistory(hist)
      else onExit()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not save receipt')
    } finally { setSaving(false) }
  }

  if (loading) return <Spinner label="Loading receipt…" />

  const supItems = suppliers.map(s => ({ id: s.id, label: s.supplier_code, sublabel: s.name }))
  const whItems = warehouses.map(w => ({ id: w.id, label: w.code, sublabel: w.name }))
  const prodItems = products.map(p => ({ id: p.id, label: p.material_code, sublabel: p.name }))
  const locItems = whLocs.map(l => ({ id: l.id, label: l.location_code }))

  return (
    <div className="space-y-4">
      {/* Header: back + step indicator */}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onExit} className="flex items-center gap-1 text-sm text-ink-soft hover:text-brand-700">
          <Icon name="arrow_back" className="text-[18px]" /> Receiving queue
        </button>
        <div className="ml-auto flex items-center gap-1">
          {STEPS.map((s, i) => (
            <button key={s} type="button" onClick={() => i < step && setStep(i)}
              className={'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ' +
                (i === step ? 'bg-brand-500/15 text-brand-700' : i < step ? 'text-ok' : 'text-ink-faint')}>
              <span className={'flex h-5 w-5 items-center justify-center rounded-full text-[10px] ' +
                (i === step ? 'bg-brand-500 text-coal-900' : i < step ? 'bg-ok/15' : 'bg-surface-sunken')}>
                {i < step ? <Icon name="check" className="text-[12px]" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{s}</span>
            </button>
          ))}
        </div>
      </div>

      <Card className="p-5">
        {/* STEP 1 — Arrival */}
        {step === 0 && (
          <div className="space-y-4">
            {pr && <p className="rounded-lg bg-surface-sunken px-3 py-2 text-sm text-ink-soft">Receiving against <b className="font-mono text-ink">{pr.pr_no}</b> — lines are prefilled from the requisition.</p>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Supplier">
                <Combobox items={supItems} value={h.supplier_id} onChange={(id: string) => set({ supplier_id: id })} placeholder="Search supplier by code or name" />
              </Field>
              <Field label="Warehouse" required>
                <Combobox items={whItems} value={h.warehouse_id} onChange={(id: string) => set({ warehouse_id: id })} placeholder="Search warehouse" />
              </Field>
              <Field label="Receipt Date" required><Input type="date" value={h.receipt_date} onChange={e => set({ receipt_date: e.target.value })} /></Field>
              <Field label="Reference (requisition / other)"><Input value={h.reference_no} onChange={e => set({ reference_no: e.target.value })} placeholder="e.g. requisition number" /></Field>
            </div>
            <details className="rounded-lg border border-surface-line px-3 py-2" open={!!(h.gate_vehicle_no || h.gate_driver)}>
              <summary className="cursor-pointer select-none text-sm font-semibold text-ink">
                Gate Entry <span className="text-xs font-normal text-ink-faint">(optional — vehicle in)</span>
              </summary>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Vehicle No"><Input value={h.gate_vehicle_no} onChange={e => set({ gate_vehicle_no: e.target.value })} placeholder="e.g. DM TA 11-2345" /></Field>
                <Field label="Driver Name"><Input value={h.gate_driver} onChange={e => set({ gate_driver: e.target.value })} /></Field>
                <Field label="Transporter"><Input value={h.gate_transporter} onChange={e => set({ gate_transporter: e.target.value })} /></Field>
                <Field label="Gate-in Date/Time"><Input type="datetime-local" value={h.gate_in_at} onChange={e => set({ gate_in_at: e.target.value })} /></Field>
              </div>
            </details>
          </div>
        )}

        {/* STEP 2 — Items & scan */}
        {step === 1 && (
          <div className="space-y-3">
            <Field label="Add product">
              <Combobox items={prodItems} value=""
                onChange={(id: string) => {
                  if (!id) return
                  if (lines.some(l => l.product_id === id)) { notify('info', 'Product already on the receipt'); return }
                  setLines(ls => [{ product_id: id, expected: 0, qty: '', stock_status: 'good', location_id: '', serials: [], scanOpen: false }, ...ls])
                }}
                placeholder="Search by material code / name to add a line" />
            </Field>

            {lines.length === 0 && <p className="py-6 text-center text-sm text-ink-faint">No lines yet — search a product above to start counting.</p>}

            {lines.map((l, i) => {
              const qty = Number(l.qty) || 0
              const variance = l.expected > 0 ? qty - l.expected : 0
              return (
                <div key={l.product_id + i} className="rounded-xl border border-surface-line">
                  <div className="flex flex-wrap items-center gap-2 border-b border-surface-line bg-surface-sunken/60 px-3.5 py-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{prodLabel(l.product_id)}</p>
                    {l.expected > 0 && variance !== 0 && (
                      <Badge tone={variance < 0 ? 'critical' : 'info'}>{variance < 0 ? `Short ${-variance}` : `Excess +${variance}`}</Badge>
                    )}
                    <button type="button" onClick={() => setLines(ls => ls.filter((_, idx) => idx !== i))}
                      className="rounded p-1 text-ink-faint hover:bg-surface-sunken hover:text-bad"><Icon name="close" className="text-[16px]" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-4">
                    {l.expected > 0 && (
                      <div><p className="fiori-label">Expected</p><p className="fiori-input flex items-center bg-surface-sunken text-ink-soft">{formatNumber(l.expected)}</p></div>
                    )}
                    <Field label="Received Qty" required>
                      <Input type="number" min={0} value={l.qty} onChange={e => setLine(i, { qty: e.target.value })} placeholder="0" />
                    </Field>
                    <div className="col-span-2">
                      <p className="fiori-label">Condition</p>
                      <div className="flex flex-wrap gap-1.5">
                        {CONDITION_LIST.map(c => (
                          <button key={c.key} type="button" title={c.hint} onClick={() => setLine(i, { stock_status: c.key })}
                            className={'rounded-lg border px-2.5 py-1.5 text-xs font-semibold ' + (l.stock_status === c.key
                              ? (c.saleable ? 'border-ok/40 bg-ok/10 text-ok' : 'border-warn/40 bg-warn/10 text-warn')
                              : 'border-surface-line text-ink-faint hover:bg-surface-sunken')}>
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {locItems.length > 0 && (
                      <Field label="Location">
                        <Combobox items={locItems} value={l.location_id} onChange={(id: string) => setLine(i, { location_id: id })} placeholder="Bin / location" />
                      </Field>
                    )}
                  </div>
                  {/* Serial capture — optional, inline */}
                  <div className="border-t border-surface-line px-3 py-2">
                    <button type="button" onClick={() => setLine(i, { scanOpen: !l.scanOpen })}
                      className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-brand-700">
                      <Icon name={l.scanOpen ? 'expand_less' : 'qr_code_scanner'} className="text-[16px]" />
                      Serials {l.serials.length > 0 && <span className={'rounded px-1.5 py-0.5 tabular-nums ' + (l.serials.length >= qty && qty > 0 ? 'bg-ok/10 text-ok' : 'bg-surface-sunken text-ink-soft')}>{l.serials.length}/{qty || '—'}</span>}
                      <span className="font-normal text-ink-faint">(optional)</span>
                    </button>
                    {l.scanOpen && (
                      <div className="mt-2 space-y-2">
                        <input value={l.scanInput ?? ''} autoComplete="off" spellCheck={false}
                          onChange={e => setLine(i, { scanInput: e.target.value })}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const v = (l.scanInput ?? '').trim(); if (v) { addSerials(i, [v]); setLine(i, { scanInput: '' }) } } }}
                          onPaste={e => {
                            const t = e.clipboardData.getData('text')
                            if (!/[\r\n\t]/.test(t)) return
                            e.preventDefault()
                            addSerials(i, t.split(/[\r\n\t]+/).map(x => x.trim()).filter(Boolean))
                          }}
                          placeholder="Scan serial and press Enter — or paste a list from Excel"
                          className="fiori-input font-mono" />
                        {l.serials.length > 0 && (
                          <div className="max-h-40 overflow-y-auto rounded-lg border border-surface-line">
                            {l.serials.map((r, si) => (
                              <div key={r.serial} className={'flex items-center justify-between gap-2 px-3 py-1.5 text-sm ' + (si ? 'border-t border-surface-line/70' : '')}>
                                <span className="min-w-0 truncate font-mono text-ink">{r.serial}</span>
                                <span className="flex shrink-0 items-center gap-2 text-xs text-ink-faint">
                                  {r.original && <span title={`Scanned as ${r.original}`}>was {r.original}</span>}
                                  {r.existingId && <span>saved</span>}
                                  <button type="button" onClick={() => removeSerial(i, r)}
                                    className="rounded p-0.5 text-ink-faint hover:bg-surface-sunken hover:text-bad"><Icon name="close" className="text-[15px]" /></button>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {lines.length > 0 && (
              <p className="text-right text-sm text-ink-soft">Total receiving: <b className="text-ink">{formatNumber(totalQty)}</b> pcs · {lines.filter(l => l.product_id).length} line(s)</p>
            )}
          </div>
        )}

        {/* STEP 3 — SAP refs */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">SAP trail for this receipt — the MIGO number <b className="text-ink">is</b> the GRN identity.</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="SAP MIGO No" required>
                <Input value={h.sap_grn_ref} disabled={!!grn}
                  onChange={e => set({ sap_grn_ref: e.target.value })} placeholder="e.g. 500012345" className="font-mono" />
              </Field>
              <Field label="SAP MIRO No">
                <Input value={h.sap_miro_ref} onChange={e => set({ sap_miro_ref: e.target.value })} placeholder="Adding this marks it Complete & billable" className="font-mono" />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-sunken px-3 py-2.5">
              <SapChip done={!!String(h.sap_grn_ref).trim()} label="MIGO — goods receipt" />
              <Icon name="arrow_forward" className="text-[14px] text-ink-faint" />
              <SapChip done={!!String(h.sap_miro_ref).trim()} label="MIRO — invoice verified" />
              <Icon name="arrow_forward" className="text-[14px] text-ink-faint" />
              <SapChip done={false} label="Stock posted" />
              <span className="w-full text-xs text-ink-faint sm:w-auto sm:ml-auto">{String(h.sap_miro_ref).trim() ? 'Ready to post to stock in the next step' : 'MIRO can be added later from the queue'}</span>
            </div>
          </div>
        )}

        {/* STEP 4 — Review */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-surface-line bg-surface-sunken/40 p-4 text-sm sm:grid-cols-4">
              <div><p className="text-[11px] uppercase tracking-wide text-ink-faint">Supplier</p><p className="font-medium text-ink">{suppliers.find(s => s.id === h.supplier_id)?.name ?? '—'}</p></div>
              <div><p className="text-[11px] uppercase tracking-wide text-ink-faint">Warehouse</p><p className="font-medium text-ink">{warehouses.find(w => w.id === h.warehouse_id)?.code ?? '—'}</p></div>
              <div><p className="text-[11px] uppercase tracking-wide text-ink-faint">MIGO</p><p className="font-mono font-medium text-ink">{h.sap_grn_ref || '—'}</p></div>
              <div><p className="text-[11px] uppercase tracking-wide text-ink-faint">MIRO</p><p className="font-mono font-medium text-ink">{h.sap_miro_ref || <span className="text-ink-faint">pending</span>}</p></div>
            </div>
            <div className="overflow-hidden rounded-xl border border-surface-line">
              {lines.filter(l => l.product_id).map((l, i) => (
                <div key={l.product_id} className={'flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                  <span className="min-w-0 truncate text-ink">{prodLabel(l.product_id)}
                    {l.stock_status !== 'good' && <Badge tone={l.stock_status === 'damaged' ? 'negative' : 'critical'}>{conditionLabel(l.stock_status)}</Badge>}
                    {l.serials.length > 0 && <span className="ml-2 text-xs text-ink-faint">{l.serials.length} serial(s)</span>}
                  </span>
                  <span className="shrink-0 font-semibold text-ink">{formatNumber(Number(l.qty) || 0)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-surface-line bg-surface-sunken/60 px-3.5 py-2.5 text-sm font-semibold">
                <span>Total</span><span>{formatNumber(totalQty)} pcs</span>
              </div>
            </div>
            <Field label="Remarks"><Textarea value={h.remarks} onChange={e => set({ remarks: e.target.value })} /></Field>
            {!String(h.sap_miro_ref).trim() && (
              <p className="rounded-lg bg-surface-sunken px-3 py-2 text-xs text-ink-soft">
                No MIRO yet — you can <b>Save</b> now and post to stock later from the receiving queue once the MIRO number arrives.
              </p>
            )}
          </div>
        )}

        {/* Footer nav */}
        <div className="mt-5 flex items-center justify-between gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={() => step === 0 ? onExit() : setStep(s => s - 1)}>{step === 0 ? 'Cancel' : 'Back'}</Button>
          <div className="flex gap-2">
            {step < 3 && <Button icon="arrow_forward" onClick={next}>Next</Button>}
            {step === 3 && <Button variant="secondary" icon="save" loading={saving} onClick={() => persist(false)}>Save</Button>}
            {step === 3 && canPost && !!String(h.sap_miro_ref).trim() && (
              <Button icon="check_circle" loading={saving} onClick={() => persist(true)}>Save & Post to Stock</Button>
            )}
          </div>
        </div>
      </Card>

      {history && <SerialHistoryModal items={history} onClose={() => { setHistory(null); onExit() }} />}
    </div>
  )
}

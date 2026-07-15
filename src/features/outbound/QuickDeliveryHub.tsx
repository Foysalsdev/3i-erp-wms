import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { cn, formatNumber, formatDate, formatVehicleNo } from '@/lib/utils'
import { CONDITION_OPTIONS, STOCK_CONDITIONS } from '@/lib/conditions'
import { DEFAULT_CHALLAN_NOTE } from '@/lib/constants'
import { nextChallanNumber } from '@/hooks/useDocNumber'
import { loadSoInvoices } from './soInvoices'
import { downloadChallanPdfFor } from './challanPdf'
import { primeCompanyInfo } from '@/lib/settings'
import type { Tables } from '@/types/database.types'

// ---------------------------------------------------------------------------
// Quick Delivery Hub — a full-screen warehouse dispatch console that opens on
// top of the ERP (no sidebar/topbar/footer). One SAP invoice → one delivery
// challan, driven from a single keyboard-first workspace: search the invoice,
// verify delivery info (auto-suggested from recent challans), tweak delivered
// quantities in a virtualized item grid, then generate the challan. It reuses
// the exact same persistence pipeline as the classic Delivery Challan form
// (nextChallanNumber, delivery_challans + _items, post_delivery_challan RPC,
// downloadChallanPdfFor) so both surfaces produce identical documents.
// ---------------------------------------------------------------------------

type Notify = (kind: 'success' | 'error' | 'info', msg: string) => void
const today = () => new Date().toISOString().slice(0, 10)

type ProductLite = Pick<Tables<'products'>, 'id' | 'material_code' | 'name' | 'category' | 'uom'>
type VehicleLite = Pick<Tables<'vehicles'>, 'id' | 'vehicle_number' | 'vehicle_type' | 'vendor_id' | 'driver_name' | 'driver_phone'>
type VendorLite = Pick<Tables<'transport_vendors'>, 'id' | 'vendor_code' | 'name'>
type DriverLite = Pick<Tables<'drivers'>, 'id' | 'name' | 'phone'>
type CourierLite = Pick<Tables<'couriers'>, 'id' | 'courier_code' | 'name'>
type LocationLite = Pick<Tables<'locations'>, 'id' | 'location_code'>
type RecentChallan = Pick<Tables<'delivery_challans'>,
  'id' | 'challan_no' | 'invoice_no' | 'created_at' | 'delivery_method' | 'vehicle_id' | 'transporter_id'
  | 'transport_vendor' | 'driver_name' | 'driver_phone' | 'courier_id' | 'courier_name'
  | 'ship_to_address' | 'receiver_name' | 'receiver_phone' | 'print_note'>

// The customer + order context resolved from a picked invoice.
interface InvoiceCtx {
  invoiceId: string; invoiceNo: string; invoiceDate: string
  soId: string; soNo: string; poNo: string; orderDate: string
  customerId: string; customerCode: string; customerName: string
  customerShipping: string; warehouseId: string | null
}
// One editable dispatch row, seeded from an invoice line.
interface HubLine {
  soItemId: string; productId: string; code: string; name: string; uom: string
  invoicedQty: number      // qty on the invoice line
  alreadyDelivered: number // delivered on prior issued challans
  remaining: number        // cap for THIS challan (qty − delivered − planned)
  deliveredQty: number     // editable — what leaves on this dispatch
  unitPrice: number        // carried from the SO line (for line valuation)
  condition: string; locationId: string; remarks: string
}
// Editable delivery header the operator confirms before generating.
interface DeliveryInfo {
  shipToAddress: string; receiverName: string; receiverPhone: string
  deliveryMethod: 'transport' | 'courier'
  transporterId: string; transportVendor: string
  vehicleId: string; driverId: string; driverName: string; driverPhone: string
  courierId: string; courierName: string
  deliveryNote: string
}
const emptyDelivery = (): DeliveryInfo => ({
  shipToAddress: '', receiverName: '', receiverPhone: '', deliveryMethod: 'transport',
  transporterId: '', transportVendor: '', vehicleId: '', driverId: '', driverName: '',
  driverPhone: '', courierId: '', courierName: '', deliveryNote: ''
})

export default function QuickDeliveryHub() {
  const nav = useNavigate()
  const { currentClientId, can, isPlatformAdmin, profile } = useAuth()
  const notify = useUI(s => s.notify) as Notify
  // Same permission gates as the classic Delivery Challan surface: creating a
  // challan needs create/edit, dispatching (stock + gate pass) needs approve/post.
  const canCreate = can('outbound.create') || can('outbound.edit') || isPlatformAdmin
  const canPost = can('outbound.approve') || can('outbound.post') || isPlatformAdmin

  // Masters — loaded once, shared by every dispatch in the session.
  const [products, setProducts] = useState<ProductLite[]>([])
  const [vehicles, setVehicles] = useState<VehicleLite[]>([])
  const [vendors, setVendors] = useState<VendorLite[]>([])
  const [drivers, setDrivers] = useState<DriverLite[]>([])
  const [couriers, setCouriers] = useState<CourierLite[]>([])
  const [locations, setLocations] = useState<LocationLite[]>([])
  const [recent, setRecent] = useState<RecentChallan[]>([])

  // Current dispatch state.
  const [ctx, setCtx] = useState<InvoiceCtx | null>(null)
  // Challans that ALREADY exist for the picked invoice — the basis for
  // duplicate detection (shown as a banner, re-checked at generate time).
  const [existing, setExisting] = useState<{ challan_no: string; status: string; posted_at: string | null }[]>([])
  // Ship-To addresses already on the customer master — used to decide whether a
  // typed address is new (and worth saving back as a side-delivery address).
  const [custAddrs, setCustAddrs] = useState<string[]>([])
  const [lines, setLines] = useState<HubLine[]>([])
  const [del, setDel] = useState<DeliveryInfo>(emptyDelivery())
  const [printNote, setPrintNote] = useState(DEFAULT_CHALLAN_NOTE)
  const [loadingInv, setLoadingInv] = useState(false)
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState<Tables<'delivery_challans'> | null>(null)
  // The guided delivery-info popup (asks each field one at a time).
  const [guideOpen, setGuideOpen] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)
  const patchDel = (p: Partial<DeliveryInfo>) => setDel(x => ({ ...x, ...p }))

  useEffect(() => { primeCompanyInfo(currentClientId ?? null) }, [currentClientId])

  // Load masters + the recent-challan history that powers the smart panel.
  useEffect(() => {
    if (!currentClientId) return
    supabase.from('products').select('id,material_code,name,category,uom').then(({ data }) => setProducts(data ?? []))
    supabase.from('vehicles').select('id,vehicle_number,vehicle_type,vendor_id,driver_name,driver_phone').then(({ data }) => setVehicles(data ?? []))
    supabase.from('transport_vendors').select('id,vendor_code,name').eq('status', 'active').then(({ data }) => setVendors(data ?? []))
    supabase.from('drivers').select('id,name,phone').order('name').then(({ data }) => setDrivers(data ?? []))
    supabase.from('couriers').select('id,courier_code,name').eq('status', 'active').then(({ data }) => setCouriers(data ?? []))
    supabase.from('delivery_challans')
      .select('id,challan_no,invoice_no,created_at,delivery_method,vehicle_id,transporter_id,transport_vendor,driver_name,driver_phone,courier_id,courier_name,ship_to_address,receiver_name,receiver_phone,print_note')
      .neq('status', 'cancelled').order('created_at', { ascending: false }).limit(25)
      .then(({ data }) => setRecent(data ?? []))
  }, [currentClientId])

  // Locations for the picked invoice's warehouse (for the per-line Location col).
  useEffect(() => {
    if (!ctx?.warehouseId) { setLocations([]); return }
    supabase.from('locations').select('id,location_code').eq('warehouse_id', ctx.warehouseId).then(({ data }) => setLocations(data ?? []))
  }, [ctx?.warehouseId])

  // Cursor lands on the invoice search whenever a fresh dispatch starts.
  useEffect(() => { if (!ctx) searchRef.current?.focus() }, [ctx])

  const dirty = !!ctx && !created
  // Warn before a browser-level navigation drops an in-progress dispatch.
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const reset = useCallback(() => {
    setCtx(null); setLines([]); setDel(emptyDelivery()); setPrintNote(DEFAULT_CHALLAN_NOTE)
    setCreated(null); setLoadingInv(false); setGuideOpen(false); setExisting([]); setCustAddrs([])
    setTimeout(() => searchRef.current?.focus(), 0)
  }, [])

  const exit = useCallback(() => {
    if (dirty && !window.confirm('Leave Quick Delivery Hub? The current dispatch is not saved.')) return
    nav('/outbound/delivery-challan')
  }, [dirty, nav])

  // Esc leaves the hub; "/" (outside a field) jumps to the invoice search.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName)
      if (e.key === 'Escape' && !typing) { exit() }
      if (e.key === '/' && !typing) { e.preventDefault(); searchRef.current?.focus() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [exit])

  const pmap = useMemo(() => Object.fromEntries(products.map(p => [p.id, p])), [products])

  // Load an invoice's lines + customer/order context and seed the grid.
  const selectInvoice = async (row: InvoiceSuggestion) => {
    setLoadingInv(true); setCreated(null)
    try {
      const { items, invoices, challans } = await loadSoInvoices(row.soId)
      const inv = invoices.find(i => i.id === row.invoiceId)
      if (!inv) { notify('error', 'Invoice has no lines to deliver'); setLoadingInv(false); return }
      // Challans already raised against THIS invoice — surfaced as a duplicate
      // warning so the operator knows a delivery for it may already exist.
      setExisting((challans ?? []).filter((c: any) => c.invoice_id === inv.id)
        .map((c: any) => ({ challan_no: c.challan_no, status: c.status, posted_at: c.posted_at })))
      const seeded: HubLine[] = inv.lines.map(l => {
        const it = items.find((x: any) => x.id === l.so_item_id)
        const p = pmap[l.product_id]
        const remaining = Math.max(0, l.qty - l.delivered - l.planned)
        return {
          soItemId: l.so_item_id, productId: l.product_id,
          code: p?.material_code ?? '—', name: p?.name ?? it?.description ?? l.product_id,
          uom: p?.uom ?? 'Pc', invoicedQty: l.qty, alreadyDelivered: l.delivered, remaining,
          deliveredQty: remaining, unitPrice: Number(it?.unit_price) || 0,
          condition: 'good', locationId: '', remarks: ''
        }
      })
      setCtx({
        invoiceId: inv.id, invoiceNo: inv.invoice_no, invoiceDate: inv.invoice_date,
        soId: row.soId, soNo: row.soNo, poNo: row.poNo, orderDate: row.orderDate,
        customerId: row.customerId, customerCode: row.customerCode, customerName: row.customerName,
        customerShipping: row.customerShipping, warehouseId: row.warehouseId
      })
      setLines(seeded)
      // Ship-To auto-fills from the customer's default address; the operator can
      // change it, and a changed one is saved back to the master (see generate).
      setDel(d => ({ ...d, shipToAddress: row.customerShipping || d.shipToAddress }))
      supabase.from('customer_addresses').select('address').eq('customer_id', row.customerId)
        .then(({ data }) => setCustAddrs((data ?? []).map(a => a.address)))
      setPrintNote(DEFAULT_CHALLAN_NOTE)
      // Delivery info fills straight in the right panel now; the guided popup
      // stays available on demand (its button) rather than auto-opening over it.
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not load invoice')
    } finally {
      setLoadingInv(false)
    }
  }

  // --- per-line editing -----------------------------------------------------
  const qtyRefs = useRef<(HTMLInputElement | null)[]>([])
  const lastQtyIdx = useRef<number | null>(null)
  const [recentQtys, setRecentQtys] = useState<number[]>([])
  const rememberQty = (n: number) => {
    if (!(n > 0)) return
    setRecentQtys(prev => [n, ...prev.filter(x => x !== n)].slice(0, 5))
  }
  const patchLine = (i: number, p: Partial<HubLine>) =>
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, ...p } : l))

  // Arrow/Enter move the cursor down the quantity column for scanner-speed entry.
  const onQtyKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); qtyRefs.current[i + 1]?.focus() }
    if (e.key === 'ArrowUp') { e.preventDefault(); qtyRefs.current[i - 1]?.focus() }
  }

  // --- live footer statistics ----------------------------------------------
  const stats = useMemo(() => {
    const invoiceQty = lines.reduce((s, l) => s + l.invoicedQty, 0)
    const alreadyDelivered = lines.reduce((s, l) => s + l.alreadyDelivered, 0)
    const deliveredQty = lines.reduce((s, l) => s + (Number(l.deliveredQty) || 0), 0)
    const pending = Math.max(0, invoiceQty - alreadyDelivered - deliveredQty)
    const totalItems = lines.length
    const completedItems = lines.filter(l => (l.alreadyDelivered + (Number(l.deliveredQty) || 0)) >= l.invoicedQty && l.invoicedQty > 0).length
    const pct = totalItems ? Math.round((completedItems / totalItems) * 100) : 0
    return { invoiceQty, alreadyDelivered, deliveredQty, pending, totalItems, completedItems, remaining: totalItems - completedItems, pct }
  }, [lines])

  // --- generate the challan -------------------------------------------------
  const generate = async () => {
    if (!ctx || !currentClientId) return
    if (!canCreate) { notify('error', 'You do not have permission to create delivery challans'); return }
    const active = lines.filter(l => Number(l.deliveredQty) > 0)
    if (!ctx.warehouseId) { notify('error', 'This order has no warehouse set — cannot deduct stock'); return }
    if (active.length === 0) { notify('error', 'Enter a delivered quantity on at least one item'); return }
    const over = active.find(l => Number(l.deliveredQty) > l.remaining)
    if (over) { notify('error', `Only ${over.remaining} remaining to deliver for ${over.code}`); return }
    // Duplicate guard: make the operator consciously acknowledge that this
    // invoice already carries challan(s) before adding another.
    if (existing.length > 0 &&
      !window.confirm(`This invoice already has ${existing.length} challan(s): ${existing.map(e => e.challan_no).join(', ')}.\nCreate another for the remaining quantity?`)) return
    setSaving(true)
    try {
      // Re-read the invoice's live figures right before inserting, so a challan
      // another operator raised in the meantime can't be duplicated: every line
      // is re-validated against the freshly-computed remaining.
      const { invoices: fresh } = await loadSoInvoices(ctx.soId)
      const finv = fresh.find(i => i.id === ctx.invoiceId)
      for (const l of active) {
        const fl = finv?.lines.find((x: any) => x.so_item_id === l.soItemId)
        const rem = fl ? Math.max(0, fl.qty - fl.delivered - fl.planned) : 0
        if (Number(l.deliveredQty) > rem) {
          setSaving(false)
          notify('error', `${l.code}: only ${rem} left to deliver now — another challan for this invoice was just created. Reload the invoice.`)
          return
        }
      }
      const mode = del.deliveryMethod
      const totalQty = active.reduce((s, l) => s + Number(l.deliveredQty), 0)
      const header = {
        sales_order_id: ctx.soId, invoice_id: ctx.invoiceId, invoice_no: ctx.invoiceNo,
        customer_id: ctx.customerId, warehouse_id: ctx.warehouseId, po_no: ctx.poNo || null,
        challan_date: today(), total_qty: totalQty, status: 'draft', delivery_method: mode,
        vehicle_id: mode === 'transport' ? (del.vehicleId || null) : null,
        driver_id: mode === 'transport' ? (del.driverId || null) : null,
        driver_name: mode === 'transport' ? (del.driverName || null) : null,
        driver_phone: mode === 'transport' ? (del.driverPhone || null) : null,
        transporter_id: mode === 'transport' ? (del.transporterId || null) : null,
        transport_vendor: mode === 'transport' ? (del.transportVendor || null) : null,
        courier_id: mode === 'courier' ? (del.courierId || null) : null,
        courier_name: mode === 'courier' ? (del.courierName || null) : null,
        receiver_name: del.receiverName || null, receiver_phone: del.receiverPhone || null,
        ship_to_address: del.shipToAddress || null, remarks: del.deliveryNote || null,
        prepared_by: profile?.full_name || null, print_note: printNote || null
      }
      const challan_no = await nextChallanNumber(currentClientId, ctx.invoiceNo)
      if (!challan_no) throw new Error('Could not generate challan number')
      const { data: ch, error } = await supabase.from('delivery_challans').insert({ ...header, challan_no }).select('*').single()
      if (error) throw error
      const payload = active.map(l => ({
        challan_id: ch.id, product_id: l.productId, qty: Number(l.deliveredQty),
        unit_price: l.unitPrice || 0, stock_status: l.condition || 'good',
        location_id: l.locationId || null, so_item_id: l.soItemId, remarks: l.remarks || null
      }))
      const { error: liErr } = await supabase.from('delivery_challan_items').insert(payload)
      if (liErr) throw liErr
      // Remember the vehicle ↔ vendor/driver combo for the next dispatch.
      if (mode === 'transport' && del.vehicleId) {
        supabase.from('vehicles').update({
          driver_name: del.driverName || null, driver_phone: del.driverPhone || null, vendor_id: del.transporterId || null
        }).eq('id', del.vehicleId).then(() => {})
      }
      // If the operator changed the Ship-To to an address the customer master
      // doesn't have yet, save it back as a side-delivery address so it's
      // available next time (fire-and-forget — never blocks the challan).
      const shipAddr = (del.shipToAddress || '').trim()
      if (shipAddr) {
        const known = new Set([ctx.customerShipping, ...custAddrs].map(a => (a || '').trim().toLowerCase()).filter(Boolean))
        if (!known.has(shipAddr.toLowerCase())) {
          supabase.from('customer_addresses')
            .insert({ customer_id: ctx.customerId, address: shipAddr, address_type: 'Shipping', is_default: false, label: 'Side Delivery' })
            .then(({ error }) => { if (!error) setCustAddrs(a => [...a, shipAddr]) })
        }
      }
      setCreated(ch)
      notify('success', `Challan ${ch.challan_no} generated`)
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not generate challan')
    } finally {
      setSaving(false)
    }
  }

  const printCreated = async () => {
    if (!created || !ctx) return
    try {
      await downloadChallanPdfFor(created, {
        customers: [{ id: ctx.customerId, customer_code: ctx.customerCode, name: ctx.customerName }],
        vehicles, products
      })
    } catch (e: any) { notify('error', e?.message ?? 'Could not generate PDF') }
  }

  const confirmDispatch = async () => {
    if (!created) return
    setSaving(true)
    try {
      const { data: gpNo, error } = await supabase.rpc('post_delivery_challan', { p_challan_id: created.id })
      if (error) throw error
      setCreated({ ...created, posted_at: new Date().toISOString() })
      notify('success', `${created.challan_no} dispatched — stock deducted${gpNo ? ' · gate pass ' + gpNo : ''}`)
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not confirm dispatch')
    } finally { setSaving(false) }
  }

  const scrollRef = useRef<HTMLDivElement>(null)
  const rowVirt = useVirtualizer({
    count: lines.length, getScrollElement: () => scrollRef.current,
    estimateSize: () => 48, overscan: 14
  })

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface text-ink">
      <Header
        ctx={ctx} onExit={exit}
        searchRef={searchRef} onSelectInvoice={selectInvoice} loadingInv={loadingInv}
        currentClientId={currentClientId} disabled={!!created}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Center workspace — the item grid frame is always present; only the
            rows fill once an invoice is loaded. */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-surface-line px-4 py-2.5">
            <h2 className="text-sm font-semibold">Items to dispatch</h2>
            <span className="text-xs text-ink-soft">{ctx ? `${lines.length} lines · Invoice ${ctx.invoiceNo}` : 'No invoice loaded'}</span>
            <div className="ml-auto flex items-center gap-2">
              {/* Reachable delivery-info opener for narrow screens where the right
                  panel (which also holds it) is hidden. */}
              {ctx && !created && (
                <button onClick={() => setGuideOpen(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-brand-500 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-100 md:hidden">
                  <Icon name="local_shipping" className="text-[14px]" /> Delivery info
                </button>
              )}
              {ctx && !created && recentQtys.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-ink-soft">Recent qty</span>
                  {recentQtys.map(n => (
                    <button key={n} type="button" onClick={() => {
                      const i = lastQtyIdx.current
                      if (i != null && lines[i]) patchLine(i, { deliveredQty: Math.min(n, lines[i].remaining) })
                    }} className="rounded-md bg-surface-sunken px-2 py-0.5 text-xs font-semibold tabular-nums hover:bg-brand-100">
                      {n}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {ctx && existing.length > 0 && (
            <div className={cn('flex items-start gap-2 border-b px-4 py-2 text-xs',
              lines.every(l => l.remaining <= 0) ? 'border-bad/30 bg-bad/5 text-bad' : 'border-warn/30 bg-warn/10 text-warn')}>
              <Icon name="warning" className="mt-px text-[16px]" filled />
              <span>
                <b>Possible duplicate — </b>
                this invoice already has {existing.length} challan(s): {existing.map(e => e.challan_no).join(', ')}.
                {lines.every(l => l.remaining <= 0)
                  ? ' Everything on it is already delivered or planned — nothing left to dispatch.'
                  : ' Only the still-remaining quantity is pre-filled below.'}
              </span>
            </div>
          )}

          {/* Both axes scroll: the header row + rows share one min-width track so
              columns never crush when the right panel steals horizontal room. */}
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
            <div className="min-w-[760px]">
              <ItemHeaderRow />
              {lines.length === 0 ? (
                <div className="flex items-center justify-center p-10 text-center">
                  <p className="text-sm text-ink-soft">Enter an invoice number above to load its items.</p>
                </div>
              ) : (
                <div style={{ height: rowVirt.getTotalSize(), position: 'relative' }}>
                  {rowVirt.getVirtualItems().map(v => {
                    const i = v.index; const l = lines[i]
                    return (
                      <div key={l.soItemId} data-index={i} ref={rowVirt.measureElement}
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${v.start}px)` }}>
                        <ItemRow
                          i={i} l={l} locations={locations} disabled={!!created}
                          qtyRef={el => { qtyRefs.current[i] = el }}
                          onQtyKey={e => onQtyKey(e, i)}
                          onFocusQty={() => { lastQtyIdx.current = i }}
                          onQty={val => patchLine(i, { deliveredQty: val })}
                          onCommitQty={val => rememberQty(val)}
                          onCondition={c => patchLine(i, { condition: c })}
                          onLocation={loc => patchLine(i, { locationId: loc })}
                          onRemarks={r => patchLine(i, { remarks: r })}
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Right panel — the live, editable delivery-info form (fills as you go),
            plus one-click reuse of recent dispatch info. */}
        <SmartPanel
          recent={recent} vehicles={vehicles} vendors={vendors} drivers={drivers} couriers={couriers}
          disabled={!!created} del={del} ctx={ctx} patchDel={patchDel} onEditInfo={() => setGuideOpen(true)}
          onApplyVehicle={id => applyVehicle(id, vehicles, vendors, patchDel)}
          onApplyDriver={(name, phone) => patchDel({ driverName: name, driverPhone: phone || '', driverId: '' })}
          onApplyVendor={(id, name) => patchDel({ transporterId: id || '', transportVendor: name })}
          onApplyAddress={a => patchDel({ shipToAddress: a })}
          onApplyReceiver={(name, phone) => patchDel({ receiverName: name, receiverPhone: phone || '' })}
          onApplyNote={n => setPrintNote(n)}
        />
      </div>

      <FooterBar
        stats={stats} ctx={ctx} created={created} saving={saving} canPost={canPost} canCreate={canCreate}
        onGenerate={generate} onPrint={printCreated} onConfirm={confirmDispatch} onNew={reset}
      />

      {guideOpen && ctx && !created && (
        <GuidedDeliveryModal del={del} patchDel={patchDel}
          vehicles={vehicles} vendors={vendors} drivers={drivers} couriers={couriers}
          onClose={() => setGuideOpen(false)} />
      )}
    </div>
  )
}

// ===========================================================================
// Header — exit + invoice search + resolved identity + editable delivery info
// ===========================================================================
interface InvoiceSuggestion {
  invoiceId: string; invoiceNo: string; invoiceDate: string
  soId: string; soNo: string; poNo: string; orderDate: string
  customerId: string; customerCode: string; customerName: string
  customerShipping: string; warehouseId: string | null
}

function Header({ ctx, onExit, searchRef, onSelectInvoice, loadingInv, currentClientId, disabled }: {
  ctx: InvoiceCtx | null; onExit: () => void
  searchRef: React.RefObject<HTMLInputElement>; onSelectInvoice: (s: InvoiceSuggestion) => void; loadingInv: boolean
  currentClientId: string | null; disabled: boolean
}) {
  const [q, setQ] = useState('')
  const [sugs, setSugs] = useState<InvoiceSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)

  // Debounced invoice lookup. Kept as separate queries (so_invoices →
  // sales_orders → customers) instead of a nested embed — the same resilient
  // pattern loadSoInvoices uses — so a relationship/RLS quirk can never make
  // the whole lookup silently return nothing.
  useEffect(() => {
    const term = q.trim()
    if (!currentClientId || term.length < 2) { setSugs([]); setOpen(false); return }
    let active = true
    const t = setTimeout(async () => {
      const { data: invs } = await supabase.from('so_invoices')
        .select('id,invoice_no,invoice_date,so_id')
        .ilike('invoice_no', `%${term}%`).order('invoice_date', { ascending: false }).limit(8)
      if (!active) return
      const list = invs ?? []
      if (!list.length) { setSugs([]); setHi(0); setOpen(true); return }
      const soIds = [...new Set(list.map(i => i.so_id))]
      const { data: sos } = await supabase.from('sales_orders')
        .select('id,so_no,reference_no,order_date,customer_id,warehouse_id').in('id', soIds)
      if (!active) return
      const soById = new Map((sos ?? []).map(s => [s.id, s]))
      const custIds = [...new Set((sos ?? []).map(s => s.customer_id).filter(Boolean) as string[])]
      const { data: custs } = custIds.length
        ? await supabase.from('customers').select('id,customer_code,name,shipping_address').in('id', custIds)
        : { data: [] as any[] }
      if (!active) return
      const cById = new Map((custs ?? []).map(c => [c.id, c]))
      const rows: InvoiceSuggestion[] = list.map(r => {
        const so: any = soById.get(r.so_id) ?? {}
        const c: any = so.customer_id ? cById.get(so.customer_id) ?? {} : {}
        return {
          invoiceId: r.id, invoiceNo: r.invoice_no, invoiceDate: r.invoice_date,
          soId: r.so_id, soNo: so.so_no ?? '', poNo: so.reference_no ?? '', orderDate: so.order_date ?? '',
          customerId: c.id ?? so.customer_id ?? '', customerCode: c.customer_code ?? '', customerName: c.name ?? '',
          customerShipping: c.shipping_address ?? '', warehouseId: so.warehouse_id ?? null
        }
      })
      setSugs(rows); setHi(0); setOpen(true)
    }, 220)
    return () => { active = false; clearTimeout(t) }
  }, [q, currentClientId])

  const pick = (s: InvoiceSuggestion) => { setQ(''); setSugs([]); setOpen(false); onSelectInvoice(s) }
  const onKey = (e: React.KeyboardEvent) => {
    if (!open || !sugs.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, sugs.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)) }
    if (e.key === 'Enter') { e.preventDefault(); pick(sugs[hi]) }
    if (e.key === 'Escape') { setOpen(false) }
  }

  return (
    <header className="shrink-0 border-b border-surface-line bg-surface">
      <div className="flex items-center gap-2.5 px-4 py-2">
        <button onClick={onExit} title="Exit (Esc)"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:bg-surface-sunken">
          <Icon name="arrow_back" className="text-[20px]" />
        </button>
        <div className="leading-tight">
          <p className="text-[13px] font-bold tracking-tight">Quick Delivery Hub</p>
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-soft">Warehouse Dispatch</p>
        </div>
      </div>

      {/* One compact identity row: the invoice number is an input here (empty),
          or the resolved value once picked, sitting inline with the customer /
          PO / date facts it fills. No oversized search box. */}
      <div className="grid grid-cols-2 items-start gap-x-6 gap-y-2 border-t border-surface-line bg-surface-sunken/40 px-4 py-2 sm:grid-cols-3 lg:grid-cols-5">
        <div className="relative min-w-0">
          <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-ink-soft">Invoice No</label>
          {!ctx ? (
            <>
              <input
                ref={searchRef} value={q} disabled={disabled}
                onChange={e => setQ(e.target.value)} onKeyDown={onKey}
                onFocus={() => { if (sugs.length) setOpen(true) }}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                placeholder="Type invoice…  ( / )"
                className="h-8 w-full rounded-lg border border-brand-500 bg-surface px-2.5 text-sm font-semibold outline-none placeholder:font-normal placeholder:text-ink/35 focus:ring-2 focus:ring-brand-500/25 disabled:bg-surface-sunken disabled:text-ink-faint"
              />
              {loadingInv && <span className="absolute right-2 top-[26px] text-[11px] text-ink-soft">…</span>}
              {open && sugs.length === 0 && q.trim().length >= 2 && (
                <div className="absolute left-0 top-[calc(100%+4px)] z-30 min-w-[280px] rounded-lg border border-surface-line bg-surface px-3 py-2 text-xs text-ink-soft shadow-pop">
                  No invoice found for “{q.trim()}”.
                </div>
              )}
              {open && sugs.length > 0 && (
                <ul className="absolute left-0 top-[calc(100%+4px)] z-30 max-h-80 min-w-[300px] overflow-y-auto rounded-lg border border-surface-line bg-surface p-1 shadow-pop">
                  {sugs.map((s, i) => (
                    <li key={s.invoiceId}>
                      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => pick(s)}
                        className={cn('flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left', i === hi ? 'bg-brand-100' : 'hover:bg-surface-sunken')}>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{s.invoiceNo}</span>
                          <span className="block truncate text-xs text-ink-soft">{s.customerCode ? s.customerCode + ' · ' : ''}{s.customerName || 'Unknown customer'}</span>
                        </span>
                        <span className="shrink-0 text-xs text-ink-soft tabular-nums">{formatDate(s.invoiceDate)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="truncate text-sm font-bold" title={ctx.invoiceNo}>{ctx.invoiceNo}</p>
          )}
        </div>
        <Fact label="Customer Code" value={ctx?.customerCode || '—'} />
        <Fact label="Customer Name" value={ctx?.customerName || '—'} />
        <Fact label="PO Number" value={ctx?.poNo || '—'} />
        <Fact label="Invoice Date" value={ctx?.invoiceDate ? formatDate(ctx.invoiceDate) : '—'} />
      </div>
    </header>
  )
}

// ===========================================================================
// Guided delivery-info popup — asks one field at a time; Enter → next.
// Kept intentionally simple: a single question, one control, a progress bar.
// It never touches quantities (those are a separate step in the item grid).
// ===========================================================================
function GuidedDeliveryModal({ del, patchDel, vehicles, vendors, drivers, couriers, onClose }: {
  del: DeliveryInfo; patchDel: (p: Partial<DeliveryInfo>) => void
  vehicles: VehicleLite[]; vendors: VendorLite[]; drivers: DriverLite[]; couriers: CourierLite[]
  onClose: () => void
}) {
  const steps = useMemo(() => {
    const base = [
      { key: 'shipToAddress', q: 'Where should this be delivered?', hint: 'Shipping Address' },
      { key: 'receiverName', q: 'Who will receive it?', hint: 'Receiver Name' },
      { key: 'receiverPhone', q: 'Receiver mobile number?', hint: 'Receiver Mobile' },
      { key: 'deliveryMethod', q: 'Delivery by Transport or Courier?', hint: 'Delivery Type' }
    ]
    const mid = del.deliveryMethod === 'transport'
      ? [
          { key: 'transportVendor', q: 'Which transport vendor?', hint: 'Transport Vendor' },
          { key: 'vehicle', q: 'Which vehicle?', hint: 'Vehicle' },
          { key: 'driver', q: 'Driver name?', hint: 'Driver' },
          { key: 'driverPhone', q: 'Driver mobile number?', hint: 'Driver Mobile' }
        ]
      : [{ key: 'courier', q: 'Which courier?', hint: 'Courier' }]
    return [...base, ...mid, { key: 'deliveryNote', q: 'Any note on the challan?', hint: 'Delivery Note (optional)' }]
  }, [del.deliveryMethod])

  const [i, setI] = useState(0)
  const idx = Math.min(i, steps.length - 1)
  const cur = steps[idx]
  const inputRef = useRef<HTMLInputElement | null>(null)
  // Focus the current control each time the step changes.
  useEffect(() => { const el = inputRef.current; if (el) { el.focus(); el.select?.() } }, [idx])

  const next = () => { if (idx + 1 >= steps.length) onClose(); else setI(idx + 1) }
  const back = () => setI(Math.max(0, idx - 1))
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); next() }
  }

  const control = () => {
    switch (cur.key) {
      case 'shipToAddress': return <input ref={inputRef} onKeyDown={onKey} value={del.shipToAddress} onChange={e => patchDel({ shipToAddress: e.target.value })} className={bigInput} placeholder="Type the delivery address" />
      case 'receiverName': return <input ref={inputRef} onKeyDown={onKey} value={del.receiverName} onChange={e => patchDel({ receiverName: e.target.value })} className={bigInput} placeholder="Receiver name" />
      case 'receiverPhone': return <input ref={inputRef} onKeyDown={onKey} value={del.receiverPhone} onChange={e => patchDel({ receiverPhone: e.target.value })} className={bigInput} placeholder="Mobile number" />
      case 'deliveryMethod': return (
        <div className="flex gap-3">
          {(['transport', 'courier'] as const).map(m => (
            // Picking the type immediately advances — one tap, on to the next.
            <button key={m} type="button" onClick={() => { patchDel({ deliveryMethod: m }); setI(idx + 1) }}
              className={cn('flex-1 rounded-xl border px-4 py-3 text-sm font-semibold',
                del.deliveryMethod === m ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink/40 text-ink-soft hover:bg-surface-sunken')}>
              {m === 'transport' ? 'Transport' : 'Courier'}
            </button>
          ))}
        </div>
      )
      case 'transportVendor': return <PickList inputRef={el => { inputRef.current = el }} onStepKey={onKey} value={del.transportVendor || (vendors.find(v => v.id === del.transporterId)?.name ?? '')}
        options={vendors.map(v => ({ id: v.id, label: v.name, sub: v.vendor_code }))}
        onPick={o => patchDel({ transporterId: o?.id ?? '', transportVendor: o?.label ?? '' })}
        onFree={t => patchDel({ transporterId: '', transportVendor: t })} placeholder="Search or type vendor" big />
      case 'vehicle': return <PickList inputRef={el => { inputRef.current = el }} onStepKey={onKey} value={vehicles.find(v => v.id === del.vehicleId)?.vehicle_number ?? ''}
        options={vehicles.map(v => ({ id: v.id, label: formatVehicleNo(v.vehicle_number) || v.vehicle_number, sub: v.vehicle_type ?? undefined }))}
        onPick={o => applyVehicle(o?.id ?? '', vehicles, vendors, patchDel)} onFree={() => {}} placeholder="Search vehicle" big />
      case 'driver': return <PickList inputRef={el => { inputRef.current = el }} onStepKey={onKey} value={del.driverName}
        options={drivers.map(d => ({ id: d.id, label: d.name, sub: d.phone ?? undefined }))}
        onPick={o => { const d = drivers.find(x => x.id === o?.id); patchDel({ driverId: o?.id ?? '', driverName: o?.label ?? '', driverPhone: d?.phone ?? del.driverPhone }) }}
        onFree={t => patchDel({ driverId: '', driverName: t })} placeholder="Search or type driver" big />
      case 'driverPhone': return <input ref={inputRef} onKeyDown={onKey} value={del.driverPhone} onChange={e => patchDel({ driverPhone: e.target.value })} className={bigInput} placeholder="Driver mobile" />
      case 'courier': return <PickList inputRef={el => { inputRef.current = el }} onStepKey={onKey} value={del.courierName}
        options={couriers.map(c => ({ id: c.id, label: c.name, sub: c.courier_code }))}
        onPick={o => patchDel({ courierId: o?.id ?? '', courierName: o?.label ?? '' })}
        onFree={t => patchDel({ courierId: '', courierName: t })} placeholder="Search or type courier" big />
      case 'deliveryNote': return <input ref={inputRef} onKeyDown={onKey} value={del.deliveryNote} onChange={e => patchDel({ deliveryNote: e.target.value })} className={bigInput} placeholder="Optional note on the challan" />
      default: return null
    }
  }

  return (
    <Modal open onClose={onClose} title="Delivery information" size="md">
      {/* Trap Escape here so it closes the popup instead of bubbling to the
          hub's global handler (which would exit the whole console). */}
      <div className="space-y-4" onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
          <div className="h-full rounded-full bg-brand-400 transition-all" style={{ width: `${((idx + 1) / steps.length) * 100}%` }} />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Step {idx + 1} of {steps.length} · {cur.hint}</p>
          <h3 className="mt-0.5 text-lg font-bold">{cur.q}</h3>
        </div>
        {control()}
        <div className="flex items-center justify-between border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={back} disabled={idx === 0}>Back</Button>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-ink-soft sm:block">Press Enter</span>
            <Button icon={idx + 1 >= steps.length ? 'check' : 'arrow_forward'} onClick={next}>
              {idx + 1 >= steps.length ? 'Done' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
const bigInput = 'h-12 w-full rounded-xl border border-ink/50 bg-surface px-4 text-base outline-none transition-colors placeholder:font-normal placeholder:text-ink/35 hover:border-ink focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'

const inputCls = 'h-9 w-full rounded-lg border border-ink/50 bg-surface px-2.5 text-sm outline-none transition-colors placeholder:font-normal placeholder:text-ink/35 hover:border-ink focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:bg-surface-sunken disabled:text-ink-faint'

function Fact({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">{label}</p>
      <p className={cn('truncate text-sm', strong ? 'font-bold' : 'font-medium')} title={value}>{value}</p>
    </div>
  )
}
// Compact searchable pick list — a native <datalist>-style lookup that also
// accepts free text (for ad-hoc vendors/drivers) without a heavy dropdown.
// Participates in the guided flow via inputRef (auto-focus) + onStepKey (Enter).
function PickList({ value, options, onPick, onFree, placeholder, disabled, inputRef, onStepKey, big }: {
  value: string; options: { id: string; label: string; sub?: string }[]
  onPick: (o: { id: string; label: string } | null) => void; onFree: (t: string) => void
  placeholder?: string; disabled?: boolean; big?: boolean
  inputRef?: (el: HTMLInputElement | null) => void; onStepKey?: (e: React.KeyboardEvent) => void
}) {
  const [text, setText] = useState(value)
  const [open, setOpen] = useState(false)
  useEffect(() => { setText(value) }, [value])
  const filtered = text.trim()
    ? options.filter(o => (o.label + ' ' + (o.sub ?? '')).toLowerCase().includes(text.toLowerCase())).slice(0, 8)
    : options.slice(0, 8)
  return (
    <div className="relative">
      <input ref={inputRef} value={text} disabled={disabled} placeholder={placeholder} className={big ? bigInput : inputCls}
        onKeyDown={e => {
          // Enter selects the single obvious match (if any), then advances.
          if (e.key === 'Enter') {
            if (open && filtered.length === 1) { setText(filtered[0].label); onPick(filtered[0]) }
            setOpen(false); onStepKey?.(e)
          }
        }}
        onChange={e => { setText(e.target.value); onFree(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && filtered.length > 0 && (
        <ul className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-56 overflow-y-auto rounded-lg border border-surface-line bg-surface p-1 shadow-pop">
          {filtered.map(o => (
            <li key={o.id}>
              <button type="button" onMouseDown={e => e.preventDefault()}
                onClick={() => { setText(o.label); onPick(o); setOpen(false) }}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-surface-sunken">
                <span className="truncate">{o.label}</span>
                {o.sub && <span className="shrink-0 text-xs text-ink-soft">{o.sub}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Picking a vehicle auto-fills its last vendor + driver (remembered on save).
function applyVehicle(id: string, vehicles: VehicleLite[], vendors: VendorLite[], patchDel: (p: Partial<DeliveryInfo>) => void) {
  const v = vehicles.find(x => x.id === id)
  const vendor = v?.vendor_id ? vendors.find(t => t.id === v.vendor_id) : null
  patchDel({
    vehicleId: id,
    ...(v?.driver_name ? { driverId: '', driverName: v.driver_name } : {}),
    ...(v?.driver_phone ? { driverPhone: v.driver_phone } : {}),
    ...(vendor ? { transporterId: vendor.id, transportVendor: vendor.name } : {})
  })
}

// ===========================================================================
// Item grid
// ===========================================================================
// Columns sized to the actual data, not padded out: a 5-digit code needs no
// more than ~74px, quantities are 2–3 digits, while Description (the long,
// same-font product name) takes the lion's share and Remarks the rest.
// Order: # · Item Code · Description · Invoiced · Delivered · Condition · Location · Remarks · ✓
const GRID = 'grid grid-cols-[32px_74px_minmax(150px,2.4fr)_60px_82px_122px_108px_minmax(80px,1fr)_32px] items-center gap-2.5'

function ItemHeaderRow() {
  return (
    <div className={cn(GRID, 'sticky top-0 z-10 border-b border-surface-line bg-surface-sunken px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-ink-soft')}>
      <span>#</span><span>Item Code</span><span>Description</span>
      <span className="text-right">Invoiced</span><span className="text-right">Delivered</span>
      <span>Condition</span><span>Location</span><span>Remarks</span><span className="text-center">✓</span>
    </div>
  )
}

function ItemRow({ i, l, locations, disabled, qtyRef, onQtyKey, onFocusQty, onQty, onCommitQty, onCondition, onLocation, onRemarks }: {
  i: number; l: HubLine; locations: LocationLite[]; disabled: boolean
  qtyRef: (el: HTMLInputElement | null) => void
  onQtyKey: (e: React.KeyboardEvent) => void; onFocusQty: () => void
  onQty: (v: number) => void; onCommitQty: (v: number) => void
  onCondition: (c: string) => void; onLocation: (l: string) => void; onRemarks: (r: string) => void
}) {
  const done = (l.alreadyDelivered + (Number(l.deliveredQty) || 0)) >= l.invoicedQty && l.invoicedQty > 0
  const cond = STOCK_CONDITIONS[l.condition]
  return (
    <div className={cn(GRID, 'border-b border-surface-line px-4 py-1.5 text-sm', done ? 'bg-ok/5' : l.deliveredQty > 0 ? 'bg-brand-50/40' : '')}>
      <span className="text-xs font-medium text-ink-soft tabular-nums">{i + 1}</span>
      <span className="truncate font-semibold tabular-nums" title={l.code}>{l.code}</span>
      <span className="truncate" title={l.name}>
        {l.name}
        {l.alreadyDelivered > 0 && <span className="ml-1.5 text-[11px] text-ink-soft">({formatNumber(l.alreadyDelivered)} already)</span>}
      </span>
      <span className="text-right tabular-nums text-ink-soft">{formatNumber(l.invoicedQty)}</span>
      <input
        ref={qtyRef} type="number" inputMode="numeric" disabled={disabled || l.remaining <= 0}
        value={l.deliveredQty === 0 ? '' : l.deliveredQty}
        onFocus={e => { onFocusQty(); e.currentTarget.select() }}
        onKeyDown={onQtyKey}
        onChange={e => onQty(Math.max(0, Number(e.target.value) || 0))}
        onBlur={e => onCommitQty(Number(e.target.value) || 0)}
        placeholder="0"
        className={cn('h-8 w-full rounded-md border px-2 text-right text-sm font-semibold tabular-nums outline-none placeholder:font-normal placeholder:text-ink/35 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20',
          Number(l.deliveredQty) > l.remaining ? 'border-bad text-bad' : 'border-ink/40',
          (disabled || l.remaining <= 0) && 'bg-surface-sunken text-ink-faint')}
      />
      <select value={l.condition} disabled={disabled} onChange={e => onCondition(e.target.value)}
        className="h-8 w-full rounded-md border border-ink/40 bg-surface px-1.5 text-xs outline-none focus:border-brand-500">
        {CONDITION_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <select value={l.locationId} disabled={disabled} onChange={e => onLocation(e.target.value)}
        className="h-8 w-full rounded-md border border-ink/40 bg-surface px-1.5 text-xs outline-none focus:border-brand-500">
        <option value="">— Location —</option>
        {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.location_code}</option>)}
      </select>
      <input value={l.remarks} disabled={disabled} onChange={e => onRemarks(e.target.value)} placeholder="note"
        className="h-8 w-full rounded-md border border-ink/40 bg-surface px-2 text-xs outline-none placeholder:text-ink/35 focus:border-brand-500" />
      <span className="flex justify-center">
        {done
          ? <Icon name="check_circle" className="text-[20px] text-ok" filled />
          : <span title={cond?.label}
              className={cn('inline-block h-2.5 w-2.5 rounded-full',
                l.deliveredQty > 0 ? 'bg-brand-400' : 'bg-surface-line ring-1 ring-ink/20')} />}
      </span>
    </div>
  )
}

// ===========================================================================
// Right smart panel
// ===========================================================================
function SmartPanel({ recent, vehicles, vendors, drivers, couriers, disabled, del, ctx, patchDel, onEditInfo, onApplyVehicle, onApplyDriver, onApplyVendor, onApplyAddress, onApplyReceiver, onApplyNote }: {
  recent: RecentChallan[]; vehicles: VehicleLite[]; vendors: VendorLite[]; drivers: DriverLite[]; couriers: CourierLite[]
  disabled: boolean; del: DeliveryInfo; ctx: InvoiceCtx | null
  patchDel: (p: Partial<DeliveryInfo>) => void; onEditInfo: () => void
  onApplyVehicle: (id: string) => void; onApplyDriver: (name: string, phone?: string) => void
  onApplyVendor: (id: string, name: string) => void; onApplyAddress: (a: string) => void
  onApplyReceiver: (name: string, phone?: string) => void; onApplyNote: (n: string) => void
}) {
  const fd = disabled || !ctx // fields editable only once an invoice is loaded
  // Distinct, most-recent-first values pulled from the last challans.
  const uniq = <T,>(arr: T[], key: (t: T) => string) => {
    const seen = new Set<string>(); const out: T[] = []
    for (const x of arr) { const k = key(x); if (k && !seen.has(k)) { seen.add(k); out.push(x) } }
    return out
  }
  const vehById = useMemo(() => Object.fromEntries(vehicles.map(v => [v.id, v])), [vehicles])
  const recentVehicles = uniq(recent.filter(r => r.vehicle_id), r => r.vehicle_id!).slice(0, 5)
  const recentDrivers = uniq(recent.filter(r => r.driver_name), r => r.driver_name!).slice(0, 5)
  const recentVendors = uniq(recent.filter(r => r.transport_vendor), r => r.transport_vendor!).slice(0, 5)
  const recentAddrs = uniq(recent.filter(r => r.ship_to_address), r => r.ship_to_address!).slice(0, 4)
  const recentReceivers = uniq(recent.filter(r => r.receiver_name), r => r.receiver_name!).slice(0, 5)
  const recentNotes = uniq(recent.filter(r => r.print_note && r.print_note !== DEFAULT_CHALLAN_NOTE), r => r.print_note!).slice(0, 3)

  return (
    <aside className={cn('hidden w-72 shrink-0 flex-col overflow-y-auto border-l border-surface-line bg-surface-sunken/30 md:flex', disabled && 'pointer-events-none opacity-50')}>
      {/* Delivery info — the "rest of the data" lives and fills right here as
          compact fields. The Guided button opens the same fields as a popup. */}
      <div className="border-b border-surface-line px-3 py-2.5">
        <div className="mb-2 flex items-center gap-2">
          <Icon name="local_shipping" className="text-[16px] text-brand-600" />
          <h3 className="text-[13px] font-bold">Delivery Info</h3>
          <button onClick={onEditInfo} disabled={fd}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-brand-500 bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-40">
            <Icon name="dynamic_form" className="text-[13px]" /> Guided
          </button>
        </div>
        <div className="space-y-2">
          <PanelField label="Ship-To Address">
            <input value={del.shipToAddress} disabled={fd} onChange={e => patchDel({ shipToAddress: e.target.value })} className={panelInput} placeholder="Delivery address" />
          </PanelField>
          <div className="grid grid-cols-2 gap-2">
            <PanelField label="Receiver Name">
              <input value={del.receiverName} disabled={fd} onChange={e => patchDel({ receiverName: e.target.value })} className={panelInput} placeholder="Name" />
            </PanelField>
            <PanelField label="Receiver Mobile">
              <input value={del.receiverPhone} disabled={fd} onChange={e => patchDel({ receiverPhone: e.target.value })} className={panelInput} placeholder="Mobile" />
            </PanelField>
          </div>
          <PanelField label="Delivery Type">
            <div className="flex gap-1.5">
              {(['transport', 'courier'] as const).map(m => (
                <button key={m} type="button" disabled={fd} onClick={() => patchDel({ deliveryMethod: m })}
                  className={cn('h-8 flex-1 rounded-md border text-[11px] font-semibold disabled:opacity-50',
                    del.deliveryMethod === m ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink/40 text-ink-soft hover:bg-surface-sunken')}>
                  {m === 'transport' ? 'Transport' : 'Courier'}
                </button>
              ))}
            </div>
          </PanelField>
          {del.deliveryMethod === 'transport' ? (
            <>
              <PanelField label="Transport Vendor">
                <PickList disabled={fd} value={del.transportVendor || (vendors.find(v => v.id === del.transporterId)?.name ?? '')}
                  options={vendors.map(v => ({ id: v.id, label: v.name, sub: v.vendor_code }))}
                  onPick={o => patchDel({ transporterId: o?.id ?? '', transportVendor: o?.label ?? '' })}
                  onFree={t => patchDel({ transporterId: '', transportVendor: t })} placeholder="Vendor" />
              </PanelField>
              <PanelField label="Vehicle">
                <PickList disabled={fd} value={vehById[del.vehicleId]?.vehicle_number ?? ''}
                  options={vehicles.map(v => ({ id: v.id, label: formatVehicleNo(v.vehicle_number) || v.vehicle_number, sub: v.vehicle_type ?? undefined }))}
                  onPick={o => onApplyVehicle(o?.id ?? '')} onFree={() => {}} placeholder="Vehicle" />
              </PanelField>
              <div className="grid grid-cols-2 gap-2">
                <PanelField label="Driver">
                  <PickList disabled={fd} value={del.driverName}
                    options={drivers.map(d => ({ id: d.id, label: d.name, sub: d.phone ?? undefined }))}
                    onPick={o => { const d = drivers.find(x => x.id === o?.id); patchDel({ driverId: o?.id ?? '', driverName: o?.label ?? '', driverPhone: d?.phone ?? del.driverPhone }) }}
                    onFree={t => patchDel({ driverId: '', driverName: t })} placeholder="Driver" />
                </PanelField>
                <PanelField label="Driver Mobile">
                  <input value={del.driverPhone} disabled={fd} onChange={e => patchDel({ driverPhone: e.target.value })} className={panelInput} placeholder="Mobile" />
                </PanelField>
              </div>
            </>
          ) : (
            <PanelField label="Courier">
              <PickList disabled={fd} value={del.courierName}
                options={couriers.map(c => ({ id: c.id, label: c.name, sub: c.courier_code }))}
                onPick={o => patchDel({ courierId: o?.id ?? '', courierName: o?.label ?? '' })}
                onFree={t => patchDel({ courierId: '', courierName: t })} placeholder="Courier" />
            </PanelField>
          )}
          <PanelField label="Delivery Note">
            <input value={del.deliveryNote} disabled={fd} onChange={e => patchDel({ deliveryNote: e.target.value })} className={panelInput} placeholder="Note on challan" />
          </PanelField>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-surface-line px-3 py-2">
        <Icon name="auto_awesome" className="text-[15px] text-brand-600" />
        <h3 className="text-[11px] font-bold uppercase tracking-wide">Smart Fill</h3>
        <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-ink-soft">One-click</span>
      </div>
      <div className="space-y-4 p-3">
        <PanelGroup icon="local_shipping" title="Recent Vehicle" empty={!recentVehicles.length}>
          {recentVehicles.map(r => (
            <Chip key={r.id} onClick={() => onApplyVehicle(r.vehicle_id!)}
              main={formatVehicleNo(vehById[r.vehicle_id!]?.vehicle_number) || vehById[r.vehicle_id!]?.vehicle_number || '—'}
              sub={r.driver_name || undefined} />
          ))}
        </PanelGroup>
        <PanelGroup icon="person" title="Recent Driver" empty={!recentDrivers.length}>
          {recentDrivers.map(r => (
            <Chip key={r.id} onClick={() => onApplyDriver(r.driver_name!, r.driver_phone ?? undefined)} main={r.driver_name!} sub={r.driver_phone || undefined} />
          ))}
        </PanelGroup>
        <PanelGroup icon="business" title="Recent Transport Vendor" empty={!recentVendors.length}>
          {recentVendors.map(r => (
            <Chip key={r.id} onClick={() => onApplyVendor(r.transporter_id ?? '', r.transport_vendor!)} main={r.transport_vendor!} />
          ))}
        </PanelGroup>
        <PanelGroup icon="location_on" title="Recent Shipping Address" empty={!recentAddrs.length}>
          {recentAddrs.map(r => (
            <Chip key={r.id} onClick={() => onApplyAddress(r.ship_to_address!)} main={r.ship_to_address!} multiline />
          ))}
        </PanelGroup>
        <PanelGroup icon="how_to_reg" title="Receiver History" empty={!recentReceivers.length}>
          {recentReceivers.map(r => (
            <Chip key={r.id} onClick={() => onApplyReceiver(r.receiver_name!, r.receiver_phone ?? undefined)} main={r.receiver_name!} sub={r.receiver_phone || undefined} />
          ))}
        </PanelGroup>
        {recentNotes.length > 0 && (
          <PanelGroup icon="sticky_note_2" title="Frequent Delivery Notes" empty={false}>
            {recentNotes.map(r => (
              <Chip key={r.id} onClick={() => onApplyNote(r.print_note!)} main={r.print_note!} multiline />
            ))}
          </PanelGroup>
        )}
      </div>
    </aside>
  )
}

// Compact panel field: tiny label over a tight-padding control.
const panelInput = 'h-8 w-full rounded-md border border-ink/40 bg-surface px-2 text-xs outline-none placeholder:font-normal placeholder:text-ink/35 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/25 disabled:bg-surface-sunken disabled:text-ink-faint'
function PanelField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-ink-soft">{label}</label>
      {children}
    </div>
  )
}
function PanelGroup({ icon, title, empty, children }: { icon: string; title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        <Icon name={icon} className="text-[15px] text-ink-soft" />
        <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">{title}</p>
      </div>
      {empty ? <p className="pl-1 text-xs text-ink-faint">No history yet</p> : <div className="space-y-1">{children}</div>}
    </div>
  )
}
function Chip({ main, sub, multiline, onClick }: { main: string; sub?: string; multiline?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="group flex w-full items-start justify-between gap-2 rounded-lg border border-surface-line bg-surface px-2.5 py-1.5 text-left transition-colors hover:border-brand-300 hover:bg-brand-50">
      <span className="min-w-0">
        <span className={cn('block text-xs font-semibold text-ink', !multiline && 'truncate')}>{main}</span>
        {sub && <span className="block truncate text-[11px] text-ink-soft">{sub}</span>}
      </span>
      <Icon name="add" className="mt-0.5 shrink-0 text-[16px] text-ink-faint group-hover:text-brand-600" />
    </button>
  )
}

// ===========================================================================
// Footer — live statistics + primary action area
// ===========================================================================
function FooterBar({ stats, ctx, created, saving, canPost, canCreate, onGenerate, onPrint, onConfirm, onNew }: {
  stats: { invoiceQty: number; deliveredQty: number; pending: number; totalItems: number; completedItems: number; remaining: number; pct: number }
  ctx: InvoiceCtx | null; created: Tables<'delivery_challans'> | null; saving: boolean; canPost: boolean; canCreate: boolean
  onGenerate: () => void; onPrint: () => void; onConfirm: () => void; onNew: () => void
}) {
  const posted = !!created?.posted_at
  return (
    <footer className="shrink-0 border-t border-surface-line bg-surface">
      <div className="flex items-center gap-5 px-4 py-2.5">
        <div className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-1">
          <Stat label="Invoice Qty" value={formatNumber(stats.invoiceQty)} />
          <Stat label="Delivered" value={formatNumber(stats.deliveredQty)} tone="brand" />
          <Stat label="Pending" value={formatNumber(stats.pending)} tone={stats.pending > 0 ? 'warn' : 'ok'} />
          <Divider />
          <Stat label="Total Items" value={String(stats.totalItems)} />
          <Stat label="Completed" value={String(stats.completedItems)} tone="ok" />
          <Stat label="Remaining" value={String(stats.remaining)} tone={stats.remaining > 0 ? 'warn' : 'ok'} />
          <div className="flex items-center gap-2">
            <div className="h-2 w-28 overflow-hidden rounded-full bg-surface-sunken">
              <div className="h-full rounded-full bg-brand-400 transition-all" style={{ width: `${stats.pct}%` }} />
            </div>
            <span className="text-sm font-bold tabular-nums">{stats.pct}%</span>
          </div>
        </div>

        {/* Primary action area (bottom-right). */}
        <div className="flex shrink-0 items-center gap-2">
          {!ctx ? (
            <span className="text-xs text-ink-faint">Search an invoice to begin</span>
          ) : !created ? (
            <Button icon="local_shipping" size="md" loading={saving} disabled={!canCreate} onClick={onGenerate}
              className="h-11 px-6 text-[15px]" title={canCreate ? undefined : 'You do not have permission to create challans'}>
              Generate Delivery Challan
            </Button>
          ) : (
            <>
              <span className="mr-1 flex items-center gap-1.5 rounded-lg bg-ok/10 px-3 py-1.5 text-sm font-semibold text-ok">
                <Icon name="check_circle" className="text-[18px]" filled /> {created.challan_no}{posted ? ' · Dispatched' : ''}
              </span>
              <Button variant="secondary" icon="print" onClick={onPrint}>Print PDF</Button>
              {canPost && !posted && <Button variant="secondary" icon="task_alt" loading={saving} onClick={onConfirm}>Confirm Dispatch</Button>}
              <Button icon="add" onClick={onNew}>New Dispatch</Button>
            </>
          )}
        </div>
      </div>
    </footer>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'brand' | 'ok' | 'warn' }) {
  const c = tone === 'brand' ? 'text-brand-600' : tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : 'text-ink'
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{label}</span>
      <span className={cn('text-base font-bold tabular-nums', c)}>{value}</span>
    </div>
  )
}
const Divider = () => <span className="hidden h-6 w-px bg-surface-line sm:block" />

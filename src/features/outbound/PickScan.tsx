import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { nextDocNumber } from '@/hooks/useDocNumber'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { formatNumber } from '@/lib/utils'

const num = (v: any): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

interface PLine {
  item_id: string; product_id: string; code: string; barcode: string; name: string; uom: string
  serialTracked: boolean
  ordered: number; delivered: number; pending: number; saleable: number
  pickQty: number       // non-serial lines: picked count (serial lines derive from serials.length)
  serials: string[]     // captured unit serials (serial-tracked lines)
}

// Short audio cue so a warehouse user gets hands-free scan feedback.
let _ac: AudioContext | null = null
function beep(ok: boolean) {
  try {
    _ac = _ac || new (window.AudioContext || (window as any).webkitAudioContext)()
    const o = _ac.createOscillator(), g = _ac.createGain()
    o.connect(g); g.connect(_ac.destination)
    o.frequency.value = ok ? 880 : 220
    g.gain.setValueAtTime(0.05, _ac.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, _ac.currentTime + 0.18)
    o.start(); o.stop(_ac.currentTime + 0.18)
  } catch { /* audio not available — silent */ }
}

// Scan-First picking for a single sales order (WES principle #3). A warehouse
// user scans the product barcode (non-serial items) or each unit's serial
// (serial-tracked items); manual entry stays available where permitted. Picked
// quantities — with captured serials — become a delivery challan. Partial
// fulfilment is fine; the rest stays pending for a later challan.
export function PickScan({ lockSoId, onDone }: { lockSoId: string; onDone?: () => void }) {
  const { currentClientId, can } = useAuth()
  const notify = useUI(s => s.notify)
  const canEdit = can('outbound.create') || can('outbound.edit')
  const [soRow, setSoRow] = useState<any>(null)
  const [lines, setLines] = useState<PLine[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [scan, setScan] = useState('')
  const [lastHit, setLastHit] = useState<{ id: string; ok: boolean } | null>(null)
  // serial_no (lowercased) -> product_id, for available in-stock serials on this order.
  const serialIndex = useRef<Record<string, string>>({})
  const scanRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (currentClientId && lockSoId) load() /* eslint-disable-next-line */ }, [currentClientId, lockSoId])

  const load = async () => {
    setLoading(true)
    try {
      const { data: order } = await supabase.from('sales_orders').select('id,so_no,customer_id,warehouse_id,status,reference_no').eq('id', lockSoId).single()
      setSoRow(order)
      const { data: items } = await supabase.from('sales_order_items').select('id,product_id,qty,delivered_qty').eq('so_id', lockSoId)
      const pids = (items ?? []).map((i: any) => i.product_id).filter(Boolean)
      const guard = pids.length ? pids : ['00000000-0000-0000-0000-000000000000']
      const [{ data: prods }, { data: stock }, { data: serials }] = await Promise.all([
        supabase.from('products').select('id,material_code,name,uom,barcode,serial_tracking').in('id', guard),
        supabase.from('inventory_stock').select('product_id,quantity,reserved_qty,warehouse_id').eq('client_id', currentClientId!).eq('stock_status', 'good').in('product_id', guard),
        supabase.from('serial_numbers').select('serial_no,product_id,status,warehouse_id').eq('client_id', currentClientId!).eq('status', 'in_stock').in('product_id', guard)
      ])
      const pmap: Record<string, any> = {}; (prods ?? []).forEach((p: any) => { pmap[p.id] = p })
      const saleable = (pid: string) => (stock ?? []).filter((s: any) => s.product_id === pid && (!order?.warehouse_id || s.warehouse_id === order.warehouse_id))
        .reduce((a: number, s: any) => a + (num(s.quantity) - num(s.reserved_qty)), 0)
      // Index available serials (respect the order warehouse when one is set).
      const idx: Record<string, string> = {}
      ;(serials ?? []).forEach((s: any) => {
        if (order?.warehouse_id && s.warehouse_id && s.warehouse_id !== order.warehouse_id) return
        if (s.serial_no) idx[String(s.serial_no).trim().toLowerCase()] = s.product_id
      })
      serialIndex.current = idx
      setLines((items ?? []).map((it: any) => {
        const ordered = num(it.qty), delivered = num(it.delivered_qty), pending = Math.max(0, ordered - delivered)
        const p = pmap[it.product_id] ?? {}
        return {
          item_id: it.id, product_id: it.product_id, code: p.material_code ?? '?', barcode: p.barcode ?? '',
          name: p.name ?? 'Unknown', uom: p.uom ?? '', serialTracked: !!p.serial_tracking,
          ordered, delivered, pending, saleable: saleable(it.product_id), pickQty: 0, serials: []
        }
      }))
    } finally { setLoading(false) }
  }

  const picked = (l: PLine) => l.serialTracked ? l.serials.length : l.pickQty
  const totalPick = lines.reduce((s, l) => s + picked(l), 0)

  const flash = (id: string, ok: boolean) => { setLastHit({ id, ok }); beep(ok); setTimeout(() => setLastHit(h => h?.id === id ? null : h), 900) }
  const refocus = () => requestAnimationFrame(() => scanRef.current?.focus())

  // Resolve a scan to a line and apply one unit. Order: try serial, then product code/barcode.
  const applyScan = (raw: string) => {
    const v = raw.trim(); if (!v) return
    const key = v.toLowerCase()

    const serialPid = serialIndex.current[key]
    if (serialPid) {
      const li = lines.findIndex(l => l.product_id === serialPid)
      if (li < 0) { notify('error', `Serial ${v}: ei product order-e nei`); flash('', false); return }
      const l = lines[li]
      if (!l.serialTracked) { notify('error', `${l.code}: serial-tracked product noy`); flash(l.item_id, false); return }
      if (l.serials.map(s => s.toLowerCase()).includes(key)) { notify('error', `Serial ${v} agei scan kora hoyeche`); flash(l.item_id, false); return }
      if (l.serials.length >= l.pending) { notify('error', `${l.code}: pending (${l.pending}) er beshi scan kora jabe na`); flash(l.item_id, false); return }
      setLines(ls => ls.map((x, i) => i === li ? { ...x, serials: [...x.serials, v] } : x))
      flash(l.item_id, true); refocus(); return
    }

    const li = lines.findIndex(l => l.code.toLowerCase() === key || (l.barcode && l.barcode.toLowerCase() === key))
    if (li < 0) { notify('error', `Scan match holo na: ${v}`); flash('', false); return }
    const l = lines[li]
    if (l.serialTracked) { notify('error', `${l.code}: unit-er serial scan korun (product code noy)`); flash(l.item_id, false); return }
    if (l.pickQty >= l.pending) { notify('error', `${l.code}: pending (${l.pending}) complete`); flash(l.item_id, false); return }
    if (l.pickQty >= l.saleable) { notify('error', `${l.code}: saleable stock (${l.saleable}) shesh`); flash(l.item_id, false); return }
    setLines(ls => ls.map((x, i) => i === li ? { ...x, pickQty: x.pickQty + 1 } : x))
    flash(l.item_id, true); refocus()
  }

  const onScanKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); applyScan(scan); setScan('') }
  }

  const setQty = (i: number, v: string) => setLines(ls => ls.map((l, idx) => idx === i ? { ...l, pickQty: Math.max(0, num(v)) } : l))
  const addSerial = (i: number, v: string) => {
    const s = v.trim(); if (!s) return
    setLines(ls => ls.map((l, idx) => {
      if (idx !== i) return l
      if (l.serials.map(x => x.toLowerCase()).includes(s.toLowerCase())) { notify('error', `Serial ${s} agei add kora hoyeche`); return l }
      if (l.serials.length >= l.pending) { notify('error', `${l.code}: pending (${l.pending}) er beshi noy`); return l }
      return { ...l, serials: [...l.serials, s] }
    }))
  }
  const removeSerial = (i: number, s: string) => setLines(ls => ls.map((l, idx) => idx === i ? { ...l, serials: l.serials.filter(x => x !== s) } : l))
  const fillPending = () => setLines(ls => ls.map(l => l.serialTracked ? l : ({ ...l, pickQty: Math.min(l.pending, l.saleable) })))

  const createChallan = async () => {
    if (!soRow) return
    const picks = lines.filter(l => picked(l) > 0)
    if (picks.length === 0) { notify('error', 'Onto ekta line pick/scan korun'); return }
    const over = picks.find(l => picked(l) > l.pending)
    if (over) { notify('error', `${over.code}: pick qty pending (${over.pending}) er beshi hote parbe na`); return }
    setBusy(true)
    try {
      const challan_no = await nextDocNumber(currentClientId!, 'DC')
      if (!challan_no) throw new Error('Could not generate challan number')
      const { data: ch, error } = await supabase.from('delivery_challans').insert({
        client_id: currentClientId!, challan_no, sales_order_id: soRow.id, customer_id: soRow.customer_id,
        warehouse_id: soRow.warehouse_id, po_no: soRow.reference_no || null,
        challan_date: new Date().toISOString().slice(0, 10), total_qty: totalPick, status: 'draft'
      }).select('id').single()
      if (error) throw error
      // Serial-tracked lines: one challan item per unit (qty 1 + serial), so every
      // serial is individually traceable through stock-out.
      const rows: any[] = []
      for (const l of picks) {
        if (l.serialTracked) {
          for (const sn of l.serials) rows.push({ client_id: currentClientId!, challan_id: ch.id, product_id: l.product_id, so_item_id: l.item_id, qty: 1, unit_price: 0, stock_status: 'good', serial_no: sn })
        } else {
          rows.push({ client_id: currentClientId!, challan_id: ch.id, product_id: l.product_id, so_item_id: l.item_id, qty: l.pickQty, unit_price: 0, stock_status: 'good' })
        }
      }
      const { error: ie } = await supabase.from('delivery_challan_items').insert(rows)
      if (ie) throw ie
      await supabase.from('sales_orders').update({ status: 'picking' }).eq('id', soRow.id).eq('status', 'pending')
      notify('success', `Challan ${challan_no} draft toiri — Delivery Challan tab-e Invoice diye Issue korun`)
      onDone?.(); load()
    } catch (e: any) { notify('error', e?.message ?? 'Could not create challan') } finally { setBusy(false) }
  }

  if (loading) return <p className="py-6 text-center text-sm text-ink-faint">Loading…</p>

  return (
    <div className="space-y-3">
      {/* Scan-first input — always the primary focus. */}
      <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-3">
        <div className="flex items-center gap-2">
          <Icon name="qr_code_scanner" className="text-[22px] text-brand-600" />
          <input ref={scanRef} autoFocus value={scan} onChange={e => setScan(e.target.value)} onKeyDown={onScanKey}
            placeholder="Scan barcode / serial… (or type & Enter)"
            className="fiori-input h-11 flex-1 text-sm" />
          <Button variant="ghost" onClick={() => { applyScan(scan); setScan('') }} disabled={!scan.trim()}>Add</Button>
        </div>
        <p className="mt-2 text-[11px] text-ink-faint">Non-serial item: product barcode scan korle qty +1. Serial item: protita unit-er serial scan korun.</p>
      </div>

      <div className="flex items-center justify-between">
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink"><Icon name="print" className="text-[16px]" /> print order for scan</button>
        <button type="button" onClick={fillPending} className="text-xs font-medium text-brand-600 hover:underline">Fill pending (non-serial)</button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-surface-sunken text-[11px] uppercase tracking-wide text-ink-faint">
                <th className="px-3 py-2 text-left font-semibold">Material</th>
                <th className="px-3 py-2 text-right font-semibold">Ordered</th>
                <th className="px-3 py-2 text-right font-semibold">Delivered</th>
                <th className="px-3 py-2 text-right font-semibold">Pending</th>
                <th className="px-3 py-2 text-right font-semibold">Saleable</th>
                <th className="px-3 py-2 text-right font-semibold">Pick / scan</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const hit = lastHit?.id === l.item_id
                const rowCls = hit ? (lastHit!.ok ? 'bg-ok/10' : 'bg-bad/10') : ''
                return (
                  <tr key={l.item_id} className={'border-t border-surface-line transition-colors ' + rowCls}>
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-center gap-1 font-mono text-xs text-ink">{l.code}{l.serialTracked && <Badge tone="info">serial</Badge>}</div>
                      <div className="truncate text-xs text-ink-soft">{l.name}{l.uom ? ' · ' + l.uom : ''}</div>
                      {l.serialTracked && l.serials.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {l.serials.map(sn => (
                            <span key={sn} className="inline-flex items-center gap-1 rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-[10px] text-ink-soft">
                              {sn}<button type="button" onClick={() => removeSerial(i, sn)} className="text-ink-faint hover:text-bad"><Icon name="close" className="text-[12px]" /></button>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right align-top">{formatNumber(l.ordered)}</td>
                    <td className="px-3 py-2 text-right align-top text-ink-soft">{formatNumber(l.delivered)}</td>
                    <td className="px-3 py-2 text-right align-top font-medium">{formatNumber(l.pending)}</td>
                    <td className="px-3 py-2 text-right align-top"><Badge tone={l.saleable < l.pending ? 'critical' : 'positive'}>{formatNumber(l.saleable)}</Badge></td>
                    <td className="px-3 py-2 text-right align-top">
                      {l.serialTracked ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs font-medium text-ink">{l.serials.length} / {l.pending} scanned</span>
                          <input type="text" disabled={l.pending <= 0} placeholder="add serial"
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSerial(i, (e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = '' } }}
                            className="fiori-input h-8 w-32 text-right text-xs disabled:opacity-40" />
                        </div>
                      ) : (
                        <input type="number" step="any" value={l.pickQty || ''} disabled={l.pending <= 0} onChange={e => setQty(i, e.target.value)} className="fiori-input h-8 w-24 text-right disabled:opacity-40" placeholder="0" />
                      )}
                    </td>
                  </tr>
                )
              })}
              {lines.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-ink-faint">No lines on this order</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-surface-line bg-surface-sunken px-4 py-3">
          <span className="text-sm text-ink-soft">Picking <span className="font-semibold text-ink">{formatNumber(totalPick)}</span></span>
          {canEdit && <Button icon="local_shipping" loading={busy} onClick={createChallan} disabled={totalPick <= 0}>Create Delivery Challan</Button>}
        </div>
      </Card>
      <p className="text-xs text-ink-faint">Saleable = good available qty. Create a challan for whatever you ship now; the rest stays pending for a later challan.</p>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { formatNumber } from '@/lib/utils'

const num = (v: any): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

interface SLine {
  item_id: string; product_id: string; code: string; name: string; uom: string
  ordered: number
  serials: { id?: string; serial_no: string }[]   // existing rows keep their id
}

// Serial scan stage for a single order (opened from the order, not a tab).
// Scan units with a Zebra (keyboard-wedge: serial + Enter). The serial prefix
// matches the product material code, so the line is detected automatically.
// Scanned count is validated against the ordered qty; the captured serials are
// the single source for both the SAP prework export and the delivery challan.
export function SerialScan({ lockSoId, onDone }: { lockSoId: string; onDone?: () => void }) {
  const { currentClientId, can } = useAuth()
  const notify = useUI(s => s.notify)
  const canEdit = can('outbound.create') || can('outbound.edit')
  const [soRow, setSoRow] = useState<any>(null)
  const [lines, setLines] = useState<SLine[]>([])
  const [removedIds, setRemovedIds] = useState<string[]>([])
  const [scan, setScan] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const scanRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (currentClientId && lockSoId) load() /* eslint-disable-next-line */ }, [currentClientId, lockSoId])

  const load = async () => {
    setLoading(true)
    try {
      const { data: order } = await supabase.from('sales_orders').select('id,so_no,customer_id,warehouse_id,status,reference_no').eq('id', lockSoId).single()
      setSoRow(order)
      const { data: items } = await supabase.from('sales_order_items').select('id,product_id,qty').eq('so_id', lockSoId)
      const pids = (items ?? []).map((i: any) => i.product_id).filter(Boolean)
      const guard = pids.length ? pids : ['00000000-0000-0000-0000-000000000000']
      const [{ data: prods }, { data: existing }] = await Promise.all([
        supabase.from('products').select('id,material_code,name,uom').in('id', guard),
        supabase.from('serial_numbers').select('id,serial_no,product_id,so_item_id').eq('client_id', currentClientId!).eq('reference_no', order?.so_no ?? '__none__')
      ])
      const pmap: Record<string, any> = {}; (prods ?? []).forEach((p: any) => { pmap[p.id] = p })
      setRemovedIds([])
      setLines((items ?? []).map((it: any) => {
        const p = pmap[it.product_id] ?? {}
        const serials = (existing ?? []).filter((s: any) => s.so_item_id === it.id || (!s.so_item_id && s.product_id === it.product_id))
          .map((s: any) => ({ id: s.id, serial_no: s.serial_no }))
        return { item_id: it.id, product_id: it.product_id, code: p.material_code ?? '?', name: p.name ?? 'Unknown', uom: p.uom ?? '', ordered: num(it.qty), serials }
      }))
    } finally { setLoading(false) }
  }

  const totalScanned = lines.reduce((s, l) => s + l.serials.length, 0)
  const totalOrdered = lines.reduce((s, l) => s + l.ordered, 0)
  const allSerials = useMemo(() => new Set(lines.flatMap(l => l.serials.map(s => s.serial_no.toLowerCase()))), [lines])

  // Find the order line whose material code is the longest matching prefix of the serial.
  const detectLine = (serial: string): number => {
    const s = serial.toLowerCase()
    let best = -1, bestLen = -1
    lines.forEach((l, i) => {
      const code = l.code.toLowerCase()
      if (code && code !== '?' && s.startsWith(code) && code.length > bestLen) { best = i; bestLen = code.length }
    })
    return best
  }

  const addSerial = (raw: string) => {
    const serial = raw.trim()
    if (!serial) return
    if (allSerials.has(serial.toLowerCase())) { notify('error', `Serial already scanned: ${serial}`); setScan(''); return }
    const idx = detectLine(serial)
    if (idx < 0) { notify('error', `No matching product for serial ${serial} — check the code`); return }
    const line = lines[idx]
    if (line.serials.length >= line.ordered) { notify('error', `${line.code}: already scanned ${line.ordered}/${line.ordered} (ordered qty reached)`); setScan(''); return }
    setLines(ls => ls.map((l, i) => i === idx ? { ...l, serials: [...l.serials, { serial_no: serial }] } : l))
    setScan('')
    requestAnimationFrame(() => scanRef.current?.focus())
  }

  const removeSerial = (lineIdx: number, serialIdx: number) => {
    setLines(ls => ls.map((l, i) => {
      if (i !== lineIdx) return l
      const s = l.serials[serialIdx]
      if (s.id) setRemovedIds(r => [...r, s.id!])
      return { ...l, serials: l.serials.filter((_, si) => si !== serialIdx) }
    }))
  }

  const save = async () => {
    if (!soRow) return
    setBusy(true)
    try {
      // Guard: no serial may exceed the ordered qty.
      const over = lines.find(l => l.serials.length > l.ordered)
      if (over) throw new Error(`${over.code}: scanned ${over.serials.length} > ordered ${over.ordered}`)
      // Block serials that already exist on another order for this client.
      const fresh = lines.flatMap(l => l.serials.filter(s => !s.id).map(s => ({ serial_no: s.serial_no, product_id: l.product_id, so_item_id: l.item_id })))
      if (fresh.length) {
        const { data: clash } = await supabase.from('serial_numbers').select('serial_no,reference_no')
          .eq('client_id', currentClientId!).in('serial_no', fresh.map(f => f.serial_no))
        const other = (clash ?? []).filter((c: any) => c.reference_no !== soRow.so_no)
        if (other.length) throw new Error(`Serial(s) already used elsewhere: ${other.map((c: any) => c.serial_no).slice(0, 3).join(', ')}`)
      }
      if (removedIds.length) {
        const { error } = await supabase.from('serial_numbers').delete().in('id', removedIds)
        if (error) throw error
      }
      if (fresh.length) {
        const rows = fresh.map(f => ({
          client_id: currentClientId!, product_id: f.product_id, serial_no: f.serial_no,
          so_item_id: f.so_item_id, reference_no: soRow.so_no, warehouse_id: soRow.warehouse_id || null,
          status: 'allocated'
        }))
        const { error } = await supabase.from('serial_numbers').insert(rows as any)
        if (error) throw error
      }
      // Mark the order as scanned once any serials are captured (keeps the stepper at stage 1).
      if (totalScanned > 0 && ['draft', 'pending', 'approved'].includes(soRow.status)) {
        await supabase.from('sales_orders').update({ status: 'picking' }).eq('id', soRow.id)
      }
      notify('success', `${totalScanned} serial(s) saved for ${soRow.so_no}`)
      onDone?.(); load()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not save serials')
    } finally { setBusy(false) }
  }

  if (loading) return <p className="py-6 text-center text-sm text-ink-faint">Loading…</p>

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Icon name="qr_code_scanner" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-brand-600" />
          <input ref={scanRef} value={scan} autoFocus placeholder="Scan / type serial, then Enter"
            onChange={e => setScan(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSerial(scan) } }}
            className="fiori-input w-full pl-10" />
        </div>
        <span className="text-sm text-ink-soft">Scanned <span className="font-semibold text-ink">{formatNumber(totalScanned)}</span> / {formatNumber(totalOrdered)}</span>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-surface-sunken text-[11px] uppercase tracking-wide text-ink-faint">
                <th className="px-3 py-2 text-left font-semibold">Material</th>
                <th className="px-3 py-2 text-right font-semibold">Ordered</th>
                <th className="px-3 py-2 text-right font-semibold">Scanned</th>
                <th className="px-3 py-2 text-left font-semibold">Serials</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const done = l.serials.length === l.ordered
                return (
                  <tr key={l.item_id} className="border-t border-surface-line align-top">
                    <td className="px-3 py-2"><div className="font-mono text-xs text-ink">{l.code}</div><div className="truncate text-xs text-ink-soft">{l.name}{l.uom ? ' · ' + l.uom : ''}</div></td>
                    <td className="px-3 py-2 text-right">{formatNumber(l.ordered)}</td>
                    <td className="px-3 py-2 text-right"><Badge tone={done ? 'positive' : l.serials.length > l.ordered ? 'critical' : 'neutral'}>{l.serials.length}/{l.ordered}</Badge></td>
                    <td className="px-3 py-2">
                      {l.serials.length === 0 ? <span className="text-xs text-ink-faint">—</span> : (
                        <div className="flex flex-wrap gap-1.5">
                          {l.serials.map((s, si) => (
                            <span key={si} className="inline-flex items-center gap-1 rounded-md border border-surface-line bg-surface px-2 py-0.5 font-mono text-[11px] text-ink">
                              {s.serial_no}
                              {canEdit && <button type="button" onClick={() => removeSerial(i, si)} className="text-ink-faint hover:text-bad"><Icon name="close" className="text-[13px]" /></button>}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {lines.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-ink-faint">No lines on this order</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-surface-line bg-surface-sunken px-4 py-3">
          <span className="text-sm text-ink-soft">{totalScanned === totalOrdered && totalOrdered > 0 ? 'All units scanned ✓' : `${totalOrdered - totalScanned} unit(s) left`}</span>
          {canEdit && <Button icon="save" loading={busy} onClick={save} disabled={totalScanned === 0 && removedIds.length === 0}>Save serials</Button>}
        </div>
      </Card>
      <p className="text-xs text-ink-faint">The serial prefix matches the material code, so the line is detected automatically. These serials feed the SAP prework export and the delivery challan — no re-typing.</p>
    </div>
  )
}

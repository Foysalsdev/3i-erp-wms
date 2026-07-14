import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { formatNumber } from '@/lib/utils'
import { normaliseSerial, describeSerialHistory, type SerialHistoryItem } from '@/lib/serials'
import { SerialHistoryModal } from '@/components/shared/SerialHistoryModal'

const num = (v: number | string | null | undefined): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

interface SLine {
  item_id: string; product_id: string; code: string; name: string; uom: string
  china?: string | null; bar?: string | null   // alternate prefixes for serial normalisation
  ordered: number
  serials: { id?: string; serial_no: string }[]   // existing rows keep their id
}

// Serial scan stage for a single order (opened from the order, not a tab).
// Mirrors the SAP delivery flow: pick a line from the item overview, open its
// serial grid (one row per ordered unit, Excel-sheet style), fill every row,
// confirm — that line is then complete. These serials are the single source
// for both the SAP prework export and the delivery challan — no re-typing.
export function SerialScan({ lockSoId, onDone }: { lockSoId: string; onDone?: () => void }) {
  const { currentClientId, can } = useAuth()
  const notify = useUI(s => s.notify)
  const canEdit = can('outbound.create') || can('outbound.edit')
  const [soRow, setSoRow] = useState<Pick<Tables<'sales_orders'>, 'id' | 'so_no' | 'customer_id' | 'warehouse_id' | 'status' | 'reference_no'> | null>(null)
  const [lines, setLines] = useState<SLine[]>([])
  const [loading, setLoading] = useState(true)
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const [history, setHistory] = useState<SerialHistoryItem[] | null>(null)

  useEffect(() => { if (currentClientId && lockSoId) load() /* eslint-disable-next-line */ }, [currentClientId, lockSoId])

  const load = async () => {
    setLoading(true)
    try {
      const { data: order } = await supabase.from('sales_orders').select('id,so_no,customer_id,warehouse_id,status,reference_no').eq('id', lockSoId).single()
      setSoRow(order)
      const { data: items } = await supabase.from('sales_order_items').select('id,product_id,qty').eq('so_id', lockSoId)
      const pids = (items ?? []).map(i => i.product_id).filter((x): x is string => !!x)
      const guard = pids.length ? pids : ['00000000-0000-0000-0000-000000000000']
      const [{ data: prods }, { data: existing }] = await Promise.all([
        supabase.from('products').select('id,material_code,name,uom,china_code,barcode').in('id', guard),
        supabase.from('serial_numbers').select('id,serial_no,product_id,so_item_id').eq('reference_no', order?.so_no ?? '__none__')
      ])
      type ProdInfo = Pick<Tables<'products'>, 'id' | 'material_code' | 'name' | 'uom' | 'china_code' | 'barcode'>
      const pmap: Record<string, ProdInfo> = {}; (prods ?? []).forEach(p => { pmap[p.id] = p })
      setLines((items ?? []).map(it => {
        const p: Partial<ProdInfo> = (it.product_id ? pmap[it.product_id] : undefined) ?? {}
        const serials = (existing ?? []).filter(s => s.so_item_id === it.id || (!s.so_item_id && s.product_id === it.product_id))
          .map(s => ({ id: s.id, serial_no: s.serial_no }))
        return { item_id: it.id, product_id: it.product_id ?? '', code: p.material_code ?? '?', name: p.name ?? 'Unknown', uom: p.uom ?? '', china: p.china_code ?? null, bar: p.barcode ?? null, ordered: num(it.qty), serials }
      }))
    } finally { setLoading(false) }
  }

  const totalScanned = lines.reduce((s, l) => s + l.serials.length, 0)
  const totalOrdered = lines.reduce((s, l) => s + l.ordered, 0)

  // Tab-separated so a paste into Excel/Sheets lands as two clean columns.
  const copyAll = async () => {
    if (totalScanned === 0) { notify('info', 'No serials scanned yet'); return }
    const tsv = ['Model\tSerial', ...lines.flatMap(l => l.serials.map(s => `${l.code}\t${s.serial_no}`))].join('\n')
    await navigator.clipboard.writeText(tsv)
    notify('success', `Copied ${totalScanned} serial(s) — paste directly into Excel`)
  }

  // Persist one line's grid: insert new serials, delete cleared ones, and bump
  // the order to "picking" the first time anything gets captured.
  const saveLine = async (idx: number, entries: { id?: string; serial_no: string }[], removedIds: string[]) => {
    const line = lines[idx]
    const fresh = entries.filter(e => !e.id).map(e => ({ serial_no: e.serial_no, product_id: line.product_id, so_item_id: line.item_id }))
    // Serials that already exist on an EARLIER transaction (return/replacement
    // coming back out) are allowed: they get re-assigned to this order and the
    // user sees a small history popup. Duplicates within THIS order are still
    // blocked by the grid before we ever get here.
    let reused: Pick<Tables<'serial_numbers'>, 'id' | 'serial_no' | 'reference_no' | 'status'>[] = []
    if (fresh.length) {
      const { data: clash } = await supabase.from('serial_numbers').select('id,serial_no,reference_no,status')
        .in('serial_no', fresh.map(f => f.serial_no))
      reused = (clash ?? []).filter(c => c.reference_no !== soRow!.so_no)
    }
    if (removedIds.length) {
      const { error } = await supabase.from('serial_numbers').delete().in('id', removedIds)
      if (error) throw error
    }
    let hist: SerialHistoryItem[] = []
    if (reused.length) {
      hist = await describeSerialHistory(currentClientId!, reused)   // capture before overwriting
      const { error } = await supabase.from('serial_numbers')
        .update({ so_item_id: line.item_id, reference_no: soRow!.so_no, warehouse_id: soRow!.warehouse_id || null, status: 'reserved' })
        .in('id', reused.map(r => r.id))
      if (error) throw error
    }
    const reusedSet = new Set(reused.map(r => r.serial_no))
    const inserts = fresh.filter(f => !reusedSet.has(f.serial_no))
    if (inserts.length) {
      const rows = inserts.map(f => ({
         product_id: f.product_id, serial_no: f.serial_no,
        so_item_id: f.so_item_id, reference_no: soRow!.so_no, warehouse_id: soRow!.warehouse_id || null,
        status: 'reserved' // serial_numbers_status_check only allows in_stock/reserved/delivered/returned/damaged/quarantine/scrapped
      }))
      const { error } = await supabase.from('serial_numbers').insert(rows)
      if (error) throw error
    }
    if (hist.length) setHistory(hist)
    const newTotal = lines.reduce((s, l, i) => s + (i === idx ? entries.length : l.serials.length), 0)
    if (newTotal > 0 && soRow!.status === 'approved') {
      await supabase.from('sales_orders').update({ status: 'picking' }).eq('id', soRow!.id)
    }
    notify('success', `${line.code}: ${entries.length}/${line.ordered} serial(s) saved`)
    onDone?.()
    await load()
    setActiveIdx(null)
  }

  if (loading) return <p className="py-6 text-center text-sm text-ink-faint">Loading…</p>

  // The order must clear approval before the warehouse commits stock/labour to
  // it — picking is blocked here too, not just via the "Approve" action menu,
  // since this stage can also be opened directly from the order's Scan tab.
  const needsApproval = soRow && ['draft', 'pending', 'rejected'].includes(soRow.status)
  if (needsApproval) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-500/30 dark:bg-amber-500/10">
        <Icon name="lock_clock" className="text-[28px] text-amber-600 dark:text-amber-400" />
        <p className="text-sm font-semibold text-ink">Order not yet approved</p>
        <p className="text-xs text-ink-soft">This order must be approved before the warehouse can pick & scan items.</p>
      </div>
    )
  }

  if (activeIdx !== null) {
    return (
      <SerialGrid line={lines[activeIdx]}
        otherSerials={new Set(lines.filter((_, i) => i !== activeIdx).flatMap(l => l.serials.map(s => s.serial_no.toLowerCase())))}
        canEdit={canEdit}
        onBack={() => setActiveIdx(null)}
        onConfirm={(entries, removedIds) => saveLine(activeIdx, entries, removedIds)} />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-soft">Scanned <span className="font-semibold text-ink">{formatNumber(totalScanned)}</span> / {formatNumber(totalOrdered)}</span>
        <Button type="button" variant="secondary" size="sm" icon="content_copy" onClick={copyAll}>Copy (Excel)</Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-surface-sunken text-[11px] uppercase tracking-wide text-ink-faint">
                <th className="px-3 py-2 text-left font-semibold">Material</th>
                <th className="px-3 py-2 text-right font-semibold">Ordered</th>
                <th className="px-3 py-2 text-right font-semibold">Scanned</th>
                <th className="px-3 py-2 text-right font-semibold" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const done = l.serials.length === l.ordered
                return (
                  <tr key={l.item_id} onClick={() => canEdit && setActiveIdx(i)}
                    className={'border-t border-surface-line ' + (canEdit ? 'cursor-pointer hover:bg-surface-sunken' : '')}>
                    <td className="px-3 py-2.5"><div className="font-mono text-xs text-ink">{l.code}</div><div className="truncate text-xs text-ink-soft">{l.name}{l.uom ? ' · ' + l.uom : ''}</div></td>
                    <td className="px-3 py-2.5 text-right">{formatNumber(l.ordered)}</td>
                    <td className="px-3 py-2.5 text-right"><Badge tone={done ? 'positive' : 'neutral'}>{l.serials.length}/{l.ordered}</Badge></td>
                    <td className="px-3 py-2.5 text-right">{canEdit && <Icon name="chevron_right" className="text-[18px] text-ink-faint" />}</td>
                  </tr>
                )
              })}
              {lines.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-ink-faint">No lines on this order</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-ink-faint">Click a line to open its serial grid (one row per unit) — fill the rows and confirm to complete that line. Use "Copy (Excel)" to paste the full Model/Serial list elsewhere.</p>
      {history && <SerialHistoryModal items={history} onClose={() => setHistory(null)} />}
    </div>
  )
}

// Excel-sheet-style grid: one input row per ordered unit. Enter validates the
// row and jumps to the next empty one — built for keyboard-wedge scanners.
function SerialGrid({ line, otherSerials, canEdit, onBack, onConfirm }: {
  line: SLine; otherSerials: Set<string>; canEdit: boolean
  onBack: () => void; onConfirm: (entries: { id?: string; serial_no: string }[], removedIds: string[]) => Promise<void>
}) {
  const notify = useUI(s => s.notify)
  const [rows, setRows] = useState<{ id?: string; serial_no: string }[]>(() => {
    const filled = line.serials.map(s => ({ id: s.id, serial_no: s.serial_no }))
    const blanks = Array.from({ length: Math.max(0, line.ordered - filled.length) }, () => ({ serial_no: '' }))
    return [...filled, ...blanks]
  })
  const [busy, setBusy] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    const firstBlank = rows.findIndex(r => !r.serial_no.trim())
    if (firstBlank >= 0) inputRefs.current[firstBlank]?.focus()
    // eslint-disable-next-line
  }, [])

  const setValue = (i: number, v: string) => setRows(rs => rs.map((r, idx) => idx === i ? { ...r, serial_no: v } : r))

  // Validate + normalise against THIS line's product (factory prefix -> material
  // code). `matched` is false when the serial belongs to a different product.
  const validate = (raw: string) => normaliseSerial(raw, { material_code: line.code, china_code: line.china, barcode: line.bar })
  const normVal = (raw: string) => validate(raw).serial

  // Returns false (and clears the field) when the value is the wrong item,
  // duplicates another row in this grid, or a serial already scanned elsewhere.
  const commitRow = (i: number) => {
    const { serial: v, matched } = validate(rows[i].serial_no)
    if (v !== rows[i].serial_no) setValue(i, v)
    if (!v) return true
    if (!matched) {
      notify('error', `Wrong item — ${v} doesn't match ${line.code}`)
      setValue(i, '')
      return false
    }
    const dupInGrid = rows.some((r, idx) => idx !== i && normVal(r.serial_no).toLowerCase() === v.toLowerCase())
    if (dupInGrid || otherSerials.has(v.toLowerCase())) {
      notify('error', `Serial already scanned: ${v}`)
      setValue(i, '')
      return false
    }
    return true
  }

  // Excel column / multi-line paste: fill this row, then the next empty ones.
  const pasteFill = (i: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text')
    if (!/[\r\n\t]/.test(text)) return
    e.preventDefault()
    let wrong = 0
    const vals: string[] = []
    for (const part of text.split(/[\r\n\t]+/)) {
      const { serial, matched } = validate(part)
      if (!serial) continue
      if (!matched) { wrong++; continue }   // skip wrong-item serials on paste
      vals.push(serial)
    }
    if (wrong) notify('error', `Wrong item — ${wrong} serial(s) don't match ${line.code}`)
    setRows(rs => {
      const out = [...rs]
      let idx = i
      for (const v of vals) {
        while (idx < out.length && out[idx].serial_no.trim()) idx++
        if (idx >= out.length) break
        out[idx] = { ...out[idx], serial_no: v }
        idx++
      }
      return out
    })
  }

  const focusNextEmpty = (from: number) => {
    const next = rows.findIndex((r, idx) => idx > from && !r.serial_no.trim())
    const target = next >= 0 ? next : (from + 1 < rows.length ? from + 1 : -1)
    if (target >= 0) inputRefs.current[target]?.focus()
  }

  const filledCount = rows.filter(r => r.serial_no.trim()).length

  const confirm = async () => {
    // Normalise everything first, then validate on the normalised values (a
    // mid-loop setState wouldn't be visible to later iterations).
    const normRows = rows.map(r => ({ ...r, serial_no: normVal(r.serial_no) }))
    for (let i = 0; i < normRows.length; i++) {
      const v = normRows[i].serial_no
      if (!v) continue
      if (!validate(v).matched) { notify('error', `Wrong item — ${v} doesn't match ${line.code}`); return }
      const dup = normRows.some((r, idx) => idx !== i && r.serial_no.toLowerCase() === v.toLowerCase())
      if (dup || otherSerials.has(v.toLowerCase())) { notify('error', `Serial already scanned: ${v}`); return }
    }
    setRows(normRows)
    const original = new Set(line.serials.map(s => s.id).filter(Boolean) as string[])
    // A previously-saved row only stays "kept" if it still has a value —
    // clearing a filled row marks its id for deletion.
    const kept = new Set(normRows.filter(r => r.serial_no).map(r => r.id).filter(Boolean) as string[])
    const removedIds = [...original].filter(id => !kept.has(id))
    setBusy(true)
    try { await onConfirm(normRows.filter(r => r.serial_no), removedIds) }
    catch (e: any) { notify('error', e?.message ?? 'Could not save serials') }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-ink-soft hover:text-brand-700">
        <Icon name="arrow_back" className="text-[18px]" /> Back to items
      </button>

      <Card className="overflow-hidden">
        <div className="border-b border-surface-line bg-surface-sunken px-4 py-3">
          <p className="font-mono text-sm font-semibold text-ink">{line.code}</p>
          <p className="text-xs text-ink-soft">{line.name}{line.uom ? ' · ' + line.uom : ''} — {filledCount}/{line.ordered} filled</p>
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-surface-sunken text-[11px] uppercase tracking-wide text-ink-faint">
                <th className="w-12 px-3 py-2 text-left font-semibold">#</th>
                <th className="px-3 py-2 text-left font-semibold">Serial No</th>
                {canEdit && <th className="w-10 px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-surface-line">
                  <td className="px-3 py-1.5 text-ink-faint">{i + 1}</td>
                  <td className="px-3 py-1.5">
                    <input ref={el => { inputRefs.current[i] = el }} value={r.serial_no} disabled={!canEdit}
                      onChange={e => setValue(i, e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (commitRow(i)) focusNextEmpty(i) } }}
                      onPaste={e => pasteFill(i, e)}
                      placeholder="Scan or paste serial(s)…"
                      className="fiori-input w-full font-mono" />
                  </td>
                  {canEdit && (
                    <td className="px-3 py-1.5 text-center">
                      {r.serial_no && <button type="button" onClick={() => setValue(i, '')} className="text-ink-faint hover:text-bad"><Icon name="close" className="text-[15px]" /></button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canEdit && (
          <div className="flex items-center justify-between border-t border-surface-line bg-surface-sunken px-4 py-3">
            <span className="text-xs text-ink-faint">Press Enter after each scan to jump to the next row.</span>
            <Button icon="check" loading={busy} onClick={confirm}>OK — Confirm line</Button>
          </div>
        )}
      </Card>
    </div>
  )
}

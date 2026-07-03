import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { formatNumber } from '@/lib/utils'
import { normaliseSerial } from '@/lib/serials'

const num = (v: any): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

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
  const [soRow, setSoRow] = useState<any>(null)
  const [lines, setLines] = useState<SLine[]>([])
  const [loading, setLoading] = useState(true)
  const [activeIdx, setActiveIdx] = useState<number | null>(null)

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
        (supabase as any).from('products').select('id,material_code,name,uom,china_code,barcode').in('id', guard),
        supabase.from('serial_numbers').select('id,serial_no,product_id,so_item_id').eq('client_id', currentClientId!).eq('reference_no', order?.so_no ?? '__none__')
      ])
      const pmap: Record<string, any> = {}; (prods ?? []).forEach((p: any) => { pmap[p.id] = p })
      setLines((items ?? []).map((it: any) => {
        const p = pmap[it.product_id] ?? {}
        const serials = (existing ?? []).filter((s: any) => s.so_item_id === it.id || (!s.so_item_id && s.product_id === it.product_id))
          .map((s: any) => ({ id: s.id, serial_no: s.serial_no }))
        return { item_id: it.id, product_id: it.product_id, code: p.material_code ?? '?', name: p.name ?? 'Unknown', uom: p.uom ?? '', china: p.china_code ?? null, bar: p.barcode ?? null, ordered: num(it.qty), serials }
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
        status: 'reserved' // serial_numbers_status_check only allows in_stock/reserved/delivered/returned/damaged/quarantine/scrapped
      }))
      const { error } = await supabase.from('serial_numbers').insert(rows as any)
      if (error) throw error
    }
    const newTotal = lines.reduce((s, l, i) => s + (i === idx ? entries.length : l.serials.length), 0)
    if (newTotal > 0 && ['draft', 'pending', 'approved'].includes(soRow.status)) {
      await supabase.from('sales_orders').update({ status: 'picking' }).eq('id', soRow.id)
    }
    notify('success', `${line.code}: ${entries.length}/${line.ordered} serial(s) saved`)
    onDone?.()
    await load()
    setActiveIdx(null)
  }

  if (loading) return <p className="py-6 text-center text-sm text-ink-faint">Loading…</p>

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

  // Factory prefix (china code / barcode) -> material code, per product master.
  const normVal = (raw: string) => normaliseSerial(raw, { material_code: line.code, china_code: line.china, barcode: line.bar }).serial

  // Returns false (and clears the field) when the value duplicates another
  // row in this grid or a serial already scanned on a different line.
  const commitRow = (i: number) => {
    const v = normVal(rows[i].serial_no)
    if (v !== rows[i].serial_no) setValue(i, v)
    if (!v) return true
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
    const vals = text.split(/[\r\n\t]+/).map(s => normVal(s)).filter(Boolean)
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
                      className="w-full rounded-md border border-brand-200/70 bg-surface px-2.5 py-1.5 font-mono text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 disabled:bg-surface-sunken" />
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

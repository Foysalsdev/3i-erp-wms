import { useMemo, useRef, useState } from 'react'
import type { ClipboardEvent as RClip } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Select } from '@/components/ui/Field'
import { formatNumber } from '@/lib/utils'

export interface PickProduct {
  id: string; material_code: string; name: string
  barcode?: string | null; category?: string | null; uom?: string | null; plant?: string | null
}

export interface LineRow {
  id?: string
  product_id: string
  code?: string
  qty: number | string
  expected_qty?: number | string
  unit_price: number | string
  basic_price?: number | string
  vat_rate?: number | string
  stock_status?: string
  location_id?: string
  so_item_id?: string
  remarks?: string
}

const num = (v: number | string | undefined): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

// All-in unit price = basic + VAT; line total = qty × all-in unit price.
export const lineUnitPrice = (r: LineRow): number => num(r.basic_price) * (1 + num(r.vat_rate) / 100)
export const lineTotal = (r: LineRow): number => num(r.qty) * lineUnitPrice(r)

// Fast document-style entry: type/scan a material code + qty, or paste a
// Material+Qty block straight from Excel (one row per line). UoM / Category /
// Plant are pulled from the product master and shown on each line (SAP-style).
export function LineItems({ rows, onChange, products, locations, variant, stock, priced }:
  {
    rows: LineRow[]
    onChange: (rows: LineRow[]) => void
    products: PickProduct[]
    locations?: { id: string; location_code: string }[]
    variant: 'po' | 'grn' | 'out'
    stock?: Record<string, number>
    priced?: boolean
  }) {
  const avail = (pid?: string) => (pid && stock) ? (stock[pid] ?? 0) : undefined
  const isGrn = variant === 'grn'
  const [code, setCode] = useState('')
  const [qty, setQty] = useState('')
  const [open, setOpen] = useState(false)
  const [acIdx, setAcIdx] = useState(0)
  const [pasteNote, setPasteNote] = useState('')
  const codeRef = useRef<HTMLInputElement>(null)
  const qtyRef = useRef<HTMLInputElement>(null)

  const byId = useMemo(() => { const m: Record<string, PickProduct> = {}; products.forEach(p => { m[p.id] = p }); return m }, [products])
  const byCode = (raw: string) => {
    const t = (raw || '').trim().toLowerCase(); if (!t) return undefined
    return products.find(p => p.material_code.toLowerCase() === t || (p.barcode ?? '').toLowerCase() === t)
  }
  const matches = useMemo(() => {
    const t = code.trim().toLowerCase(); if (!t) return [] as PickProduct[]
    const starts = (p: PickProduct) => p.material_code.toLowerCase().startsWith(t) || p.name.toLowerCase().startsWith(t)
    return products
      .filter(p => p.material_code.toLowerCase().includes(t) || p.name.toLowerCase().includes(t) || (p.barcode ?? '').toLowerCase().includes(t))
      .sort((a, b) => Number(starts(b)) - Number(starts(a))).slice(0, 7)
  }, [products, code])
  const valid = byCode(code)

  const addRow = (p: PickProduct, q: number) => {
    const idx = rows.findIndex(r => r.product_id === p.id)
    if (idx >= 0) onChange(rows.map((r, i) => i === idx ? { ...r, qty: num(r.qty) + q } : r))
    else onChange([...rows, { product_id: p.id, code: p.material_code, qty: q, expected_qty: '', unit_price: '', basic_price: '', vat_rate: 15, stock_status: 'good', location_id: '', remarks: '' }])
    setCode(''); setQty(''); setOpen(false); setAcIdx(0); setPasteNote('')
    requestAnimationFrame(() => codeRef.current?.focus())
  }
  const commitAdd = () => {
    const p = byCode(code) ?? matches[acIdx]
    if (!p) return
    addRow(p, num(qty) > 0 ? num(qty) : 1)
  }
  const setRow = (i: number, patch: Partial<LineRow>) => onChange(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  const removeRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i))

  // Paste a Material+Qty block from Excel (tab / comma / semicolon separated; one product per line).
  const onPaste = (e: RClip<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text'); if (!/[\n\t]/.test(text)) return
    e.preventDefault()
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    const next = [...rows]; let added = 0, skipped = 0
    for (const line of lines) {
      const cells = line.split(/\t|,|;/).map(c => c.trim())
      const p = byCode(cells[0]); if (!p) { skipped++; continue }
      const q = num(cells[1]) || 1
      const idx = next.findIndex(r => r.product_id === p.id)
      if (idx >= 0) next[idx] = { ...next[idx], qty: num(next[idx].qty) + q }
      else next.push({ product_id: p.id, code: p.material_code, qty: q, expected_qty: '', unit_price: '', basic_price: '', vat_rate: 15, stock_status: 'good', location_id: '' })
      added++
    }
    if (added) { onChange(next); setCode(''); setQty('') }
    setPasteNote(`${added} line(s) added${skipped ? ` · ${skipped} unknown code(s) skipped` : ''}`)
    requestAnimationFrame(() => codeRef.current?.focus())
  }

  const meta = (p?: PickProduct) => [p?.uom, p?.category, p?.plant].filter(Boolean).join(' · ')
  const totalQty = rows.reduce((s, r) => s + num(r.qty), 0)
  const accent = valid ? 'border-ok ring-1 ring-ok/40' : (code.trim() ? 'border-bad/50' : 'border-surface-line')

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-ink-soft">Line items</h4>

      <div className="flex flex-wrap items-start gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Icon name="qr_code_scanner" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-brand-600" />
          {valid && <Icon name="check_circle" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-ok" />}
          <input ref={codeRef} value={code} placeholder="Material code or scan barcode"
            onChange={e => { setCode(e.target.value); setOpen(true); setAcIdx(0) }}
            onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onPaste={onPaste}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setAcIdx(a => Math.min(a + 1, matches.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setAcIdx(a => Math.max(a - 1, 0)) }
              else if (e.key === 'Enter') { e.preventDefault(); if (byCode(code)) qtyRef.current?.focus(); else if (matches[acIdx]) { setCode(matches[acIdx].material_code); setOpen(false); qtyRef.current?.focus() } }
            }}
            className={'fiori-input pl-10 pr-9 ' + accent} />
          {open && matches.length > 0 && (
            <div className="absolute left-0 top-full z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-surface-line bg-surface shadow-fiori-lg">
              {matches.map((p, si) => (
                <button key={p.id} type="button" onMouseDown={e => { e.preventDefault(); setCode(p.material_code); setOpen(false); requestAnimationFrame(() => qtyRef.current?.focus()) }}
                  className={'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ' + (si === acIdx ? 'bg-surface-sunken' : 'hover:bg-surface-sunken')}>
                  <span className="font-mono font-medium text-ink">{p.material_code}</span><span className="truncate text-ink-soft">{p.name}{meta(p) ? ' · ' + meta(p) : ''}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end">
          <input ref={qtyRef} type="number" step="any" value={qty} placeholder="Qty"
            onChange={e => setQty(e.target.value)} onPaste={onPaste}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitAdd() } }}
            className="fiori-input w-24 text-right" />
          {valid && stock && <span className={'mt-1 text-[11px] font-medium ' + ((avail(valid.id) ?? 0) > 0 ? 'text-ok' : 'text-bad')}>Saleable: {formatNumber(avail(valid.id) ?? 0)}</span>}
        </div>
        <button type="button" onClick={commitAdd} disabled={!valid}
          className="inline-flex h-[42px] items-center gap-1 rounded-lg bg-brand-500 px-4 text-sm font-medium text-coal-900 disabled:opacity-40">
          <Icon name="add" className="text-[18px]" /> Add
        </button>
      </div>
      {pasteNote && <p className="text-xs font-medium text-brand-700">{pasteNote}</p>}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-surface-line py-6 text-center text-sm text-ink-faint">No items yet — add a material code above</p>
      ) : isGrn ? (
        <div className="overflow-x-auto rounded-lg border border-surface-line">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-surface-line bg-surface-sunken text-left text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                <th className="w-8 px-3 py-2 text-center">#</th><th className="px-3 py-2">Item</th>
                <th className="w-16 px-2 py-2 text-right">Exp</th><th className="w-28 px-2 py-2">Condition</th><th className="w-32 px-2 py-2">Location</th><th className="w-20 px-2 py-2 text-right">Recd</th><th className="w-10 px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => { const p = byId[r.product_id]; return (
                <tr key={i} className="border-b border-surface-line/70 last:border-0">
                  <td className="px-3 py-2 text-center text-xs text-ink-faint">{i + 1}</td>
                  <td className="px-3 py-2"><div className="font-mono text-sm text-ink">{p?.material_code ?? r.code ?? '?'}</div><div className="truncate text-xs text-ink-soft">{p?.name ?? 'Unknown product'}{meta(p) ? ' · ' + meta(p) : ''}</div></td>
                  <td className="px-2 py-2 text-right"><input type="number" step="any" value={r.expected_qty ?? ''} onChange={e => setRow(i, { expected_qty: e.target.value })} className="fiori-input h-8 w-16 text-right" /></td>
                  <td className="px-2 py-2"><Select value={r.stock_status ?? 'good'} onChange={e => setRow(i, { stock_status: e.target.value })} className="h-8 w-full text-xs"><option value="good">Good</option><option value="damaged">Damaged</option><option value="quarantine">Quarantine</option></Select></td>
                  <td className="px-2 py-2"><Select value={r.location_id ?? ''} onChange={e => setRow(i, { location_id: e.target.value })} className="h-8 w-full text-xs"><option value="">Location</option>{(locations ?? []).map(l => <option key={l.id} value={l.id}>{l.location_code}</option>)}</Select></td>
                  <td className="px-2 py-2 text-right"><input type="number" step="any" value={r.qty} onChange={e => setRow(i, { qty: e.target.value })} className="fiori-input h-8 w-20 text-right" /></td>
                  <td className="px-2 py-2 text-center"><button type="button" onClick={() => removeRow(i)} className="rounded-md p-1.5 text-ink-faint hover:bg-bad/10 hover:text-bad" title="Remove"><Icon name="close" className="text-[16px]" /></button></td>
                </tr> )})}
            </tbody>
          </table>
          <div className="flex justify-between border-t border-surface-line bg-surface-sunken px-3 py-2 text-xs text-ink-soft"><span>{rows.length} line(s)</span><span>Total qty <span className="font-medium text-ink">{formatNumber(totalQty)}</span></span></div>
        </div>
      ) : priced ? (
        <div className="overflow-x-auto rounded-lg border border-surface-line">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-surface-line bg-surface-sunken text-left text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                <th className="w-8 px-3 py-2 text-center">#</th><th className="px-3 py-2">Item</th>
                <th className="w-16 px-2 py-2 text-right">Qty</th><th className="w-28 px-2 py-2 text-right">Basic / unit</th>
                <th className="w-20 px-2 py-2 text-right">VAT %</th><th className="w-32 px-2 py-2 text-right">Line total</th><th className="w-10 px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => { const p = byId[r.product_id]; return (
                <tr key={i} className="border-b border-surface-line/70 last:border-0">
                  <td className="px-3 py-2 text-center text-xs text-ink-faint">{i + 1}</td>
                  <td className="px-3 py-2"><div className="font-mono text-sm text-ink">{p?.material_code ?? r.code ?? '?'}</div><div className="truncate text-xs text-ink-soft">{p?.name ?? 'Unknown product'}{meta(p) ? ' · ' + meta(p) : ''}</div></td>
                  <td className="px-2 py-2 text-right"><input type="number" step="any" value={r.qty} onChange={e => setRow(i, { qty: e.target.value })} className="fiori-input h-8 w-16 text-right" /></td>
                  <td className="px-2 py-2 text-right"><input type="number" step="any" value={r.basic_price ?? ''} onChange={e => setRow(i, { basic_price: e.target.value })} className="fiori-input h-8 w-24 text-right" placeholder="0.00" /></td>
                  <td className="px-2 py-2 text-right"><input type="number" step="any" value={r.vat_rate ?? ''} onChange={e => setRow(i, { vat_rate: e.target.value })} className="fiori-input h-8 w-16 text-right" placeholder="15" /></td>
                  <td className="px-2 py-2 text-right font-medium text-ink">{formatNumber(lineTotal(r))}</td>
                  <td className="px-2 py-2 text-center"><button type="button" onClick={() => removeRow(i)} className="rounded-md p-1.5 text-ink-faint hover:bg-bad/10 hover:text-bad" title="Remove"><Icon name="close" className="text-[16px]" /></button></td>
                </tr> )})}
            </tbody>
          </table>
          <div className="flex justify-between border-t border-surface-line bg-surface-sunken px-3 py-2 text-xs text-ink-soft"><span>{rows.length} line(s) · Total qty <span className="font-medium text-ink">{formatNumber(totalQty)}</span></span><span>Total amount <span className="font-medium text-ink">{formatNumber(rows.reduce((s, r) => s + lineTotal(r), 0))}</span></span></div>
        </div>
      ) : (
        <div className="divide-y divide-surface-line overflow-hidden rounded-lg border border-surface-line">
          {rows.map((r, i) => {
            const p = byId[r.product_id]
            const a = avail(r.product_id)
            return (
              <div key={i} className="px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="w-4 shrink-0 text-center text-xs text-ink-faint">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-sm text-ink">{p?.material_code ?? r.code ?? '?'}</div>
                    <div className="truncate text-xs text-ink-soft">{p?.name ?? 'Unknown product'}{meta(p) ? ' · ' + meta(p) : ''}</div>
                  </div>
                  {stock && a !== undefined && <span className={'shrink-0 text-xs ' + (a < num(r.qty) ? 'text-bad' : 'text-ink-faint')}>Avail {formatNumber(a)}</span>}
                  <input type="number" step="any" value={r.qty} onChange={e => setRow(i, { qty: e.target.value })} className="fiori-input h-8 w-16 shrink-0 text-right" placeholder="Qty" />
                  <button type="button" onClick={() => removeRow(i)} className="shrink-0 rounded-md p-1.5 text-ink-faint hover:bg-bad/10 hover:text-bad" title="Remove"><Icon name="close" className="text-[16px]" /></button>
                </div>
                <input value={r.remarks ?? ''} onChange={e => setRow(i, { remarks: e.target.value })} placeholder="Remarks (optional)" className="fiori-input mt-2 h-8 w-full text-xs" />
              </div>
            )
          })}
          <div className="flex justify-between bg-surface-sunken px-3 py-2 text-xs text-ink-soft"><span>{rows.length} line(s)</span><span>Total qty <span className="font-medium text-ink">{formatNumber(totalQty)}</span></span></div>
        </div>
      )}
    </div>
  )
}

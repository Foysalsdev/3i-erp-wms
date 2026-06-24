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
  stock_status?: string
  location_id?: string
}

const num = (v: number | string | undefined): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

// Fast document-style entry: type/scan a material code + qty, or paste a
// Material+Qty block straight from Excel (one row per line). UoM / Category /
// Plant are pulled from the product master and shown on each line (SAP-style).
export function LineItems({ rows, onChange, products, locations, variant }:
  {
    rows: LineRow[]
    onChange: (rows: LineRow[]) => void
    products: PickProduct[]
    locations?: { id: string; location_code: string }[]
    variant: 'po' | 'grn' | 'out'
  }) {
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
    else onChange([...rows, { product_id: p.id, code: p.material_code, qty: q, expected_qty: '', unit_price: '', stock_status: 'good', location_id: '' }])
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
      else next.push({ product_id: p.id, code: p.material_code, qty: q, expected_qty: '', unit_price: '', stock_status: 'good', location_id: '' })
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
      <h4 className="text-sm font-medium text-ink">Line items <span className="font-normal text-ink-faint">— type / scan a code, or paste a Material + Qty block from Excel</span></h4>

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
                  className={'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ' + (si === acIdx ? 'bg-brand-50' : 'hover:bg-surface-sunken')}>
                  <span className="font-mono font-medium text-ink">{p.material_code}</span><span className="truncate text-ink-soft">{p.name}{meta(p) ? ' · ' + meta(p) : ''}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <input ref={qtyRef} type="number" step="any" value={qty} placeholder="Qty"
          onChange={e => setQty(e.target.value)} onPaste={onPaste}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitAdd() } }}
          className="fiori-input w-24 text-right" />
        <button type="button" onClick={commitAdd} disabled={!valid}
          className="inline-flex h-[42px] items-center gap-1 rounded-lg bg-brand-500 px-4 text-sm font-medium text-coal-900 disabled:opacity-40">
          <Icon name="add" className="text-[18px]" /> Add
        </button>
      </div>
      {pasteNote && <p className="text-xs font-medium text-brand-700">{pasteNote}</p>}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-surface-line py-6 text-center text-sm text-ink-faint">No items yet — add a material code above</p>
      ) : (
        <div className="divide-y divide-surface-line overflow-hidden rounded-lg border border-surface-line">
          {rows.map((r, i) => {
            const p = byId[r.product_id]
            return (
              <div key={i} className="flex flex-wrap items-center gap-3 px-3 py-2 hover:bg-surface-sunken/40">
                <span className="w-7 shrink-0 text-center text-xs font-medium text-ink-faint">{i + 1}</span>
                <Icon name="check_circle" className="text-[16px] text-ok" />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-sm text-ink">{p?.material_code ?? r.code ?? '?'}</div>
                  <div className="truncate text-xs text-ink-soft">{p?.name ?? 'Unknown product'}{meta(p) ? ' · ' + meta(p) : ''}</div>
                </div>
                {isGrn && (
                  <label className="flex items-center gap-1 text-xs text-ink-faint">Exp
                    <input type="number" step="any" value={r.expected_qty ?? ''} onChange={e => setRow(i, { expected_qty: e.target.value })} className="fiori-input h-8 w-16 text-right" />
                  </label>
                )}
                {isGrn && (
                  <Select value={r.stock_status ?? 'good'} onChange={e => setRow(i, { stock_status: e.target.value })} className="h-8 w-28 text-xs">
                    <option value="good">Good</option><option value="damaged">Damaged</option><option value="quarantine">Quarantine</option>
                  </Select>
                )}
                {isGrn && (
                  <Select value={r.location_id ?? ''} onChange={e => setRow(i, { location_id: e.target.value })} className="h-8 w-32 text-xs">
                    <option value="">Location</option>{(locations ?? []).map(l => <option key={l.id} value={l.id}>{l.location_code}</option>)}
                  </Select>
                )}
                <label className="flex items-center gap-1 text-xs text-ink-faint">{isGrn ? 'Recd' : 'Qty'}
                  <input type="number" step="any" value={r.qty} onChange={e => setRow(i, { qty: e.target.value })} className="fiori-input h-8 w-20 text-right" />
                </label>
                <button type="button" onClick={() => removeRow(i)} className="rounded p-1 text-ink-faint hover:bg-bad/10 hover:text-bad"><Icon name="close" className="text-[16px]" /></button>
              </div>
            )
          })}
          <div className="flex justify-end gap-4 bg-surface-sunken px-3 py-2 text-sm">
            <span className="text-ink-soft">{rows.length} line(s)</span>
            <span><span className="text-ink-soft">Total qty:</span> <span className="font-semibold text-ink">{formatNumber(totalQty)}</span></span>
          </div>
        </div>
      )}
      <p className="text-xs text-ink-faint">Tip: in Excel select two columns (Material code &amp; Qty), copy, then paste into the code or qty box — every row is added automatically.</p>
    </div>
  )
}

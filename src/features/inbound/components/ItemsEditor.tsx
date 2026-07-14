import { useRef } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Field'
import { Combobox } from '@/components/ui/Combobox'
import type { Opt } from '../hooks'

export interface LineItem {
  product_id?: string; qty?: number | string; unit_price?: number | string
  location_id?: string; from_location_id?: string; to_location_id?: string
  stock_status?: string; reason?: string; direction?: string
}
interface Cols { price?: boolean; location?: boolean; condition?: boolean; fromTo?: boolean; reason?: boolean; direction?: boolean }
const DIRECTION = [{ id: 'in', label: 'Return (+)' }, { id: 'out', label: 'Issue (−)' }]
const CONDITIONS = [{ id: 'good', label: 'Good' }, { id: 'damaged', label: 'Damaged' }, { id: 'quarantine', label: 'Quarantine' }]

export function ItemsEditor({ items, setItems, products, locations, cols, disabled }:
  { items: LineItem[]; setItems: (i: LineItem[]) => void; products: Opt[]; locations: Opt[]; cols: Cols; disabled?: boolean }) {
  const update = (i: number, patch: Partial<LineItem>) => setItems(items.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  const remove = (i: number) => setItems(items.filter((_, idx) => idx !== i))
  const add = () => setItems([...items, { stock_status: 'good', qty: '' }])
  const loc = locations.map(l => ({ id: l.id, label: l.label }))
  const prods = products.map(p => ({ id: p.id, label: p.label, sub: p.sub }))

  // Excel-like entry: Enter in a Qty cell jumps to the next row's product search
  // (adding a row first if on the last line), so lines can be keyed/scanned in
  // one continuous flow — product → qty → Enter → next product.
  const wrapRef = useRef<HTMLDivElement>(null)
  const focusRowProduct = (rowIdx: number) => requestAnimationFrame(() => {
    const rows = wrapRef.current?.querySelectorAll('tbody tr')
    rows?.[rowIdx]?.querySelector<HTMLInputElement>('input')?.focus()
  })
  const onQtyKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (i === items.length - 1) add()
    focusRowProduct(i + 1)
  }

  return (
    <div className="space-y-2" ref={wrapRef}>
      <div className="overflow-x-auto overflow-y-visible rounded-lg border border-surface-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-line bg-surface-sunken text-left text-xs font-semibold text-ink-soft">
              <th className="px-3 py-2 min-w-[240px]">Product</th>
              {cols.fromTo && <th className="px-3 py-2 min-w-[150px]">From</th>}
              {cols.fromTo && <th className="px-3 py-2 min-w-[150px]">To</th>}
              {cols.location && <th className="px-3 py-2 min-w-[150px]">Location</th>}
              {cols.condition && <th className="px-3 py-2 min-w-[140px]">Condition</th>}
              {cols.direction && <th className="px-3 py-2 min-w-[140px]">Direction</th>}
              <th className="px-3 py-2 w-28">Qty</th>
              {cols.price && <th className="px-3 py-2 w-28">Unit Price</th>}
              {cols.reason && <th className="px-3 py-2 min-w-[140px]">Reason</th>}
              {!disabled && <th className="px-2 py-2 w-8"></th>}
            </tr>
          </thead>
          <tbody>
            {items.map((row, i) => (
              <tr key={i} className="border-b border-surface-line/70 align-top">
                <td className="px-2 py-1.5"><Combobox value={row.product_id} disabled={disabled} options={prods} mruKey="product" placeholder="Search product…" onChange={v => update(i, { product_id: v })} /></td>
                {cols.fromTo && <td className="px-2 py-1.5"><Combobox value={row.from_location_id} disabled={disabled} options={loc} placeholder="From…" onChange={v => update(i, { from_location_id: v })} /></td>}
                {cols.fromTo && <td className="px-2 py-1.5"><Combobox value={row.to_location_id} disabled={disabled} options={loc} placeholder="To…" onChange={v => update(i, { to_location_id: v })} /></td>}
                {cols.location && <td className="px-2 py-1.5"><Combobox value={row.location_id} disabled={disabled} options={loc} placeholder="Location…" onChange={v => update(i, { location_id: v })} /></td>}
                {cols.condition && <td className="px-2 py-1.5"><Combobox value={row.stock_status ?? 'good'} disabled={disabled} options={CONDITIONS} allowClear={false} onChange={v => update(i, { stock_status: v })} /></td>}
                {cols.direction && <td className="px-2 py-1.5"><Combobox value={row.direction ?? 'out'} disabled={disabled} options={DIRECTION} allowClear={false} onChange={v => update(i, { direction: v })} /></td>}
                <td className="px-2 py-1.5"><Input type="number" step="any" value={row.qty ?? ''} disabled={disabled} onChange={e => update(i, { qty: e.target.value })} onKeyDown={e => onQtyKey(e, i)} /></td>
                {cols.price && <td className="px-2 py-1.5"><Input type="number" step="any" value={row.unit_price ?? ''} disabled={disabled} onChange={e => update(i, { unit_price: e.target.value })} /></td>}
                {cols.reason && <td className="px-2 py-1.5"><Input value={row.reason ?? ''} disabled={disabled} onChange={e => update(i, { reason: e.target.value })} /></td>}
                {!disabled && <td className="px-2 py-3 text-center"><button type="button" onClick={() => remove(i)} className="text-ink-faint hover:text-bad"><Icon name="delete" className="text-[18px]" /></button></td>}
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-sm text-ink-faint">No line items</td></tr>}
          </tbody>
        </table>
      </div>
      {!disabled && <button type="button" onClick={add} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"><Icon name="add" className="text-[18px]" /> Add line</button>}
    </div>
  )
}

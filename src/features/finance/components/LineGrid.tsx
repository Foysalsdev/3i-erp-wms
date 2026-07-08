import { useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Icon } from '@/components/ui/Icon'
import { cn, formatNumber } from '@/lib/utils'

export interface LineColumn {
  key: string
  label: string
  width: string            // CSS grid track, e.g. '1fr' or '90px'
  align?: 'right'
  type?: 'text' | 'number'
  placeholder?: string
  required?: boolean
}

// A flat "ledger" editable line grid with an ERP/SAP document feel: a leftmost
// item-number column (1, 2, 3…), dense cells separated by thin column dividers,
// and a real in-grid totals footer (not a floating pill). Enter on the last
// row's amount commits the row and opens a fresh one (SAP fast-entry); Tab moves
// cell to cell. Kept generic so the requisition and voucher grids share it.
export function LineGrid({
  columns, rows, onChange, blank, recompute, totalKey, footerLabel, footerExtra, minRows = 0
}: {
  columns: LineColumn[]
  rows: any[]
  onChange: (rows: any[]) => void
  blank: () => any
  recompute?: (row: any, patch: any) => any
  totalKey: string
  footerLabel: string
  footerExtra?: (total: number) => ReactNode
  minRows?: number
}) {
  const gridRef = useRef<HTMLDivElement>(null)
  const template = `40px ${columns.map(c => c.width).join(' ')} 36px`
  const totalIndex = columns.findIndex(c => c.key === totalKey)
  const total = rows.reduce((s, r) => s + (Number(r[totalKey]) || 0), 0)

  const patchRow = (i: number, patch: any) => onChange(rows.map((r, idx) => {
    if (idx !== i) return r
    const merged = { ...r, ...patch }
    return recompute ? recompute(merged, patch) : merged
  }))
  const removeRow = (i: number) => { if (rows.length > minRows) onChange(rows.filter((_, idx) => idx !== i)) }

  const focusCell = (rowIdx: number, colIdx: number) => requestAnimationFrame(() => {
    gridRef.current?.querySelector<HTMLInputElement>(`[data-row="${rowIdx}"][data-col="${colIdx}"]`)?.focus()
  })
  const onAmountKeyDown = (e: KeyboardEvent, i: number) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (i === rows.length - 1) onChange([...rows, blank()])
    focusCell(i + 1, 0)
  }

  return (
    <div ref={gridRef} className="overflow-hidden rounded-xl border border-surface-line">
      {/* header */}
      <div className="grid divide-x divide-surface-line border-b border-surface-line bg-surface-sunken text-[11px] font-semibold uppercase tracking-wide text-ink-soft" style={{ gridTemplateColumns: template }}>
        <span className="px-2 py-1.5 text-center">#</span>
        {columns.map(c => <span key={c.key} className={cn('px-2 py-1.5', c.align === 'right' && 'text-right')}>{c.label}{c.required && ' *'}</span>)}
        <span />
      </div>

      {/* rows */}
      {rows.length === 0 ? (
        <p className="px-3 py-3 text-sm text-ink-faint">No lines yet — use “Add Line”, or type in a new row.</p>
      ) : rows.map((r, i) => (
        <div key={i} className="grid divide-x divide-surface-line border-b border-surface-line last:border-b-0" style={{ gridTemplateColumns: template }}>
          <span className="flex items-center justify-center bg-surface-sunken/40 text-xs font-medium tabular-nums text-ink-faint">{i + 1}</span>
          {columns.map((c, ci) => (
            <input key={c.key} data-row={i} data-col={ci}
              type={c.type === 'number' ? 'number' : 'text'}
              className={cn('h-8 w-full min-w-0 bg-transparent px-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:bg-brand-500/5', c.align === 'right' && 'text-right tabular-nums')}
              value={r[c.key] ?? ''}
              placeholder={c.placeholder}
              onChange={e => patchRow(i, { [c.key]: c.type === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value })}
              onKeyDown={c.key === totalKey ? e => onAmountKeyDown(e, i) : undefined} />
          ))}
          <button type="button" className="flex items-center justify-center text-ink-faint hover:text-bad disabled:opacity-25 disabled:hover:text-ink-faint"
            disabled={rows.length <= minRows} onClick={() => removeRow(i)} title="Remove line">
            <Icon name="close" className="text-[16px]" />
          </button>
        </div>
      ))}

      {/* footer total row */}
      <div className="grid divide-x divide-surface-line border-t-2 border-surface-line bg-surface-sunken" style={{ gridTemplateColumns: template }}>
        <span />
        <span style={{ gridColumn: `span ${Math.max(totalIndex, 1)}` }} className="px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{footerLabel}</span>
        <span className="px-2 py-2 text-right text-sm font-bold tabular-nums text-brand-700 dark:text-brand-300">{formatNumber(total, 2)}</span>
        {columns.slice(totalIndex + 1).map(c => <span key={c.key} />)}
        <span />
      </div>
      {footerExtra && (
        <div className="flex justify-end border-t border-surface-line bg-surface-sunken px-2 py-1.5 pr-[46px] text-sm">
          {footerExtra(total)}
        </div>
      )}
    </div>
  )
}

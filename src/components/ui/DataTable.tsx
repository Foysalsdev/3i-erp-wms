import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Icon } from './Icon'
import { Spinner, EmptyState } from './States'

export interface Column<T> {
  key: string; header: string; className?: string
  render?: (row: T) => React.ReactNode
  accessor?: (row: T) => string | number | null | undefined
  sortable?: boolean
}
interface Selection {
  selected: Set<string>
  onToggle: (key: string) => void
  onToggleAll: (keys: string[]) => void
}
interface Props<T> {
  columns: Column<T>[]; rows: T[]; loading?: boolean
  rowKey: (row: T) => string; onRowClick?: (row: T) => void; emptyTitle?: string
  // Fill the parent's height and scroll internally (with a sticky header),
  // so the surrounding toolbar/header stay put instead of the whole page scrolling.
  fill?: boolean
  // Row checkboxes + a header "select all (visible)" checkbox, for bulk actions.
  selection?: Selection
}
export function DataTable<T>({ columns, rows, loading, rowKey, onRowClick, emptyTitle = 'No records', fill, selection }: Props<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [dir, setDir] = useState<1 | -1>(1)

  const sorted = useMemo(() => {
    if (!sortKey) return rows
    const col = columns.find(c => c.key === sortKey)
    if (!col?.accessor) return rows
    return [...rows].sort((a, b) => {
      const av = col.accessor!(a) ?? '', bv = col.accessor!(b) ?? ''
      return (av < bv ? -1 : av > bv ? 1 : 0) * dir
    })
  }, [rows, sortKey, dir, columns])

  if (loading) return <Spinner label="Loading…" />
  if (!rows.length) return <EmptyState title={emptyTitle} />

  const actionsCol = columns.find(c => c.key === '__actions')
  const cellValue = (c: Column<T>, row: T) => (c.render ? c.render(row) : String(c.accessor?.(row) ?? '—'))

  const visibleKeys = sorted.map(rowKey)
  const allSelected = !!selection && visibleKeys.length > 0 && visibleKeys.every(k => selection.selected.has(k))
  const someSelected = !!selection && visibleKeys.some(k => selection.selected.has(k))

  return (
    <div className={cn(fill && 'flex min-h-0 flex-1 flex-col')}>
      {/* Desktop / tablet: classic table */}
      <div className={cn('hidden md:block', fill ? 'min-h-0 flex-1 overflow-auto' : 'overflow-x-auto')}>
        <table className="w-full border-collapse text-sm">
          <thead className={cn(fill && 'sticky top-0 z-10')}>
            <tr className="border-b border-horizon-line bg-surface-sunken text-left">
              {selection && (
                <th className="w-px bg-surface-sunken px-3 py-2.5">
                  <input type="checkbox" checked={allSelected}
                    ref={el => { if (el) el.indeterminate = !allSelected && someSelected }}
                    onChange={() => selection.onToggleAll(visibleKeys)}
                    className="h-4 w-4 rounded accent-brand-500" aria-label="Select all" />
                </th>
              )}
              {columns.map(c => (
                <th key={c.key} className={cn('bg-surface-sunken px-4 py-2.5 font-semibold text-horizon-muted', c.className)}>
                  <button className={cn('inline-flex items-center gap-1', c.sortable && 'hover:text-horizon-text')}
                    onClick={() => c.sortable && (sortKey === c.key ? setDir(d => (d === 1 ? -1 : 1)) : (setSortKey(c.key), setDir(1)))}>
                    {c.header}
                    {c.sortable && sortKey === c.key && <Icon name={dir === 1 ? 'arrow_upward' : 'arrow_downward'} className="text-[14px]" />}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => (
              <tr key={rowKey(row)} onClick={() => onRowClick?.(row)}
                className={cn('border-b border-horizon-line/70 transition', onRowClick && 'cursor-pointer hover:bg-surface-sunken', selection?.selected.has(rowKey(row)) && 'bg-brand-500/5')}>
                {selection && (
                  <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selection.selected.has(rowKey(row))} onChange={() => selection.onToggle(rowKey(row))}
                      className="h-4 w-4 rounded accent-brand-500" aria-label="Select row" />
                  </td>
                )}
                {columns.map(c => (
                  <td key={c.key} className={cn('px-4 py-3 text-horizon-text', c.className)}>
                    {cellValue(c, row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: each row as a stacked card (avoids cramped horizontal scrolling) */}
      <div className={cn('divide-y divide-horizon-line md:hidden', fill && 'min-h-0 flex-1 overflow-auto')}>
        {sorted.map(row => (
          <div key={rowKey(row)} onClick={() => onRowClick?.(row)}
            className={cn('flex items-start justify-between gap-3 px-4 py-3', onRowClick && 'cursor-pointer active:bg-surface-sunken', selection?.selected.has(rowKey(row)) && 'bg-brand-500/5')}>
            {selection && (
              <div className="shrink-0 pt-0.5" onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={selection.selected.has(rowKey(row))} onChange={() => selection.onToggle(rowKey(row))}
                  className="h-4 w-4 rounded accent-brand-500" aria-label="Select row" />
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-1.5">
              {columns.filter(c => c.key !== '__actions' && c.key !== '__thumb').map(c => (
                <div key={c.key} className="flex items-baseline gap-2 text-sm">
                  {c.header && <span className="w-24 shrink-0 text-xs text-ink-faint">{c.header}</span>}
                  <span className="min-w-0 flex-1 break-words text-ink">{cellValue(c, row)}</span>
                </div>
              ))}
            </div>
            {actionsCol && <div className="shrink-0">{cellValue(actionsCol, row)}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

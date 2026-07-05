import { Fragment, useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Icon } from './Icon'
import { EmptyState } from './States'
import { useUI } from '@/store/ui'

// Varying widths so a loading table reads as content, not a uniform gray block.
const SKELETON_ROWS = 8
const BAR_WIDTHS = ['w-3/4', 'w-1/2', 'w-5/6', 'w-2/5', 'w-full', 'w-3/5', 'w-4/5', 'w-1/3']

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
  rowKey: (row: T) => string; onRowClick?: (row: T) => void; emptyTitle?: string; emptyIcon?: string; emptyHint?: string
  // Fill the parent's height and scroll internally (with a sticky header),
  // so the surrounding toolbar/header stay put instead of the whole page scrolling.
  fill?: boolean
  // Row checkboxes + a header "select all (visible)" checkbox, for bulk actions.
  selection?: Selection
  // A chevron toggles an inline detail row under the clicked row — a quick
  // look (e.g. line items) without leaving the list or opening a modal.
  // Independent of onRowClick, so both can be wired on the same table.
  expand?: { render: (row: T) => React.ReactNode }
}
export function DataTable<T>({ columns, rows, loading, rowKey, onRowClick, emptyTitle = 'No records', emptyIcon, emptyHint, fill, selection, expand }: Props<T>) {
  const compact = useUI(s => s.density) === 'compact'
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [dir, setDir] = useState<1 | -1>(1)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggleExpand = (key: string) => setExpanded(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  const sorted = useMemo(() => {
    if (!sortKey) return rows
    const col = columns.find(c => c.key === sortKey)
    if (!col?.accessor) return rows
    return [...rows].sort((a, b) => {
      const av = col.accessor!(a) ?? '', bv = col.accessor!(b) ?? ''
      return (av < bv ? -1 : av > bv ? 1 : 0) * dir
    })
  }, [rows, sortKey, dir, columns])

  if (!loading && !rows.length) return <EmptyState title={emptyTitle} icon={emptyIcon} hint={emptyHint} />

  const actionsCol = columns.find(c => c.key === '__actions')
  const cellValue = (c: Column<T>, row: T) => (c.render ? c.render(row) : String(c.accessor?.(row) ?? '—'))
  const skeletonCell = (c: Column<T>, i: number) => c.key === '__thumb'
    ? <div className="h-9 w-9 animate-pulse rounded-lg bg-surface-sunken" />
    : c.key === '__actions' ? null
    : <div className={cn('h-3.5 animate-pulse rounded bg-surface-sunken', BAR_WIDTHS[i % BAR_WIDTHS.length])} />

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
              {expand && <th className={cn('w-px bg-surface-sunken px-2', compact ? 'py-1' : 'py-2.5')} />}
              {selection && (
                <th className={cn('w-px bg-surface-sunken px-3', compact ? 'py-1' : 'py-2.5')}>
                  <input type="checkbox" checked={allSelected}
                    ref={el => { if (el) el.indeterminate = !allSelected && someSelected }}
                    onChange={() => selection.onToggleAll(visibleKeys)}
                    className="h-4 w-4 rounded accent-brand-500" aria-label="Select all" />
                </th>
              )}
              {columns.map(c => (
                <th key={c.key} className={cn('bg-surface-sunken px-4 font-semibold text-horizon-muted', compact ? 'py-1' : 'py-2.5', c.className)}>
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
            {loading ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
              <tr key={`sk-${i}`} className="border-b border-horizon-line/70">
                {expand && <td className={cn('px-2', compact ? 'py-1' : 'py-3')} />}
                {selection && <td className={cn('px-3', compact ? 'py-1' : 'py-3')} />}
                {columns.map((c, ci) => (
                  <td key={c.key} className={cn('px-4', compact ? 'py-1' : 'py-3', c.className)}>{skeletonCell(c, ci + i)}</td>
                ))}
              </tr>
            )) : sorted.map(row => {
              const key = rowKey(row)
              const isOpen = expand && expanded.has(key)
              return (
                <Fragment key={key}>
                  <tr onClick={() => onRowClick?.(row)}
                    className={cn('border-b border-horizon-line/70 transition', onRowClick && 'cursor-pointer hover:bg-surface-sunken', selection?.selected.has(key) && 'bg-brand-500/5')}>
                    {expand && (
                      <td className={cn('px-2', compact ? 'py-1' : 'py-3')} onClick={e => e.stopPropagation()}>
                        <button type="button" onClick={() => toggleExpand(key)} aria-label={isOpen ? 'Collapse' : 'Expand'}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink">
                          <Icon name="chevron_right" className={cn('text-[18px] transition-transform', isOpen && 'rotate-90')} />
                        </button>
                      </td>
                    )}
                    {selection && (
                      <td className={cn('px-3', compact ? 'py-1' : 'py-3')} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selection.selected.has(key)} onChange={() => selection.onToggle(key)}
                          className="h-4 w-4 rounded accent-brand-500" aria-label="Select row" />
                      </td>
                    )}
                    {columns.map(c => (
                      <td key={c.key} className={cn('px-4 text-horizon-text', compact ? 'py-1' : 'py-3', c.className)}>
                        {cellValue(c, row)}
                      </td>
                    ))}
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-horizon-line/70 bg-surface-sunken/40">
                      <td colSpan={columns.length + (selection ? 1 : 0) + 1} className="px-4 py-3">
                        {expand!.render(row)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: each row as a stacked card (avoids cramped horizontal scrolling) */}
      <div className={cn('divide-y divide-horizon-line md:hidden', fill && 'min-h-0 flex-1 overflow-auto')}>
        {loading ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <div key={`sk-${i}`} className={cn('flex items-start gap-3 px-4', compact ? 'py-1.5' : 'py-3')}>
            <div className="min-w-0 flex-1 space-y-1.5">
              {columns.filter(c => c.key !== '__actions' && c.key !== '__thumb').slice(0, 3).map((c, ci) => (
                <div key={c.key} className={cn('h-3.5 animate-pulse rounded bg-surface-sunken', BAR_WIDTHS[(ci + i) % BAR_WIDTHS.length])} />
              ))}
            </div>
          </div>
        )) : sorted.map(row => {
          const key = rowKey(row)
          const isOpen = expand && expanded.has(key)
          return (
            <div key={key}>
              <div onClick={() => onRowClick?.(row)}
                className={cn('flex items-start justify-between gap-3 px-4', compact ? 'py-1.5' : 'py-3', onRowClick && 'cursor-pointer active:bg-surface-sunken', selection?.selected.has(key) && 'bg-brand-500/5')}>
                {expand && (
                  <button type="button" onClick={e => { e.stopPropagation(); toggleExpand(key) }} aria-label={isOpen ? 'Collapse' : 'Expand'}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-faint hover:bg-surface-sunken hover:text-ink">
                    <Icon name="chevron_right" className={cn('text-[18px] transition-transform', isOpen && 'rotate-90')} />
                  </button>
                )}
                {selection && (
                  <div className="shrink-0 pt-0.5" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selection.selected.has(key)} onChange={() => selection.onToggle(key)}
                      className="h-4 w-4 rounded accent-brand-500" aria-label="Select row" />
                  </div>
                )}
                <div className={cn('min-w-0 flex-1', compact ? 'space-y-0.5' : 'space-y-1.5')}>
                  {columns.filter(c => c.key !== '__actions' && c.key !== '__thumb').map(c => (
                    <div key={c.key} className="flex items-baseline gap-2 text-sm">
                      {c.header && <span className="w-24 shrink-0 text-xs text-ink-faint">{c.header}</span>}
                      <span className="min-w-0 flex-1 break-words text-ink">{cellValue(c, row)}</span>
                    </div>
                  ))}
                </div>
                {actionsCol && <div className="shrink-0">{cellValue(actionsCol, row)}</div>}
              </div>
              {isOpen && <div className="border-t border-surface-line bg-surface-sunken/40 px-4 py-3">{expand!.render(row)}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

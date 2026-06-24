import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon'
import { cn } from '@/lib/utils'

export interface ComboOption { id: string; label: string; sub?: string }

// SAP F4-style searchable select: the search icon appears beside the field only
// when focused. Pick from the Code | Description popup, or type a code + Enter to auto-fill.
export function Combobox({ value, onChange, options, placeholder = 'Search…', disabled, allowClear = true, className }:
  { value?: string; onChange: (id: string) => void; options: ComboOption[]; placeholder?: string; disabled?: boolean; allowClear?: boolean; className?: string }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [hi, setHi] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const selected = options.find(o => o.id === value)

  useEffect(() => {
    if (!open && !focused) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setFocused(false); setQuery('') } }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open, focused])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (q ? options.filter(o => (o.label + ' ' + (o.sub ?? '')).toLowerCase().includes(q)) : options).slice(0, 50)
  }, [options, query])

  const pick = (id: string) => { onChange(id); setOpen(false); setQuery('') }
  const display = selected ? (selected.sub ? `${selected.label} - ${selected.sub}` : selected.label) : ''
  const showIcon = (focused || open) && !disabled

  const onEnter = () => {
    const t = query.trim().toLowerCase()
    const exact = options.find(o => o.label.toLowerCase() === t)
    const target = exact ?? (open ? filtered[hi] : undefined)
    if (target) pick(target.id)
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <div className="flex items-stretch gap-1">
        <div className="relative flex-1">
          <input ref={inputRef} disabled={disabled} value={open ? query : display} placeholder={placeholder}
            onChange={e => { setQuery(e.target.value); setOpen(true); setHi(0) }}
            onFocus={() => { setFocused(true); setOpen(true) }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi(a => Math.min(a + 1, filtered.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(a => Math.max(a - 1, 0)) }
              else if (e.key === 'Enter') { e.preventDefault(); onEnter() }
              else if (e.key === 'Escape') { setOpen(false); setQuery('') }
            }}
            className={cn('fiori-input w-full', allowClear && selected && showIcon && 'pr-8')} />
          {allowClear && selected && showIcon && (
            <button type="button" tabIndex={-1} title="Clear" onMouseDown={e => { e.preventDefault(); onChange(''); setQuery(''); inputRef.current?.focus() }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint hover:text-bad"><Icon name="close" className="text-[15px]" /></button>
          )}
        </div>
        {showIcon && (
          <button type="button" tabIndex={-1} title="Search help"
            onMouseDown={e => { e.preventDefault(); setOpen(o => !o); setQuery(''); inputRef.current?.focus() }}
            className="flex w-8 shrink-0 items-center justify-center rounded-lg border border-surface-line text-ink-faint transition-colors hover:border-brand-400 hover:text-brand-600">
            <Icon name="search" className="text-[16px]" />
          </button>
        )}
      </div>
      {open && !disabled && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[280px] overflow-hidden rounded-lg border border-surface-line bg-surface shadow-pop">
          <div className="grid grid-cols-[120px_1fr] gap-2 border-b border-surface-line bg-surface-sunken px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
            <span>Code</span><span>Description</span>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-ink-faint">No matches</p>
            ) : filtered.map((o, i) => (
              <button key={o.id} type="button" onMouseEnter={() => setHi(i)} onMouseDown={e => { e.preventDefault(); pick(o.id) }}
                className={cn('grid w-full grid-cols-[120px_1fr] items-center gap-2 px-3 py-1.5 text-left text-sm',
                  i === hi ? 'bg-brand-50' : 'hover:bg-surface-sunken')}>
                <span className={cn('truncate font-mono text-[13px]', o.id === value ? 'font-bold text-brand-700' : 'font-medium text-ink')}>{o.label}</span>
                <span className="truncate text-ink-soft">{o.sub ?? ''}</span>
              </button>
            ))}
          </div>
          {options.length > filtered.length && <p className="border-t border-surface-line px-3 py-1.5 text-[11px] text-ink-faint">Showing {filtered.length} of {options.length} — type to narrow</p>}
        </div>
      )}
    </div>
  )
}

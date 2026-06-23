import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon'
import { cn } from '@/lib/utils'

export interface ComboOption { id: string; label: string; sub?: string }

// Searchable select: a normal autocomplete input + a SEPARATE search button beside it that opens the full list.
export function Combobox({ value, onChange, options, placeholder = 'Select…', disabled, allowClear = true, className }:
  { value?: string; onChange: (id: string) => void; options: ComboOption[]; placeholder?: string; disabled?: boolean; allowClear?: boolean; className?: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hi, setHi] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.id === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (q ? options.filter(o => (o.label + ' ' + (o.sub ?? '')).toLowerCase().includes(q)) : options).slice(0, 100)
  }, [options, query])

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery('') } }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const choose = (id: string) => { onChange(id); setOpen(false); setQuery('') }

  return (
    <div ref={ref} className={cn('flex items-stretch gap-1.5', className)}>
      {/* Input (type-ahead) */}
      <div className="relative flex-1">
        <div className="flex items-center rounded-lg border border-surface-line bg-surface transition-all focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/25">
          <input
            className="w-full min-w-0 bg-transparent px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint outline-none disabled:opacity-60"
            disabled={disabled} placeholder={placeholder}
            value={open ? query : (selected ? (selected.sub ? `${selected.label} — ${selected.sub}` : selected.label) : '')}
            onChange={e => { setQuery(e.target.value); setOpen(true); setHi(0) }}
            onFocus={() => !disabled && setOpen(true)}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi(h => Math.min(h + 1, filtered.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)) }
              else if (e.key === 'Enter') { e.preventDefault(); if (open && filtered[hi]) choose(filtered[hi].id) }
              else if (e.key === 'Escape') { setOpen(false); setQuery('') }
            }}
          />
          {allowClear && selected && !disabled && (
            <button type="button" tabIndex={-1} title="Clear" onMouseDown={e => { e.preventDefault(); onChange(''); setQuery('') }}
              className="px-2 text-ink-faint hover:text-bad"><Icon name="close" className="text-[16px]" /></button>
          )}
        </div>
        {open && !disabled && (
          <div className="absolute z-50 mt-1 max-h-64 w-full min-w-[240px] overflow-auto rounded-lg border border-surface-line bg-surface py-1 shadow-pop">
            {filtered.length === 0 && <p className="px-3 py-2.5 text-sm text-ink-faint">No matches</p>}
            {filtered.map((o, i) => (
              <button key={o.id} type="button" onMouseEnter={() => setHi(i)} onMouseDown={e => { e.preventDefault(); choose(o.id) }}
                className={cn('flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left',
                  i === hi ? 'bg-brand-50' : 'hover:bg-surface-sunken')}>
                <span className="min-w-0">
                  <span className={cn('block truncate text-sm', o.id === value ? 'font-bold text-brand-800' : 'font-semibold text-ink')}>{o.label}</span>
                  {o.sub && <span className="block truncate text-[11px] text-ink-soft">{o.sub}</span>}
                </span>
                {o.id === value && <Icon name="check" className="shrink-0 text-[16px] text-brand-600" />}
              </button>
            ))}
            {options.length > filtered.length && <p className="border-t border-surface-line px-3 py-1.5 text-[11px] text-ink-faint">Showing {filtered.length} of {options.length} — type to narrow</p>}
          </div>
        )}
      </div>
      {/* Separate search button BESIDE the field */}
      <button type="button" tabIndex={-1} disabled={disabled} title="Browse / search list"
        onMouseDown={e => { e.preventDefault(); setOpen(o => !o); setQuery('') }}
        className="flex w-10 shrink-0 items-center justify-center rounded-lg border border-surface-line bg-surface text-ink-faint transition-colors hover:border-brand-300 hover:text-brand-600 disabled:opacity-60">
        <Icon name="search" className="text-[18px]" />
      </button>
    </div>
  )
}

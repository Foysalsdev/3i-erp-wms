import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon'
import { cn } from '@/lib/utils'

export interface ComboOption { id: string; label: string; sub?: string }

// Modern autocomplete (the dropdown replacement): type to filter, arrow keys to
// move, Enter to pick. A single chevron sits inside the field (rotates when
// open) instead of the old SAP-style search button; a clear (×) appears on the
// left of it when a value is set. Suggestions show the code as a quiet mono
// chip beside the description, with a check on the current selection.
export function Combobox({ value, onChange, options, placeholder = 'Search…', disabled, allowClear = true, className }:
  { value?: string; onChange: (id: string) => void; options: ComboOption[]; placeholder?: string; disabled?: boolean; allowClear?: boolean; className?: string }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const selected = options.find(o => o.id === value)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery('') } }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (q ? options.filter(o => (o.label + ' ' + (o.sub ?? '')).toLowerCase().includes(q)) : options).slice(0, 50)
  }, [options, query])

  const pick = (id: string) => { onChange(id); setOpen(false); setQuery('') }
  const display = selected ? (selected.sub ? `${selected.label} — ${selected.sub}` : selected.label) : ''
  const canClear = allowClear && !!selected && !disabled

  const onEnter = () => {
    const t = query.trim().toLowerCase()
    const exact = options.find(o => o.label.toLowerCase() === t)
    const target = exact ?? (open ? filtered[hi] : undefined)
    if (target) pick(target.id)
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <div className="relative">
        <input ref={inputRef} disabled={disabled} value={open ? query : display} placeholder={placeholder}
          onChange={e => { setQuery(e.target.value); setOpen(true); setHi(0) }}
          onFocus={() => !disabled && setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi(a => Math.min(a + 1, filtered.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(a => Math.max(a - 1, 0)) }
            else if (e.key === 'Enter') { e.preventDefault(); onEnter() }
            else if (e.key === 'Escape') { setOpen(false); setQuery('') }
          }}
          className={cn('fiori-input w-full', canClear ? 'pr-14' : 'pr-9')} autoComplete="off" />
        <div className="absolute inset-y-0 right-2 flex items-center gap-0.5">
          {canClear && (
            <button type="button" tabIndex={-1} title="Clear"
              onMouseDown={e => { e.preventDefault(); onChange(''); setQuery(''); inputRef.current?.focus() }}
              className="rounded p-0.5 text-ink-faint hover:text-bad"><Icon name="close" className="text-[15px]" /></button>
          )}
          <Icon name="expand_more" className={cn('pointer-events-none text-[18px] text-ink-faint transition-transform', open && 'rotate-180')} />
        </div>
      </div>

      {open && !disabled && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-full min-w-[280px] overflow-hidden rounded-xl bg-surface p-1 shadow-pop ring-1 ring-surface-line">
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-ink-faint">No matches</p>
            ) : filtered.map((o, i) => {
              const on = o.id === value
              return (
                <button key={o.id} type="button" onMouseEnter={() => setHi(i)} onMouseDown={e => { e.preventDefault(); pick(o.id) }}
                  className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                    i === hi ? 'bg-brand-500/10' : 'hover:bg-surface-sunken')}>
                  <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[12px] font-semibold',
                    on ? 'bg-brand-500/15 text-brand-700' : 'bg-surface-sunken text-ink-soft')}>{o.label}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{o.sub ?? ''}</span>
                  {on && <Icon name="check" className="shrink-0 text-[17px] text-brand-600" />}
                </button>
              )
            })}
          </div>
          {options.length > filtered.length && (
            <p className="border-t border-surface-line px-2.5 pt-1.5 pb-1 text-[11px] text-ink-faint">Showing {filtered.length} of {options.length} — keep typing to narrow</p>
          )}
        </div>
      )}
    </div>
  )
}

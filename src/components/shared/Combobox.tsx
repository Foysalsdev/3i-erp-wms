import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/Icon'

export interface ComboItem { id: string; label: string; sublabel?: string }

// Modern autocomplete (the dropdown replacement): type to filter, arrow keys to
// move, Enter to pick. No separate SAP-style search button — a single chevron
// lives inside the field and rotates when open. Each suggestion shows the code
// as a quiet mono chip beside its description, with a check on the current pick.
export function Combobox({ items, value, onChange, placeholder = 'Search…' }:
  { items: ComboItem[]; value: string; onChange: (id: string) => void; placeholder?: string }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const selected = items.find(p => p.id === value)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery('') } }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const matches = useMemo(() => {
    const t = query.trim().toLowerCase()
    const list = !t ? items
      : items.filter(p => p.label.toLowerCase().includes(t) || (p.sublabel ?? '').toLowerCase().includes(t))
    return list.slice(0, 50)
  }, [items, query])

  const pick = (p: ComboItem) => { onChange(p.id); setQuery(''); setOpen(false) }
  const display = selected ? (selected.sublabel ? `${selected.label} — ${selected.sublabel}` : selected.label) : ''

  const onEnter = () => {
    const t = query.trim().toLowerCase()
    const exact = items.find(p => p.label.toLowerCase() === t)
    const target = exact ?? (open ? matches[active] : undefined)
    if (target) pick(target)
  }

  return (
    <div ref={ref} className="relative">
      <div className="group relative">
        <input ref={inputRef} value={open ? query : display} placeholder={placeholder}
          onChange={e => { setQuery(e.target.value); setOpen(true); setActive(0) }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(a => Math.min(a + 1, matches.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
            else if (e.key === 'Enter') { e.preventDefault(); onEnter() }
            else if (e.key === 'Escape') { setOpen(false); setQuery('') }
          }}
          className="fiori-input w-full pr-9" autoComplete="off" />
        <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
          <Icon name="expand_more" className={cn('text-[18px] text-ink-faint transition-transform', open && 'rotate-180')} />
        </div>
      </div>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-full min-w-[300px] overflow-hidden rounded-xl bg-surface p-1 shadow-pop ring-1 ring-surface-line">
          <div className="max-h-72 overflow-y-auto">
            {matches.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-ink-faint">No matches</p>
            ) : matches.map((p, i) => {
              const on = p.id === value
              return (
                <button key={p.id} type="button" onMouseEnter={() => setActive(i)} onMouseDown={e => { e.preventDefault(); pick(p) }}
                  className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                    i === active ? 'bg-brand-500/10' : 'hover:bg-surface-sunken')}>
                  <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[12px] font-semibold',
                    on ? 'bg-brand-500/15 text-brand-700' : 'bg-surface-sunken text-ink-soft')}>{p.label}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{p.sublabel ?? ''}</span>
                  {on && <Icon name="check" className="shrink-0 text-[17px] text-brand-600" />}
                </button>
              )
            })}
          </div>
          {items.length > matches.length && (
            <p className="border-t border-surface-line px-2.5 pt-1.5 pb-1 text-[11px] text-ink-faint">Showing {matches.length} of {items.length} — keep typing to narrow</p>
          )}
        </div>
      )}
    </div>
  )
}

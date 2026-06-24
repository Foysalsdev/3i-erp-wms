import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/Icon'

export interface ComboItem { id: string; label: string; sublabel?: string }

// SAP F4-style searchable select: the search icon appears beside the field only
// when it's focused. Pick from the Code | Description popup, or type a code and
// press Enter to auto-fill.
export function Combobox({ items, value, onChange, placeholder = 'Search...' }:
  { items: ComboItem[]; value: string; onChange: (id: string) => void; placeholder?: string }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const selected = items.find(p => p.id === value)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setFocused(false); setQuery('') } }
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
  const display = selected ? (selected.sublabel ? `${selected.label} - ${selected.sublabel}` : selected.label) : ''
  const showIcon = focused || open

  const onEnter = () => {
    const t = query.trim().toLowerCase()
    const exact = items.find(p => p.label.toLowerCase() === t)
    const target = exact ?? (open ? matches[active] : undefined)
    if (target) pick(target)
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-stretch gap-1">
        <input ref={inputRef} value={open ? query : display} placeholder={placeholder}
          onChange={e => { setQuery(e.target.value); setOpen(true); setActive(0) }}
          onFocus={() => { setFocused(true); setOpen(true) }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(a => Math.min(a + 1, matches.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
            else if (e.key === 'Enter') { e.preventDefault(); onEnter() }
            else if (e.key === 'Escape') { setOpen(false); setQuery('') }
          }}
          className="fiori-input w-full flex-1" />
        {showIcon && (
          <button type="button" tabIndex={-1} title="Search help"
            onMouseDown={e => { e.preventDefault(); setOpen(o => !o); setQuery(''); inputRef.current?.focus() }}
            className="flex w-8 shrink-0 items-center justify-center rounded-lg border border-surface-line text-ink-faint transition-colors hover:border-brand-400 hover:text-brand-600">
            <Icon name="search" className="text-[16px]" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[320px] overflow-hidden rounded-lg border border-surface-line bg-surface shadow-fiori-lg">
          <div className="grid grid-cols-[130px_1fr] gap-2 border-b border-surface-line bg-surface-sunken px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
            <span>Code</span><span>Description</span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {matches.length === 0 ? (
              <p className="px-3 py-3 text-sm text-ink-faint">No matches</p>
            ) : matches.map((p, i) => (
              <button key={p.id} type="button" onMouseEnter={() => setActive(i)} onMouseDown={e => { e.preventDefault(); pick(p) }}
                className={cn('grid w-full grid-cols-[130px_1fr] items-center gap-2 px-3 py-1.5 text-left text-sm',
                  i === active ? 'bg-brand-50' : 'hover:bg-surface-sunken')}>
                <span className={cn('truncate font-mono text-[13px]', p.id === value ? 'font-bold text-brand-700' : 'font-medium text-ink')}>{p.label}</span>
                <span className="truncate text-ink-soft">{p.sublabel ?? ''}</span>
              </button>
            ))}
          </div>
          {items.length > matches.length && <p className="border-t border-surface-line px-3 py-1.5 text-[11px] text-ink-faint">Showing {matches.length} of {items.length} — type to narrow</p>}
        </div>
      )}
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/Icon'

export interface ComboItem { id: string; label: string; sublabel?: string }

// Generic searchable single-select. Type a code/name to filter long lists
// (customers, suppliers) instead of scrolling a huge native dropdown.
export function Combobox({ items, value, onChange, placeholder = 'Search...' }:
  { items: ComboItem[]; value: string; onChange: (id: string) => void; placeholder?: string }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const selected = items.find(p => p.id === value)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
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

  return (
    <div ref={ref} className="relative">
      {selected && !open ? (
        <button type="button" onClick={() => { setOpen(true); setQuery('') }}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-surface-line bg-surface px-3 py-2 text-left text-sm">
          <span className="truncate"><span className="font-medium text-ink">{selected.label}</span>{selected.sublabel && <span className="text-ink-soft"> - {selected.sublabel}</span>}</span>
          <Icon name="expand_more" className="text-[18px] text-ink-faint" />
        </button>
      ) : (
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-ink-faint" />
          <input autoFocus={open} value={query} placeholder={placeholder}
            onChange={e => { setQuery(e.target.value); setOpen(true); setActive(0) }}
            onFocus={() => setOpen(true)}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, matches.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
              else if (e.key === 'Enter') { e.preventDefault(); if (matches[active]) pick(matches[active]) }
              else if (e.key === 'Escape') setOpen(false)
            }}
            className="fiori-input w-full pl-9" />
        </div>
      )}
      {open && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-surface-line bg-surface shadow-fiori-lg">
          {matches.length === 0 ? (
            <p className="px-3 py-3 text-sm text-ink-faint">No matches</p>
          ) : matches.map((p, i) => (
            <button key={p.id} type="button" onMouseEnter={() => setActive(i)} onClick={() => pick(p)}
              className={cn('flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm',
                i === active ? 'bg-brand-50' : 'hover:bg-surface-sunken', p.id === value && 'font-semibold')}>
              <span className="truncate"><span className="font-medium text-ink">{p.label}</span>{p.sublabel && <span className="text-ink-soft"> - {p.sublabel}</span>}</span>
              {p.id === value && <Icon name="check" className="text-[16px] text-brand-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

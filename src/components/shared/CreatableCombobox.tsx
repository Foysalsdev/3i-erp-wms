import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/Icon'

export interface ComboItem { id: string; label: string; sublabel?: string }

// Searchable field with type-ahead suggestions from the given list, plus an
// inline "Add to database" row when the typed text matches nothing. Creating
// asks for confirmation, then calls onCreate (which should persist the record
// and return the new ComboItem).
export function CreatableCombobox({ items, value, onChange, onCreate, placeholder = 'Type to search…', noun = 'item', format }:
  { items: ComboItem[]; value: string; onChange: (id: string) => void; onCreate?: (label: string) => Promise<ComboItem | null>; placeholder?: string; noun?: string; format?: (s: string) => string }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(0)
  const [creating, setCreating] = useState(false)
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
    const list = !t ? items : items.filter(p => p.label.toLowerCase().includes(t) || (p.sublabel ?? '').toLowerCase().includes(t))
    return list.slice(0, 50)
  }, [items, query])

  const q = query.trim()
  const exact = items.some(p => p.label.toLowerCase() === q.toLowerCase() || (p.sublabel ?? '').toLowerCase() === q.toLowerCase())
  const canCreate = !!onCreate && q.length > 0 && !exact

  const pick = (p: ComboItem) => { onChange(p.id); setQuery(''); setOpen(false) }
  const display = selected ? (selected.sublabel ? `${selected.label} - ${selected.sublabel}` : selected.label) : ''
  const showIcon = focused || open

  const doCreate = async () => {
    if (!onCreate || !q) return
    if (!window.confirm(`"${q}" is new. Add this ${noun} to the database?`)) return
    setCreating(true)
    const created = await onCreate(q)
    setCreating(false)
    if (created) { onChange(created.id); setQuery(''); setOpen(false) }
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-stretch gap-1">
        <input ref={inputRef} value={open ? query : display} placeholder={placeholder}
          onChange={e => { setQuery(format ? format(e.target.value) : e.target.value); setOpen(true); setActive(0) }}
          onFocus={() => { setFocused(true); setOpen(true) }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(a => Math.min(a + 1, matches.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
            else if (e.key === 'Enter') { e.preventDefault(); if (matches[active]) pick(matches[active]); else if (canCreate) doCreate() }
            else if (e.key === 'Escape') { setOpen(false); setQuery('') }
          }}
          className="fiori-input w-full flex-1" />
        {showIcon && (
          <button type="button" tabIndex={-1} title="Search"
            onMouseDown={e => { e.preventDefault(); setOpen(o => !o); setQuery(''); inputRef.current?.focus() }}
            className="flex w-8 shrink-0 items-center justify-center rounded-lg border border-surface-line text-ink-faint transition-colors hover:border-brand-400 hover:text-brand-600">
            <Icon name="search" className="text-[16px]" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[280px] overflow-hidden rounded-lg border border-surface-line bg-surface shadow-fiori-lg">
          <div className="max-h-60 overflow-y-auto">
            {matches.length === 0 && !canCreate ? (
              <p className="px-3 py-3 text-sm text-ink-faint">No matches</p>
            ) : matches.map((p, i) => (
              <button key={p.id} type="button" onMouseEnter={() => setActive(i)} onMouseDown={e => { e.preventDefault(); pick(p) }}
                className={cn('flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm', i === active ? 'bg-brand-50' : 'hover:bg-surface-sunken')}>
                <span className="truncate text-ink">{p.sublabel || p.label}</span>
                <span className="shrink-0 truncate font-mono text-[12px] text-ink-faint">{p.label}</span>
              </button>
            ))}
          </div>
          {canCreate && (
            <button type="button" onMouseDown={e => { e.preventDefault(); doCreate() }}
              className="flex w-full items-center gap-2 border-t border-surface-line bg-surface-sunken/50 px-3 py-2 text-left text-sm font-medium text-brand-700 hover:bg-brand-50">
              <Icon name="add_circle" className="text-[18px]" /> {creating ? 'Adding…' : `Add "${q}" to database`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

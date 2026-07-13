import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon'
import { cn } from '@/lib/utils'

export interface ComboOption { id: string; label: string; sub?: string }

// The single autocomplete used across the app (the dropdown replacement).
// Type to filter, ↑/↓ to move (the highlighted row always scrolls into view),
// Enter to pick, Esc to close. A chevron sits inside the field and rotates when
// open; a clear (×) appears once a value is set.
//
// Row rendering adapts to the data instead of forcing everything into a mono
// "code chip": options that carry a separate description (product code + name,
// supplier code + name) show the code as a quiet chip beside its text, while
// plain options (a condition, a movement type, a "CODE — Name" string) render
// as ordinary text. The typed query is highlighted in each match.
export function Combobox({ value, onChange, options, placeholder = 'Search…', disabled, allowClear = true, className }:
  { value?: string; onChange: (id: string) => void; options: ComboOption[]; placeholder?: string; disabled?: boolean; allowClear?: boolean; className?: string }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([])
  const selected = options.find(o => o.id === value)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery('') } }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  // Prefix matches float to the top so the most likely pick is first (and gets
  // the initial highlight), the rest keep their given order.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options.slice(0, 50)
    const starts = (o: ComboOption) => o.label.toLowerCase().startsWith(q) || (o.sub ?? '').toLowerCase().startsWith(q)
    return options
      .filter(o => (o.label + ' ' + (o.sub ?? '')).toLowerCase().includes(q))
      .sort((a, b) => Number(starts(b)) - Number(starts(a)))
      .slice(0, 50)
  }, [options, query])

  const pick = (id: string) => { onChange(id); setOpen(false); setQuery('') }
  const display = selected ? (selected.sub ? `${selected.label} — ${selected.sub}` : selected.label) : ''
  const canClear = allowClear && !!selected && !disabled

  // Open with the current selection (or first row) pre-highlighted.
  const openList = () => {
    if (disabled) return
    const idx = selected ? Math.max(0, options.findIndex(o => o.id === selected.id)) : 0
    setHi(idx); setOpen(true)
  }

  // Keep the highlighted row visible as the user arrows through a long list.
  useLayoutEffect(() => {
    if (!open) return
    rowRefs.current[hi]?.scrollIntoView({ block: 'nearest' })
  }, [hi, open])

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
          onFocus={openList}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) openList(); else setHi(a => Math.min(a + 1, filtered.length - 1)) }
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
        <div className="absolute left-0 top-full z-50 mt-1.5 w-full min-w-[240px] overflow-hidden rounded-xl bg-surface p-1 shadow-pop ring-1 ring-surface-line">
          <div ref={listRef} className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-ink-faint">No matches</p>
            ) : filtered.map((o, i) => (
              <ComboRow key={o.id} option={o} query={query} active={i === hi} selected={o.id === value}
                setActive={() => setHi(i)} onPick={() => pick(o.id)}
                rowRef={el => { rowRefs.current[i] = el }} />
            ))}
          </div>
          {options.length > filtered.length && (
            <p className="border-t border-surface-line px-2.5 pt-1.5 pb-1 text-[11px] text-ink-faint">Showing {filtered.length} of {options.length} — keep typing to narrow</p>
          )}
        </div>
      )}
    </div>
  )
}

// One suggestion row. A code chip appears only when the option also carries a
// description; otherwise the label stands on its own as normal text.
function ComboRow({ option, query, active, selected, setActive, onPick, rowRef }:
  { option: ComboOption; query: string; active: boolean; selected: boolean
    setActive: () => void; onPick: () => void; rowRef: (el: HTMLButtonElement | null) => void }) {
  const hasSub = !!option.sub
  return (
    <button ref={rowRef} type="button" onMouseEnter={setActive} onMouseDown={e => { e.preventDefault(); onPick() }}
      className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
        active ? 'bg-brand-500/10' : 'hover:bg-surface-sunken')}>
      {hasSub ? (
        <>
          <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[12px] font-semibold',
            selected ? 'bg-brand-500/15 text-brand-700' : 'bg-surface-sunken text-ink-soft')}>{mark(option.label, query)}</span>
          <span className="min-w-0 flex-1 truncate text-sm text-ink">{mark(option.sub!, query)}</span>
        </>
      ) : (
        <span className={cn('min-w-0 flex-1 truncate text-sm', selected ? 'font-semibold text-ink' : 'font-medium text-ink')}>{mark(option.label, query)}</span>
      )}
      {selected && <Icon name="check" className="shrink-0 text-[17px] text-brand-600" />}
    </button>
  )
}

// Bold the first occurrence of the typed query inside a label — a light touch
// that makes it obvious why a row matched.
function mark(text: string, query: string) {
  const q = query.trim()
  if (!q) return text
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return text
  return (<>{text.slice(0, i)}<b className="font-semibold text-brand-700">{text.slice(i, i + q.length)}</b>{text.slice(i + q.length)}</>)
}

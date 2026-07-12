import { Children, isValidElement, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { cn } from '@/lib/utils'

export interface SelectOption { value: string; label: string }

// A drop-in replacement for the native <select>: same shell as the app's
// inputs, but the open list is our own popover (rounded, ring+shadow, brand
// tint on the active row, check on the selection) instead of the OS dropdown.
// Accepts either an `options` array or plain <option> children, so existing
// markup can switch with just the tag + an onChange that takes the value.
// The list is portalled to <body> and positioned under the trigger, so it is
// never clipped by a modal's overflow and long lists get a search box.
export function SelectBox({ value, onChange, options, children, placeholder = 'Select…', disabled, className, id }:
  {
    value?: string
    // Event-shaped like a native <select> so existing `e => f(e.target.value)`
    // handlers are drop-in — switching a field is just the tag name.
    onChange: (e: { target: { value: string } }) => void
    options?: SelectOption[]
    children?: ReactNode
    placeholder?: string
    disabled?: boolean
    className?: string
    id?: string
  }) {
  const opts: SelectOption[] = useMemo(() => {
    if (options) return options
    // Parse <option value="x">Label</option> children.
    const out: SelectOption[] = []
    // Flatten string/number children (e.g. `{b} days` is an array) into a label.
    const toLabel = (c: ReactNode): string => Array.isArray(c)
      ? c.map(toLabel).join('')
      : (typeof c === 'string' || typeof c === 'number') ? String(c) : ''
    Children.forEach(children, c => {
      if (isValidElement(c) && (c.type === 'option')) {
        const p = c.props as { value?: string; children?: ReactNode }
        const lbl = toLabel(p.children).trim()
        out.push({ value: String(p.value ?? ''), label: lbl || String(p.value ?? '') })
      }
    })
    return out
  }, [options, children])

  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null)

  // Options whose value is '' act as the placeholder, not a real choice.
  const real = opts.filter(o => o.value !== '')
  const selected = real.find(o => o.value === value)
  const searchable = real.length > 6

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? real.filter(o => o.label.toLowerCase().includes(t)) : real
  }, [real, q])

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setRect({ top: r.bottom + 6, left: r.left, width: r.width })
  }

  useEffect(() => {
    if (!open) return
    place()
    setHi(Math.max(0, filtered.findIndex(o => o.value === value)))
    const onDoc = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node) || popRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const reflow = () => place()
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('resize', reflow); window.addEventListener('scroll', reflow, true)
    return () => { document.removeEventListener('mousedown', onDoc); window.removeEventListener('resize', reflow); window.removeEventListener('scroll', reflow, true) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const choose = (v: string) => { onChange({ target: { value: v } }); setOpen(false); setQ('') }

  return (
    <>
      <button ref={btnRef} type="button" id={id} disabled={disabled}
        onClick={() => !disabled && (open ? setOpen(false) : (setQ(''), setOpen(true)))}
        onKeyDown={e => {
          if (disabled) return
          if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setQ(''); setOpen(true) }
          // Type-ahead: start typing on the closed control to open + filter.
          else if (!open && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { setQ(e.key); setHi(0); setOpen(true) }
          else if (open) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHi(a => Math.min(a + 1, filtered.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(a => Math.max(a - 1, 0)) }
            else if (e.key === 'Enter') { e.preventDefault(); if (filtered[hi]) choose(filtered[hi].value) }
            else if (e.key === 'Escape') { setOpen(false) }
          }
        }}
        className={cn('fiori-input flex w-full items-center gap-2 text-left', disabled && 'cursor-not-allowed', className)}>
        <span className={cn('min-w-0 flex-1 truncate', selected ? 'text-ink' : 'text-ink-faint')}>{selected?.label ?? placeholder}</span>
        <Icon name="expand_more" className={cn('shrink-0 text-[18px] text-ink-faint transition-transform', open && 'rotate-180')} />
      </button>

      {open && rect && createPortal(
        <div ref={popRef} style={{ position: 'fixed', top: rect.top, left: rect.left, width: Math.max(rect.width, 200) }}
          className="z-[60] overflow-hidden rounded-xl bg-surface p-1 shadow-pop ring-1 ring-surface-line">
          {searchable && (
            <div className="mb-1 flex items-center gap-2 border-b border-surface-line px-2 pb-1.5">
              <Icon name="search" className="text-[16px] text-ink-faint" />
              <input autoFocus value={q} onChange={e => { setQ(e.target.value); setHi(0) }} placeholder="Search…"
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setHi(a => Math.min(a + 1, filtered.length - 1)) }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(a => Math.max(a - 1, 0)) }
                  else if (e.key === 'Enter') { e.preventDefault(); if (filtered[hi]) choose(filtered[hi].value) }
                  else if (e.key === 'Escape') { setOpen(false) }
                }}
                className="w-full bg-transparent py-1 text-sm text-ink outline-none placeholder:text-ink-faint" />
            </div>
          )}
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-ink-faint">No matches</p>
            ) : filtered.map((o, i) => {
              const on = o.value === value
              return (
                <button key={o.value} type="button"
                  ref={el => { if (i === hi && el) el.scrollIntoView({ block: 'nearest' }) }}
                  onMouseEnter={() => setHi(i)} onMouseDown={e => { e.preventDefault(); choose(o.value) }}
                  className={cn('flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                    i === hi ? 'bg-brand-500/10' : 'hover:bg-surface-sunken', on ? 'font-medium text-ink' : 'text-ink-soft')}>
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {on && <Icon name="check" className="shrink-0 text-[17px] text-brand-600" />}
                </button>
              )
            })}
          </div>
        </div>, document.body)}
    </>
  )
}

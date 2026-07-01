import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/Icon'

export interface PickProduct { id: string; material_code: string; name: string }

// Searchable product picker — type a code or name to filter, then click to
// select. Replaces the long native dropdown that is unusable with many SKUs.
export function ProductCombobox({ products, value, onChange, placeholder = 'Search product by code or name…' }:
  { products: PickProduct[]; value: string; onChange: (id: string) => void; placeholder?: string }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const selected = products.find(p => p.id === value)
  const label = (p: PickProduct) => `${p.material_code} — ${p.name}`

  // Close on outside click.
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const matches = useMemo(() => {
    const t = query.trim().toLowerCase()
    const list = !t ? products
      : products.filter(p => p.material_code.toLowerCase().includes(t) || p.name.toLowerCase().includes(t))
    return list.slice(0, 50)
  }, [products, query])

  const pick = (p: PickProduct) => { onChange(p.id); setQuery(''); setOpen(false) }

  return (
    <div ref={ref} className="relative">
      {selected && !open ? (
        <button type="button" onClick={() => { setOpen(true); setQuery('') }}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-brand-200/70 bg-surface px-3 py-2 text-left text-sm">
          <span className="truncate"><span className="font-medium text-ink">{selected.material_code}</span> <span className="text-ink-soft">— {selected.name}</span></span>
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
            <p className="px-3 py-3 text-sm text-ink-faint">No matching products</p>
          ) : matches.map((p, i) => (
            <button key={p.id} type="button" onMouseEnter={() => setActive(i)} onClick={() => pick(p)}
              className={cn('flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm',
                i === active ? 'bg-surface-sunken' : 'hover:bg-surface-sunken', p.id === value && 'font-semibold')}>
              <span className="truncate"><span className="font-medium text-ink">{p.material_code}</span> <span className="text-ink-soft">— {p.name}</span></span>
              {p.id === value && <Icon name="check" className="text-[16px] text-brand-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

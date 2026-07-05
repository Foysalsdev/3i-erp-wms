import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { cn } from '@/lib/utils'

// A "Filters" trigger that opens a popover of arbitrary filter controls
// (date range, multi-select status, etc.) — the advanced, multi-condition
// counterpart to the single status SelectBox already on most lists.
// Same popover mechanics as SelectBox: portalled to <body>, positioned under
// the trigger, closes on outside click / Escape.
export function FilterPanel({ activeCount = 0, onClear, children, label = 'Filters' }: {
  activeCount?: number
  onClear?: () => void
  children: ReactNode
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null)

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setRect({ top: r.bottom + 6, left: r.left })
  }

  useEffect(() => {
    if (!open) return
    place()
    const onDoc = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node) || popRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const reflow = () => place()
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', reflow); window.addEventListener('scroll', reflow, true)
    return () => {
      document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', reflow); window.removeEventListener('scroll', reflow, true)
    }
  }, [open])

  return (
    <>
      <button ref={btnRef} type="button" onClick={() => setOpen(o => !o)}
        className={cn('inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors',
          activeCount > 0 ? 'border-brand-400 bg-brand-500/10 text-brand-700' : 'border-surface-line text-ink-soft hover:bg-surface-sunken')}>
        <Icon name="filter_list" className="text-[16px]" /> {label}
        {activeCount > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-coal-900">{activeCount}</span>}
      </button>

      {open && rect && createPortal(
        <div ref={popRef} style={{ position: 'fixed', top: rect.top, left: rect.left, width: 280 }}
          className="z-[60] overflow-hidden rounded-xl bg-surface p-3 shadow-pop ring-1 ring-surface-line">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Filters</span>
            {activeCount > 0 && onClear && (
              <button type="button" onClick={onClear} className="text-xs font-medium text-ink-soft underline-offset-2 hover:text-ink hover:underline">
                Clear all
              </button>
            )}
          </div>
          <div className="space-y-3">{children}</div>
        </div>, document.body)}
    </>
  )
}

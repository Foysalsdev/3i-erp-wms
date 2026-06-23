import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { cn } from '@/lib/utils'

export interface MenuItem { icon: string; label: string; onClick: () => void; tone?: string }

// Kebab (3-dot) row action menu. Rendered fixed-positioned so it is never
// clipped by a table/card's overflow, and closes on outside click, Escape, or scroll.
export function ActionMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const close = () => setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  if (!items.length) return null

  const toggle = () => {
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 4, left: r.right - 176 }) // 176 = w-44 menu width, right-aligned to button
    setOpen(o => !o)
  }

  return (
    <>
      <button ref={btnRef} title="Actions" aria-label="Actions" aria-haspopup="menu" aria-expanded={open} onClick={toggle}
        className={cn('rounded-md p-1.5 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-brand-700', open && 'bg-surface-sunken text-ink')}>
        <Icon name="more_vert" className="text-[18px]" />
      </button>
      {open && (
        <div ref={menuRef} role="menu" style={{ top: pos.top, left: Math.max(8, pos.left) }}
          className="fixed z-50 w-44 overflow-hidden rounded-lg border border-surface-line bg-surface py-1 shadow-card">
          {items.map(it => (
            <button key={it.label} role="menuitem" onClick={() => { setOpen(false); it.onClick() }}
              className={cn('flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink', it.tone)}>
              <Icon name={it.icon} className="text-[18px]" /> {it.label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

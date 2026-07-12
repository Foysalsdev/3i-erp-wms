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
    if (r) {
      // Flip the menu upward when there isn't room below (rows near the
      // viewport bottom), then clamp inside the viewport so the whole menu is
      // always visible — a very long menu scrolls internally (max-h below)
      // instead of ever being cut off.
      const h = Math.min(items.length * 40 + 8, window.innerHeight - 16) // ~40px per item + padding
      const openUp = r.bottom + h > window.innerHeight - 8 && r.top - h > 8
      const top = Math.max(8, Math.min(openUp ? r.top - h - 4 : r.bottom + 4, window.innerHeight - h - 8))
      setPos({ top, left: r.right - 224 }) // 224 = w-56, right-aligned
    }
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
          className="fixed z-50 max-h-[calc(100vh-16px)] w-56 overflow-y-auto rounded-lg border border-surface-line bg-surface py-1 shadow-card">
          {items.map(it => (
            <button key={it.label} role="menuitem" onClick={() => { setOpen(false); it.onClick() }}
              className={cn('flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-medium text-ink transition-colors hover:bg-surface-sunken', it.tone)}>
              <Icon name={it.icon} className="shrink-0 text-[18px]" /> {it.label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { cn } from '@/lib/utils'
export function Modal({ open, onClose, title, children, size = 'md' }:
  { open: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: 'md' | 'lg' | 'xl' }) {
  if (!open) return null
  // Wide by design: operators asked to see more fields without scrolling, so
  // lg/xl stretch close to the full page width instead of a narrow column.
  const w = { md: 'max-w-2xl', lg: 'max-w-6xl', xl: 'max-w-[1440px]' }[size]
  // Portal to <body> so the modal escapes any ancestor stacking context /
  // containing block (transforms, filters, sticky headers) — otherwise a modal
  // opened from inside the Topbar (My Profile) can get trapped behind the page.
  return createPortal(
    // Outer layer scrolls (not just the modal body) so a modal taller than the
    // viewport can never clip its own header/top off-screen with no way back to it.
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40">
      <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-4">
        <div className={cn('my-auto w-full rounded-t-2xl sm:rounded-card bg-surface ring-1 ring-surface-line shadow-pop max-h-[92vh] flex flex-col', w)}>
          <div className="flex items-center justify-between border-b border-horizon-line/60 px-5 py-3.5">
            <h3 className="text-base font-semibold">{title}</h3>
            <button onClick={onClose} className="rounded-lg p-1 text-horizon-muted hover:bg-surface-sunken"><Icon name="close" /></button>
          </div>
          <div className="overflow-y-auto p-5">{children}</div>
        </div>
      </div>
    </div>,
    document.body
  )
}

import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { cn } from '@/lib/utils'
export function Modal({ open, onClose, title, children, size = 'md' }:
  { open: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: 'md' | 'lg' | 'xl' }) {
  if (!open) return null
  const w = { md: 'max-w-xl', lg: 'max-w-4xl', xl: 'max-w-6xl' }[size]
  // Portal to <body> so the modal escapes any ancestor stacking context — e.g.
  // the Topbar's backdrop-blur makes it the containing block for fixed children,
  // which otherwise traps a modal opened from it (My Profile) behind the page.
  return createPortal(
    // Outer layer scrolls (not just the modal body) so a modal taller than the
    // viewport can never clip its own header/top off-screen with no way back to it.
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 backdrop-blur-sm">
      <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-4">
        <div className={cn('my-auto w-full rounded-t-2xl sm:rounded-card bg-surface/95 ring-1 ring-white/15 shadow-[0_8px_16px_-4px_rgba(0,0,0,0.12),0_24px_48px_-12px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.3)] backdrop-blur-2xl backdrop-saturate-150 max-h-[92vh] flex flex-col', w)}>
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

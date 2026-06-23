import { Icon } from './Icon'
import { cn } from '@/lib/utils'
export function Modal({ open, onClose, title, children, size = 'md' }:
  { open: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: 'md' | 'lg' | 'xl' }) {
  if (!open) return null
  const w = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size]
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className={cn('w-full rounded-t-2xl sm:rounded-card bg-surface shadow-fiori-lg max-h-[92vh] flex flex-col', w)}
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-horizon-line px-5 py-3.5">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-horizon-muted hover:bg-surface-sunken"><Icon name="close" /></button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}

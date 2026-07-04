import { cn } from '@/lib/utils'
import { Icon } from './Icon'
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant; icon?: string; loading?: boolean; size?: 'sm' | 'md'
}
// Flat, crisp buttons (Linear/Notion style): solid fills, 1px hairlines, colour
// shifts on hover/press only — no blur, glow or scale, which also keeps
// low-end mobile GPUs out of the hot path.
const styles: Record<Variant, string> = {
  // A lighter gold reads softer on the pure-white canvas; press deepens it.
  primary: 'bg-brand-400 text-coal-900 shadow-soft hover:bg-brand-300 active:bg-brand-500',
  secondary: 'bg-surface text-ink ring-1 ring-inset ring-surface-line hover:bg-surface-sunken active:bg-surface-sunken',
  ghost: 'text-ink-soft hover:bg-surface-sunken hover:text-ink active:bg-surface-sunken',
  danger: 'bg-bad/90 text-white hover:bg-bad active:brightness-90'
}
export function Button({ variant = 'primary', icon, loading, size = 'md', className, children, disabled, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn('inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors duration-100 disabled:opacity-50 disabled:cursor-not-allowed',
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm', styles[variant], className)}
    >
      {loading ? <Icon name="progress_activity" className="animate-spin text-[18px]" />
               : icon && <Icon name={icon} className="relative text-[18px]" />}
      <span className="relative">{children}</span>
    </button>
  )
}

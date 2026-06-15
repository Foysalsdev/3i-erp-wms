import { cn } from '@/lib/utils'
import { Icon } from './Icon'
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant; icon?: string; loading?: boolean; size?: 'sm' | 'md'
}
const styles: Record<Variant, string> = {
  primary: 'bg-brand-500 text-coal-900 hover:bg-brand-400 active:bg-brand-600',
  secondary: 'bg-surface text-ink ring-1 ring-inset ring-surface-line hover:bg-surface-sunken hover:ring-brand-300',
  ghost: 'text-ink-soft hover:bg-surface-sunken hover:text-ink',
  danger: 'bg-bad text-white hover:brightness-95'
}
export function Button({ variant = 'primary', icon, loading, size = 'md', className, children, disabled, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn('inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm', styles[variant], className)}
    >
      {loading ? <Icon name="progress_activity" className="animate-spin text-[18px]" />
               : icon && <Icon name={icon} className="text-[18px]" />}
      {children}
    </button>
  )
}

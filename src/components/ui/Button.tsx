import { cn } from '@/lib/utils'
import { Icon } from './Icon'
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant; icon?: string; loading?: boolean; size?: 'sm' | 'md'
}
const styles: Record<Variant, string> = {
  // Main CTA: Whirlpool-gold liquid glass — translucent + blurred + top sheen, invites the click
  primary: cn(
    'relative isolate overflow-hidden text-coal-900',
    'bg-brand-500/90 backdrop-blur-md backdrop-saturate-150 ring-1 ring-white/40',
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_6px_20px_-6px_rgba(242,169,0,0.55)]',
    "before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/25 before:to-transparent before:content-['']",
    'hover:bg-brand-400/90 hover:shadow-glow active:bg-brand-600/90 hover:scale-[1.02] active:scale-[0.97]'
  ),
  // Neutral glass — same frosted language, no brand tint
  secondary: 'bg-surface/80 backdrop-blur-md text-ink ring-1 ring-inset ring-surface-line hover:bg-surface-sunken hover:ring-brand-300 hover:scale-[1.02] active:scale-[0.97]',
  // Ghost buttons live in dense toolbars/rows — a tap press only, no hover growth to avoid jitter
  ghost: 'text-ink-soft hover:bg-surface-sunken hover:text-ink active:scale-[0.95]',
  // Destructive: firmer press (no hover growth) so the click feels deliberate
  danger: 'bg-bad text-white hover:brightness-95 hover:shadow-[0_6px_20px_-4px_rgba(220,38,38,0.45)] active:scale-[0.95]'
}
export function Button({ variant = 'primary', icon, loading, size = 'md', className, children, disabled, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn('inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm', styles[variant], loading && 'animate-pulse-ring', className)}
    >
      {loading ? <Icon name="progress_activity" className="animate-spin text-[18px]" />
               : icon && <Icon name={icon} className="relative text-[18px]" />}
      <span className="relative">{children}</span>
    </button>
  )
}

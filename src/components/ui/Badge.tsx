import { cn } from '@/lib/utils'
export type Tone = 'positive' | 'negative' | 'critical' | 'info' | 'neutral' | 'brand'
const tones: Record<Tone, string> = {
  positive: 'bg-green-50 text-green-700 ring-green-200 dark:bg-green-500/15 dark:text-green-400 dark:ring-green-500/30',
  negative: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/15 dark:text-red-400 dark:ring-red-500/30',
  critical: 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:ring-orange-500/30',
  info: 'bg-accent-50 text-accent-700 ring-accent-200 dark:bg-accent-500/15 dark:text-accent-400 dark:ring-accent-500/30',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-400/15 dark:text-slate-300 dark:ring-slate-400/30',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-400 dark:ring-brand-500/30'
}
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children?: React.ReactNode }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', tones[tone])}>{children}</span>
}

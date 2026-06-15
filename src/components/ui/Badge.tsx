import { cn } from '@/lib/utils'
type Tone = 'positive' | 'negative' | 'critical' | 'info' | 'neutral' | 'brand'
const tones: Record<Tone, string> = {
  positive: 'bg-green-50 text-green-700 ring-green-200',
  negative: 'bg-red-50 text-red-700 ring-red-200',
  critical: 'bg-orange-50 text-orange-700 ring-orange-200',
  info: 'bg-accent-50 text-accent-700 ring-accent-200',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200'
}
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children?: React.ReactNode }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', tones[tone])}>{children}</span>
}

import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

// Shared visual language for the Finance forms: a colour-coded icon badge per
// section/stat so the page reads in distinct blocks instead of one flat grey
// sheet of hairline-bordered fields.
const TONE = {
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
  ok: 'bg-ok/10 text-ok',
  bad: 'bg-bad/10 text-bad',
  warn: 'bg-warn/10 text-warn'
} as const
export type FinanceTone = keyof typeof TONE

export function SectionHeader({ icon, tone = 'brand', title, action }:
  { icon: string; tone?: FinanceTone; title: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-lg', TONE[tone])}>
          <Icon name={icon} className="text-[16px]" />
        </span>
        <p className="truncate text-sm font-semibold text-ink">{title}</p>
      </div>
      {action}
    </div>
  )
}

export function StatCard({ icon, tone = 'brand', label, value }:
  { icon: string; tone?: FinanceTone; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-surface-line bg-surface p-3.5 min-w-0">
      <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', TONE[tone])}>
        <Icon name={icon} className="text-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{label}</p>
        <p className="mt-0.5 truncate text-base font-semibold text-ink">{value}</p>
      </div>
    </div>
  )
}

// A visually-grouped panel for a cluster of form fields — a faint tint plus a
// header, so the eye can chunk the form into named sections at a glance.
export function FinancePanel({ icon, tone = 'brand', title, action, children }:
  { icon: string; tone?: FinanceTone; title: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-surface-line bg-surface-sunken/40 p-4">
      <SectionHeader icon={icon} tone={tone} title={title} action={action} />
      {children}
    </div>
  )
}

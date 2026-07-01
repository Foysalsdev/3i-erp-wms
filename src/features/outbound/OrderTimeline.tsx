import { useMemo } from 'react'
import { useTimeline } from '@/hooks/useTimeline'
import { Icon } from '@/components/ui/Icon'
import { formatDateTime } from '@/lib/utils'
import { SO_STATUS_NARRATIVE, SO_STATUS_ORDER } from './orderNarrative'

// Friendly "what happened, when" narrative — reads the same audit_logs data as
// DocTimeline but collapses it to one row per status first reached, so a new
// row appears automatically the next time this is opened after any status
// change (approve, pick & scan, mark invoiced, plan delivery, deliver).
export function OrderTimeline({ so }: { so: { id: string; status: string } }) {
  const { rows, loading } = useTimeline('sales_orders', so.id)

  const steps = useMemo(() => {
    const events = [...rows].reverse() // oldest first
    const firstReachedAt: Record<string, string> = {}
    events.forEach((e: any) => {
      const status = e.new_data?.status
      if (status && !firstReachedAt[status]) firstReachedAt[status] = e.changed_at
    })
    const seenLabels = new Set<string>()
    const out: { label: string; icon: string; description: string; at: string }[] = []
    SO_STATUS_ORDER.forEach(status => {
      const at = firstReachedAt[status]
      const n = SO_STATUS_NARRATIVE[status]
      if (!at || !n || seenLabels.has(n.label)) return
      seenLabels.add(n.label)
      out.push({ ...n, at })
    })
    return out
  }, [rows])

  if (loading) return <p className="rounded-xl border border-surface-line p-3.5 text-sm text-ink-faint">Loading timeline…</p>

  if (so.status === 'cancelled') {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-bad/30 bg-bad/5 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bad text-white"><Icon name="cancel" className="text-[18px]" /></span>
        <div>
          <p className="text-sm font-semibold text-bad">Cancelled</p>
          <p className="text-xs text-ink-soft">This order was cancelled — workflow stopped.</p>
        </div>
      </div>
    )
  }

  if (steps.length === 0) return <p className="rounded-xl border border-surface-line p-3.5 text-sm text-ink-faint">No activity yet — steps appear here as the order progresses.</p>

  return (
    <div className="rounded-xl border border-surface-line p-4">
      {steps.map((s, i) => (
        <div key={s.label} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ok text-white"><Icon name="check" className="text-[16px]" /></span>
            {i < steps.length - 1 && <span className="my-1 w-px flex-1 bg-surface-line" />}
          </div>
          <div className={'min-w-0 flex-1 ' + (i < steps.length - 1 ? 'pb-4' : '')}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <p className="text-sm font-semibold text-ink">{s.label}</p>
              <p className="shrink-0 text-[11px] text-ink-faint">{formatDateTime(s.at)}</p>
            </div>
            <p className="mt-0.5 text-xs text-ink-soft">{s.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

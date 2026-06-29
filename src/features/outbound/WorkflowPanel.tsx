import { Icon } from '@/components/ui/Icon'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import { OUTBOUND_STAGES, workflowState } from './workflow'

// WES #6 "Workflow Driven": shows where an order is, what's next, who owns the
// pending action and when it's expected — so a user never has to guess.
export function WorkflowPanel({ order, responsibleName }: {
  order: { status: string; order_date?: string | null; required_date?: string | null }
  responsibleName?: string | null
}) {
  const wf = workflowState(order)
  // A named owner (if assigned) takes precedence over the stage's default role.
  const responsible = !wf.cancelled && wf.next && responsibleName ? responsibleName : wf.role

  if (wf.cancelled) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-bad/30 bg-bad/5 p-4">
        <Icon name="cancel" className="text-[20px] text-bad" />
        <span className="text-sm font-medium text-bad">Order cancelled — workflow stopped.</span>
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-xl border border-surface-line bg-surface-sunken/40 p-4">
      {/* Stepper */}
      <div className="flex items-center gap-1">
        {OUTBOUND_STAGES.map((st, i) => {
          const done = i < wf.index || (i === wf.index && (st.key === 'delivered'))
          const isCurrent = i === wf.index
          return (
            <div key={st.key} className="flex flex-1 items-center" style={{ minWidth: 56 }}>
              <div className="flex flex-col items-center gap-1">
                <div className={'flex h-7 w-7 items-center justify-center rounded-full text-[13px] ' +
                  (isCurrent ? 'bg-brand-500 text-white ring-4 ring-brand-100' : done ? 'bg-brand-500 text-white' : 'border border-surface-line bg-surface text-ink-faint')}>
                  {done && !isCurrent ? <Icon name="check" className="text-[15px]" /> : <Icon name={st.icon} className="text-[15px]" />}
                </div>
                <span className={'whitespace-nowrap text-[10px] ' + (isCurrent ? 'font-semibold text-ink' : 'text-ink-faint')}>{st.label}</span>
              </div>
              {i < OUTBOUND_STAGES.length - 1 && <div className={'mx-1 h-0.5 flex-1 rounded ' + (i < wf.index ? 'bg-brand-500' : 'bg-surface-line')} />}
            </div>
          )
        })}
      </div>

      {/* Stage context: previous / current / next */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
        <span>Previous: <span className="font-medium text-ink">{wf.previous?.label ?? '—'}</span></span>
        <Icon name="chevron_right" className="text-[14px] text-ink-faint" />
        <span>Current: <Badge tone="info">{wf.current?.label ?? '—'}</Badge></span>
        <Icon name="chevron_right" className="text-[14px] text-ink-faint" />
        <span>Next: <span className="font-medium text-ink">{wf.next?.label ?? 'Done'}</span></span>
      </div>

      {/* Pending action / responsible / expected */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-surface-line bg-surface p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">Pending Action</p>
          <p className="mt-0.5 text-sm font-medium text-ink">{wf.action}</p>
        </div>
        <div className="rounded-lg border border-surface-line bg-surface p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">Responsible</p>
          <p className="mt-0.5 flex items-center gap-1 text-sm font-medium text-ink"><Icon name="badge" className="text-[16px] text-ink-faint" />{responsible}</p>
        </div>
        <div className="rounded-lg border border-surface-line bg-surface p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">Expected Completion</p>
          <p className="mt-0.5 flex items-center gap-2 text-sm font-medium text-ink">
            {wf.expected ? formatDate(wf.expected.toISOString().slice(0, 10)) : '—'}
            {wf.overdue && <Badge tone="negative">Overdue</Badge>}
          </p>
        </div>
      </div>
    </div>
  )
}

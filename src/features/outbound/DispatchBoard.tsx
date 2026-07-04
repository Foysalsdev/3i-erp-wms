import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/States'
import { formatNumber } from '@/lib/utils'
import { OUTBOUND_STAGES, workflowState } from './workflow'

// Task-first outbound board (docs/TRACKING-ARCHITECTURE plan): every live order
// as a card in its workflow column (Order -> Picked -> Invoiced -> Dispatched
// -> Delivered), so the dispatch desk sees at a glance what is stuck where and
// what's overdue — instead of scanning a status-filtered table. A card taps
// through to that order, where all the stage actions already live.

const daysBetween = (a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / 86400000)

export function DispatchBoard() {
  const { currentClientId } = useAuth()
  const nav = useNavigate()
  const [orders, setOrders] = useState<any[]>([])
  const [customers, setCustomers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentClientId) return
    setLoading(true)
    Promise.all([
      supabase.from('sales_orders').select('id,so_no,customer_id,order_date,required_date,status,total_qty')
        .eq('client_id', currentClientId).not('status', 'in', '(cancelled)').order('order_date', { ascending: true }).limit(400),
      supabase.from('customers').select('id,name').eq('client_id', currentClientId)
    ]).then(([so, cust]) => {
      setOrders(so.data ?? [])
      setCustomers(Object.fromEntries((cust.data ?? []).map((c: any) => [c.id, c.name])))
      setLoading(false)
    })
  }, [currentClientId])

  // Bucket orders into their workflow stage; delivered/closed collapse into the
  // final column but are capped so the board stays about live work.
  const byStage = useMemo(() => {
    const map: Record<string, any[]> = Object.fromEntries(OUTBOUND_STAGES.map(s => [s.key, []]))
    for (const o of orders) {
      const st = OUTBOUND_STAGES.find(s => s.statuses.includes(o.status))
      if (st) map[st.key].push(o)
    }
    return map
  }, [orders])

  const overdueTotal = useMemo(() =>
    orders.filter(o => !['delivered', 'closed'].includes(o.status) && workflowState(o).overdue).length,
  [orders])

  if (loading) return <Spinner label="Loading dispatch board…" />

  const liveCount = orders.filter(o => !['delivered', 'closed'].includes(o.status)).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink-soft"><b className="text-ink">{liveCount}</b> live order(s) across the pipeline</span>
        {overdueTotal > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md bg-bad/10 px-2 py-0.5 text-xs font-semibold text-bad">
            <Icon name="warning" className="text-[14px]" /> {overdueTotal} overdue
          </span>
        )}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {OUTBOUND_STAGES.map(stage => {
          const list = byStage[stage.key] ?? []
          const shown = stage.key === 'delivered' ? list.slice(-25).reverse() : list
          const overdue = list.filter(o => workflowState(o).overdue && !['delivered', 'closed'].includes(o.status)).length
          return (
            <div key={stage.key} className="flex w-64 shrink-0 flex-col rounded-xl border border-surface-line bg-surface-sunken/40">
              <div className="flex items-center gap-2 border-b border-surface-line px-3 py-2.5">
                <Icon name={stage.icon} className="text-[18px] text-ink-faint" />
                <span className="text-sm font-semibold text-ink">{stage.label}</span>
                <span className="ml-auto rounded-md bg-surface px-1.5 py-0.5 text-xs font-semibold tabular-nums text-ink-soft ring-1 ring-surface-line">{list.length}</span>
                {overdue > 0 && <span className="rounded-md bg-bad/10 px-1.5 py-0.5 text-[11px] font-semibold text-bad">{overdue}</span>}
              </div>
              <div className="flex max-h-[64vh] flex-col gap-2 overflow-y-auto p-2">
                {shown.length === 0 && <p className="px-2 py-6 text-center text-xs text-ink-faint">Empty</p>}
                {shown.map(o => {
                  const wf = workflowState(o)
                  const done = ['delivered', 'closed'].includes(o.status)
                  const ageDays = daysBetween(new Date(o.order_date), new Date())
                  return (
                    <button key={o.id} type="button"
                      onClick={() => nav(`/outbound/sales-order?q=${encodeURIComponent(o.so_no)}`)}
                      className={'rounded-lg border bg-surface p-2.5 text-left transition-colors hover:border-brand-400 ' +
                        (wf.overdue && !done ? 'border-bad/40' : 'border-surface-line')}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate font-mono text-xs font-semibold text-ink">{o.so_no}</span>
                        {done
                          ? <Icon name="check_circle" className="shrink-0 text-[15px] text-ok" />
                          : wf.overdue
                            ? <span className="shrink-0 rounded bg-bad/10 px-1 text-[10px] font-bold text-bad">OVERDUE</span>
                            : <span className="shrink-0 text-[10px] text-ink-faint tabular-nums">{ageDays}d</span>}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-ink-soft">{customers[o.customer_id] ?? '—'}</p>
                      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-ink-faint">
                        <span className="truncate">{formatNumber(o.total_qty)} pcs</span>
                        {!done && <span className="truncate">{stage.role}</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-ink-faint">
        Cards sit in their current workflow stage. Red = past the expected time (SLA from Settings → Workflow).
        Tap a card to open the order and run the next step.
      </p>
    </div>
  )
}

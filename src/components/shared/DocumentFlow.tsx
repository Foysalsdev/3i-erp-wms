import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

// A horizontal, clickable chain of the documents that make up one business
// flow (e.g. Sales Order → Delivery Challan → Gate Pass). The document being
// viewed is highlighted; the others link to their module list, deep-linked to
// their number via ?q= (see useUrlSearch). This is the "document flow" an ERP
// leads with — it turns a pile of separate records into one traceable chain.
export interface FlowNode {
  icon: string
  type: string
  number: string
  status?: string
  tone?: 'positive' | 'negative' | 'critical' | 'info' | 'neutral' | 'brand'
  to?: string
  current?: boolean
}

export function DocumentFlow({ nodes, title = 'Document Flow' }: { nodes: (FlowNode | null | undefined)[]; title?: string }) {
  const real = nodes.filter(Boolean) as FlowNode[]
  if (real.length === 0) return null
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{title}</p>
      <div className="flex flex-wrap items-center gap-2">
        {real.map((n, i) => {
          const inner = (
            <div className={cn('flex min-w-[150px] items-center gap-2.5 rounded-xl border p-2.5 transition-colors',
              n.current ? 'border-brand-400 bg-brand-50 dark:bg-brand-500/10' : 'border-surface-line bg-surface hover:bg-surface-sunken')}>
              <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg',
                n.current ? 'bg-brand-400 text-coal-900' : 'bg-surface-sunken text-ink-soft')}>
                <Icon name={n.icon} className="text-[18px]" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">{n.type}</p>
                <p className="truncate text-sm font-semibold text-ink">{n.number}</p>
                {n.status && <div className="mt-0.5"><Badge tone={n.tone ?? 'neutral'}>{n.status}</Badge></div>}
              </div>
            </div>
          )
          return (
            <div key={i} className="flex items-center gap-2">
              {n.to && !n.current ? <Link to={n.to} className="block">{inner}</Link> : inner}
              {i < real.length - 1 && <Icon name="chevron_right" className="shrink-0 text-ink-faint" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

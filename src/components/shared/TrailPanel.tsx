import { useEntityTrail } from '@/hooks/useEntityTrail'
import { Icon } from '@/components/ui/Icon'
import { formatDateTime, formatNumber } from '@/lib/utils'
import { movementLabel, MOVEMENT_TYPES } from '@/lib/movements'

// Shared "what happened, when" trail (docs/TRACKING-ARCHITECTURE.md §3.2):
// merges audit_logs (status/field changes) with inventory_ledger (actual
// stock legs) into one chronological view, so seeing a document's history
// and its stock impact doesn't mean checking two different screens.
// Replaces the audit-only DocTimeline wherever a document also moves stock.

const show = (v: any) => v === null || v === undefined || v === '' ? '—' : String(v)
const fieldLabel = (f: string) => f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

export function TrailPanel({ table, recordId, referenceNo }: { table: string; recordId?: string; referenceNo?: string | null }) {
  const { events, loading } = useEntityTrail(table, recordId, referenceNo)

  if (loading) return <p className="rounded-xl border border-surface-line p-3.5 text-sm text-ink-faint">Loading activity…</p>
  if (events.length === 0) return <p className="rounded-xl border border-surface-line p-3.5 text-sm text-ink-faint">No history yet — events appear here as each step happens.</p>

  return (
    <div className="space-y-0 rounded-xl border border-surface-line p-3.5">
      {events.map((e, i) => {
        const last = i === events.length - 1
        if (e.kind === 'ledger') {
          const dir = e.qtyIn! > 0 ? 'in' : 'out'
          const icon = MOVEMENT_TYPES[e.movementType ?? '']?.icon ?? 'sync_alt'
          return (
            <div key={e.id} className="flex gap-3 pb-3">
              <div className="flex flex-col items-center">
                <span className={'flex h-7 w-7 items-center justify-center rounded-full ' + (dir === 'in' ? 'bg-ok/15 text-ok' : 'bg-warn/15 text-warn')}>
                  <Icon name={icon} className="text-[15px]" />
                </span>
                {!last && <span className="my-1 w-px flex-1 bg-surface-line" />}
              </div>
              <div className="min-w-0 text-sm">
                <p className="font-medium text-ink">
                  {movementLabel(e.movementType)}
                  {e.warehouseCode ? ` · ${e.warehouseCode}` : ''}
                  <span className={'ml-2 font-semibold ' + (dir === 'in' ? 'text-ok' : 'text-warn')}>
                    {dir === 'in' ? '+' : '−'}{formatNumber(dir === 'in' ? e.qtyIn : e.qtyOut)}
                  </span>
                </p>
                <p className="text-[11px] text-ink-faint">
                  {formatDateTime(e.at)}{e.by ? ` · by ${e.by}` : ''} · balance after {formatNumber(e.balanceAfter)}
                </p>
                {e.productLabel && <p className="mt-0.5 text-[11px] text-ink-soft">{e.productLabel}</p>}
              </div>
            </div>
          )
        }
        const head = e.action === 'INSERT' ? 'Created' : e.action === 'DELETE' ? 'Deleted' : e.status ? `Status → ${e.status}` : 'Updated'
        const tone = e.action === 'INSERT' ? 'bg-green-100 text-green-700' : e.action === 'DELETE' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
        const icon = e.action === 'INSERT' ? 'add' : e.action === 'DELETE' ? 'delete' : 'edit'
        return (
          <div key={e.id} className="flex gap-3 pb-3">
            <div className="flex flex-col items-center">
              <span className={'flex h-7 w-7 items-center justify-center rounded-full ' + tone}><Icon name={icon} className="text-[15px]" /></span>
              {!last && <span className="my-1 w-px flex-1 bg-surface-line" />}
            </div>
            <div className="min-w-0 text-sm">
              <p className="font-medium text-ink">{head}</p>
              <p className="text-[11px] text-ink-faint">{formatDateTime(e.at)}{e.by ? ` · by ${e.by}` : ''}</p>
              {(e.changes?.length ?? 0) > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {e.changes!.slice(0, 8).map(c => (
                    <li key={c.field} className="text-[11px] text-ink-soft">
                      <span className="text-ink-faint">{fieldLabel(c.field)}:</span> {show(c.from)} <span className="text-ink-faint">→</span> <span className="font-medium text-ink">{show(c.to)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTimeline } from '@/hooks/useTimeline'
import { Icon } from '@/components/ui/Icon'
import { formatDateTime } from '@/lib/utils'

// WES principle #9 "Audit First": a reusable who / when / what-changed trail for
// any document, derived from audit_logs (old_data → new_data diff).

// Noise fields that change on every write — hidden from the human diff.
const SKIP = new Set(['updated_at', 'created_at', 'id', 'client_id', 'created_by', 'posted_at'])

function diff(oldData: any, newData: any): { field: string; from: any; to: any }[] {
  if (!oldData || !newData) return []
  const out: { field: string; from: any; to: any }[] = []
  for (const k of Object.keys(newData)) {
    if (SKIP.has(k)) continue
    const a = oldData[k], b = newData[k]
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ field: k, from: a, to: b })
  }
  return out
}

const show = (v: any) => v === null || v === undefined || v === '' ? '—' : String(v)
const label = (f: string) => f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

export function DocTimeline({ table, recordId }: { table: string; recordId?: string }) {
  const { rows, loading } = useTimeline(table, recordId)
  const [names, setNames] = useState<Record<string, string>>({})

  useEffect(() => {
    supabase.from('profiles').select('id,full_name').then(({ data }) => {
      const m: Record<string, string> = {}; (data ?? []).forEach((r: any) => { m[r.id] = r.full_name || '—' }); setNames(m)
    })
  }, [])

  const events = [...rows].reverse() // chronological (oldest first)

  if (loading) return <p className="rounded-xl border border-surface-line p-3.5 text-sm text-ink-faint">Loading activity…</p>
  if (events.length === 0) return <p className="rounded-xl border border-surface-line p-3.5 text-sm text-ink-faint">No history yet — events appear here as each step happens.</p>

  return (
    <div className="space-y-0 rounded-xl border border-surface-line p-3.5">
      {events.map((e: any, i) => {
        const status = e.new_data?.status
        const changes = e.action === 'UPDATE' ? diff(e.old_data, e.new_data) : []
        const head = e.action === 'INSERT' ? 'Created' : e.action === 'DELETE' ? 'Deleted' : status ? `Status → ${status}` : 'Updated'
        const tone = e.action === 'INSERT' ? 'bg-green-100 text-green-700' : e.action === 'DELETE' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
        const icon = e.action === 'INSERT' ? 'add' : e.action === 'DELETE' ? 'delete' : 'edit'
        return (
          <div key={e.id} className="flex gap-3 pb-3">
            <div className="flex flex-col items-center">
              <span className={'flex h-7 w-7 items-center justify-center rounded-full ' + tone}><Icon name={icon} className="text-[15px]" /></span>
              {i < events.length - 1 && <span className="my-1 w-px flex-1 bg-surface-line" />}
            </div>
            <div className="min-w-0 text-sm">
              <p className="font-medium text-ink">{head}</p>
              <p className="text-[11px] text-ink-faint">{formatDateTime(e.changed_at)} · by {names[e.changed_by] ?? '—'}</p>
              {changes.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {changes.slice(0, 8).map(c => (
                    <li key={c.field} className="text-[11px] text-ink-soft">
                      <span className="text-ink-faint">{label(c.field)}:</span> {show(c.from)} <span className="text-ink-faint">→</span> <span className="font-medium text-ink">{show(c.to)}</span>
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

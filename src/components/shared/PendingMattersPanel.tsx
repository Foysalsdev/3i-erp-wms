import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { fetchPendingMatters, type PendingMatter } from '@/lib/pending'

// "Needs attention" — every pending matter the current user owns, oldest and
// overdue first, one tap deep-links to the exact work screen. Driven entirely
// by the PENDING_RULES registry; no per-module code here.
export function PendingMattersPanel() {
  const { currentClientId, can, isPlatformAdmin } = useAuth()
  const nav = useNavigate()
  const [matters, setMatters] = useState<PendingMatter[] | null>(null)
  const [filter, setFilter] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (!currentClientId) return
    let active = true
    fetchPendingMatters(currentClientId, can, isPlatformAdmin).then(m => { if (active) setMatters(m) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentClientId])

  const groups = useMemo(() => {
    const m = new Map<string, { label: string; icon: string; count: number; overdue: number }>()
    ;(matters ?? []).forEach(x => {
      const g = m.get(x.rule) ?? { label: x.label, icon: x.icon, count: 0, overdue: 0 }
      g.count++; if (x.overdue) g.overdue++
      m.set(x.rule, g)
    })
    return [...m.entries()]
  }, [matters])

  if (!matters) return null              // quiet while loading — the dashboard has its own spinner rhythm
  if (matters.length === 0) return null  // nothing pending: no panel, no noise

  const visible = (filter ? matters.filter(m => m.rule === filter) : matters).slice(0, showAll ? 100 : 6)
  const overdueTotal = matters.filter(m => m.overdue).length

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-surface-line px-4 py-3">
        <Icon name="notifications_active" className={'text-[20px] ' + (overdueTotal ? 'text-bad' : 'text-brand-600')} />
        <h2 className="text-sm font-semibold text-ink">Needs attention</h2>
        <span className="text-xs text-ink-soft">{matters.length} pending{overdueTotal ? ` · ${overdueTotal} overdue` : ''}</span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {groups.map(([key, g]) => (
            <button key={key} type="button" onClick={() => setFilter(f => f === key ? null : key)}
              className={'flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold ' +
                (filter === key ? 'bg-brand-500/15 text-brand-700'
                  : g.overdue ? 'bg-bad/10 text-bad' : 'bg-surface-sunken text-ink-soft hover:text-ink')}>
              <Icon name={g.icon} className="text-[13px]" /> {g.label} · {g.count}
            </button>
          ))}
        </div>
      </div>
      <div>
        {visible.map((m, i) => (
          <button key={m.rule + m.docNo} type="button" onClick={() => nav(m.route)}
            className={'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface-sunken ' + (i ? 'border-t border-surface-line/70' : '')}>
            <Icon name={m.icon} className="shrink-0 text-[18px] text-ink-faint" />
            <span className="min-w-0 flex-1">
              <span className="font-mono font-medium text-ink">{m.docNo}</span>
              <span className="ml-2 truncate text-ink-soft">{m.matter}</span>
            </span>
            <span className={'shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ' +
              (m.overdue ? 'bg-bad/10 text-bad' : 'bg-surface-sunken text-ink-faint')}>
              {m.ageDays === 0 ? 'today' : `${m.ageDays}d`}
            </span>
            <Icon name="chevron_right" className="shrink-0 text-[16px] text-ink-faint" />
          </button>
        ))}
      </div>
      {(filter ? matters.filter(m => m.rule === filter) : matters).length > 6 && (
        <button type="button" onClick={() => setShowAll(s => !s)}
          className="w-full border-t border-surface-line px-4 py-2 text-center text-xs font-semibold text-brand-700 hover:bg-surface-sunken">
          {showAll ? 'Show less' : `Show all ${(filter ? matters.filter(m => m.rule === filter) : matters).length}`}
        </button>
      )}
    </Card>
  )
}

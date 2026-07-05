import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Spinner, EmptyState } from '@/components/ui/States'
import { SearchBar } from '@/components/shared/SearchBar'
import { fetchAllPendingMatters, type PendingMatter } from '@/lib/pending'
import { downloadCSV, downloadReportPDF, ReportToolbar, type RepCol } from '../export'

// Full pending-matters register (docs/TRACKING-ARCHITECTURE.md §3.3): every
// open matter across the warehouse regardless of owner, oldest/overdue first,
// with the responsible role and age. Same rule engine as the dashboard strip,
// so a new module's rule shows up here automatically. Managers' single view
// of "what is the whole operation waiting on".
export function PendingMattersReport() {
  const { currentClientId } = useAuth()
  const nav = useNavigate()
  const [matters, setMatters] = useState<PendingMatter[] | null>(null)
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<string | null>(null)

  useEffect(() => {
    if (!currentClientId) return
    let active = true
    setMatters(null)
    fetchAllPendingMatters(currentClientId).then(m => { if (active) setMatters(m) })
    return () => { active = false }
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

  const rows = useMemo(() => {
    let list = matters ?? []
    if (group) list = list.filter(m => m.rule === group)
    const t = q.trim().toLowerCase()
    if (t) list = list.filter(m => [m.docNo, m.matter, m.owner, m.label].some(v => v.toLowerCase().includes(t)))
    return list
  }, [matters, group, q])

  const cols: RepCol[] = [
    { key: 'label', header: 'Category', width: '18%' },
    { key: 'docNo', header: 'Document', width: '16%' },
    { key: 'matter', header: 'Pending action', width: '34%' },
    { key: 'owner', header: 'Owner', width: '16%' },
    { key: 'age', header: 'Age', align: 'right', width: '8%' },
    { key: 'flag', header: 'Status', width: '8%' }
  ]
  const exportRows = rows.map(m => ({
    label: m.label, docNo: m.docNo, matter: m.matter, owner: m.owner,
    age: m.ageDays === 0 ? 'today' : `${m.ageDays}d`, flag: m.overdue ? 'OVERDUE' : 'open'
  }))

  if (!matters) return <Spinner label="Evaluating pending matters…" />

  const overdue = matters.filter(m => m.overdue).length

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <ReportToolbar count={rows.length}
        onCSV={() => downloadCSV('Pending Matters', cols, exportRows)}
        onPDF={() => downloadReportPDF('Pending Matters', `${matters.length} open · ${overdue} overdue`, cols, exportRows)}>
        <div className="w-full sm:w-64"><SearchBar value={q} onChange={setQ} placeholder="Search doc / owner…" /></div>
      </ReportToolbar>

      {matters.length === 0 ? (
        <Card className="p-2"><EmptyState icon="check_circle" title="Nothing pending"
          hint="Every tracked matter is clear across inbound, outbound and inventory." /></Card>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setGroup(null)}
              className={'rounded-md px-2.5 py-1 text-xs font-semibold ' + (group === null ? 'bg-brand-500/15 text-brand-700' : 'bg-surface-sunken text-ink-soft hover:text-ink')}>
              All · {matters.length}
            </button>
            {groups.map(([key, g]) => (
              <button key={key} type="button" onClick={() => setGroup(k => k === key ? null : key)}
                className={'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold ' +
                  (group === key ? 'bg-brand-500/15 text-brand-700' : g.overdue ? 'bg-bad/10 text-bad' : 'bg-surface-sunken text-ink-soft hover:text-ink')}>
                <Icon name={g.icon} className="text-[13px]" /> {g.label} · {g.count}
              </button>
            ))}
          </div>

          <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="sticky top-0 z-10 bg-surface-sunken text-[11px] uppercase tracking-wide text-ink-faint">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Category</th>
                    <th className="px-3 py-2 text-left font-semibold">Document</th>
                    <th className="px-3 py-2 text-left font-semibold">Pending action</th>
                    <th className="px-3 py-2 text-left font-semibold">Owner</th>
                    <th className="px-3 py-2 text-right font-semibold">Age</th>
                    <th className="px-3 py-2 text-right font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(m => (
                    <tr key={m.rule + m.docNo} onClick={() => nav(m.route)}
                      className="cursor-pointer border-t border-surface-line hover:bg-surface-sunken/60">
                      <td className="px-3 py-2 text-ink-soft"><span className="inline-flex items-center gap-1"><Icon name={m.icon} className="text-[15px] text-ink-faint" /> {m.label}</span></td>
                      <td className="px-3 py-2 font-mono font-medium text-ink">{m.docNo}</td>
                      <td className="px-3 py-2 text-ink-soft">{m.matter}</td>
                      <td className="px-3 py-2 text-ink-soft">{m.owner}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-ink-soft">{m.ageDays === 0 ? 'today' : `${m.ageDays}d`}</td>
                      <td className="px-3 py-2 text-right">
                        {m.overdue
                          ? <span className="rounded-md bg-bad/10 px-1.5 py-0.5 text-[11px] font-semibold text-bad">Overdue</span>
                          : <Icon name="chevron_right" className="text-[16px] text-ink-faint" />}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-ink-faint">No matches</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Card } from '@/components/ui/Card'
import { Spinner, EmptyState } from '@/components/ui/States'
import { SearchBar } from '@/components/shared/SearchBar'
import { formatNumber } from '@/lib/utils'
import { downloadCSV, downloadReportPDF, type RepCol } from '../export'
import type { DailyRow } from '../dailyInOutExcel'

// ---------------------------------------------------------------------------
// Daily Inbound & Outbound Report — the app-native replacement for the manual
// "RB02 Daily Inbound and Outbound Report" Excel. Everything is computed live
// from inventory_ledger: GRN = inbound, DELIVERY = outbound, REPLACEMENT =
// replacement, anything else nets into Adjust/Other. Opening = ledger balance
// before the 1st of the selected month; Closing = Opening + month net.
// ---------------------------------------------------------------------------

type Flow = 'summary' | 'inbound' | 'outbound' | 'replacement'

const ymNow = () => new Date().toISOString().slice(0, 7)
const daysInMonth = (ym: string) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate()

interface LedgerRow { product_id: string | null; movement_type: string; qty_in: number; qty_out: number; created_at: string }
type ProdInfo = Pick<Tables<'products'>, 'id' | 'material_code' | 'name' | 'category'>

// Supabase caps a select at 1000 rows — page through the full ledger history
// up to the end of the selected month.
async function fetchLedger(clientId: string, beforeIso: string): Promise<LedgerRow[]> {
  const out: LedgerRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('inventory_ledger')
      .select('product_id,movement_type,qty_in,qty_out,created_at')
      .eq('client_id', clientId).lt('created_at', beforeIso)
      .order('created_at', { ascending: true }).range(from, from + 999)
    if (error) throw error
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: 'in' | 'out' }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-ink-faint">{label}</p>
      <p className={'mt-1 text-xl font-bold ' + (tone === 'in' ? 'text-ok' : tone === 'out' ? 'text-bad' : 'text-ink')}>{value}</p>
    </Card>
  )
}

const FLOWS: { key: Flow; label: string; icon?: string }[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'inbound', label: 'Daily Inbound' },
  { key: 'outbound', label: 'Daily Outbound' },
  { key: 'replacement', label: 'Daily Replacement' }
]

export function DailyInOutReport() {
  const { currentClientId, clients } = useAuth()
  const clientName = clients.find(c => c.id === currentClientId)?.name ?? ''
  const notify = useUI(s => s.notify)
  const [ym, setYm] = useState(ymNow())
  const [flow, setFlow] = useState<Flow>('summary')
  const [q, setQ] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<ProdInfo[]>([])
  const [ledger, setLedger] = useState<LedgerRow[]>([])

  const days = daysInMonth(ym)
  const monthStart = `${ym}-01`
  const nextMonth = (() => {
    const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7))
    return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  })()

  useEffect(() => {
    if (!currentClientId) return
    setLoading(true)
    Promise.all([
      supabase.from('products').select('id,material_code,name,category').eq('client_id', currentClientId),
      fetchLedger(currentClientId, nextMonth)
    ]).then(([{ data: prods }, led]) => {
      setProducts(prods ?? []); setLedger(led)
    }).catch((e: any) => notify('error', e?.message ?? 'Could not load report data'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentClientId, ym])

  const rows: DailyRow[] = useMemo(() => {
    const agg = new Map<string, DailyRow>()
    const blank = (p: ProdInfo): DailyRow => ({
      code: p.material_code ?? '', name: p.name ?? '', category: p.category || 'Uncategorized',
      opening: 0, inbound: 0, outbound: 0, replIn: 0, replOut: 0, otherNet: 0, closing: 0,
      inByDay: Array.from({ length: days }, () => 0),
      outByDay: Array.from({ length: days }, () => 0),
      replByDay: Array.from({ length: days }, () => 0)
    })
    const byId = new Map(products.map(p => [p.id, p]))
    for (const m of ledger) {
      if (!m.product_id) continue
      const p = byId.get(m.product_id)
      if (!p) continue
      let r = agg.get(m.product_id)
      if (!r) { r = blank(p); agg.set(m.product_id, r) }
      const qin = Number(m.qty_in) || 0, qout = Number(m.qty_out) || 0
      const date = m.created_at.slice(0, 10)
      if (date < monthStart) { r.opening += qin - qout; continue }
      const d = Number(date.slice(8, 10)) - 1
      if (m.movement_type === 'GRN') { r.inbound += qin; r.inByDay[d] += qin; r.otherNet -= qout }
      else if (m.movement_type === 'DELIVERY') { r.outbound += qout; r.outByDay[d] += qout; r.otherNet += qin }
      else if (m.movement_type === 'REPLACEMENT') { r.replIn += qin; r.replOut += qout; r.replByDay[d] += qout }
      else { r.otherNet += qin - qout }
    }
    const list = [...agg.values()]
    if (showAll) {
      // Also list products with no history at all, so the sheet mirrors the
      // full SKU list the team is used to seeing.
      const have = new Set([...agg.keys()].map(id => byId.get(id)?.material_code))
      products.filter(p => !have.has(p.material_code)).forEach(p => list.push(blank(p)))
    }
    list.forEach(r => { r.closing = r.opening + r.inbound - r.outbound + r.replIn - r.replOut + r.otherNet })
    list.sort((a, b) => a.category.localeCompare(b.category) || a.code.localeCompare(b.code))
    const t = q.trim().toLowerCase()
    return t ? list.filter(r => r.code.toLowerCase().includes(t) || r.name.toLowerCase().includes(t)) : list
  }, [ledger, products, days, monthStart, q, showAll])

  const totals = useMemo(() => rows.reduce((s, r) => ({
    opening: s.opening + r.opening, inbound: s.inbound + r.inbound, outbound: s.outbound + r.outbound,
    repl: s.repl + r.replOut, closing: s.closing + r.closing
  }), { opening: 0, inbound: 0, outbound: 0, repl: 0, closing: 0 }), [rows])

  // Group for category subtotal rows.
  const grouped = useMemo(() => {
    const m = new Map<string, DailyRow[]>()
    rows.forEach(r => { if (!m.has(r.category)) m.set(r.category, []); m.get(r.category)!.push(r) })
    return [...m.entries()]
  }, [rows])

  const monthLabel = new Date(`${ym}-01T00:00:00`).toLocaleString('en-GB', { month: 'long', year: 'numeric' })
  const pickDay = (r: DailyRow) => flow === 'inbound' ? r.inByDay : flow === 'outbound' ? r.outByDay : r.replByDay

  const exportExcel = async () => {
    try {
      const { downloadDailyInOutExcel } = await import('../dailyInOutExcel')
      await downloadDailyInOutExcel({ clientName, ym, days, rows })
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not generate Excel file')
    }
  }

  const exportCsvPdf = (kind: 'csv' | 'pdf') => {
    if (flow === 'summary') {
      const cols: RepCol[] = [
        { key: 'code', header: 'Code', width: '9%' }, { key: 'name', header: 'SKU Description', width: '33%' },
        { key: 'opening', header: 'Opening', align: 'right', width: '9%' }, { key: 'inbound', header: 'Inbound', align: 'right', width: '9%' },
        { key: 'outbound', header: 'Outbound', align: 'right', width: '9%' }, { key: 'replin', header: 'Repl. In', align: 'right', width: '8%' },
        { key: 'replout', header: 'Repl. Out', align: 'right', width: '8%' }, { key: 'other', header: 'Adjust/Other', align: 'right', width: '8%' },
        { key: 'closing', header: 'Closing', align: 'right', width: '9%' }
      ]
      const data = rows.map(r => ({ code: r.code, name: r.name, opening: r.opening, inbound: r.inbound, outbound: r.outbound, replin: r.replIn, replout: r.replOut, other: r.otherNet, closing: r.closing }))
      if (kind === 'csv') downloadCSV(`Daily Summary ${ym}`, cols, data)
      else downloadReportPDF(`Daily Inbound & Outbound Summary`, `${clientName} · ${monthLabel} · ${rows.length} SKUs`, cols, data)
    } else {
      const label = FLOWS.find(f => f.key === flow)!.label
      const cols: RepCol[] = [
        { key: 'code', header: 'Code' }, { key: 'name', header: 'SKU Description' },
        ...Array.from({ length: days }, (_, i) => ({ key: `d${i + 1}`, header: String(i + 1), align: 'right' as const })),
        { key: 'total', header: 'Total', align: 'right' }
      ]
      const data = rows.map(r => {
        const byDay = pickDay(r)
        return { code: r.code, name: r.name, total: byDay.reduce((s, v) => s + v, 0), ...Object.fromEntries(byDay.map((v, i) => [`d${i + 1}`, v || ''])) }
      })
      if (kind === 'csv') downloadCSV(`${label} ${ym}`, cols, data)
      else downloadReportPDF(label, `${clientName} · ${monthLabel}`, cols, data)
    }
  }

  if (loading) return <Spinner label="Building report from stock movements…" />

  const th = 'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-faint whitespace-nowrap'
  const td = 'px-3 py-1.5 whitespace-nowrap'
  const num = 'text-right tabular-nums'

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <input type="month" value={ym} onChange={e => e.target.value && setYm(e.target.value)} className="fiori-input w-auto py-2" />
        <div className="flex overflow-hidden rounded-lg border border-surface-line">
          {FLOWS.map(f => (
            <button key={f.key} type="button" onClick={() => setFlow(f.key)}
              className={'px-3 py-2 text-sm font-medium ' + (flow === f.key ? 'bg-brand-500/15 text-brand-700' : 'text-ink-soft hover:bg-surface-sunken')}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="w-full sm:w-60"><SearchBar value={q} onChange={setQ} placeholder="Search SKU…" /></div>
        <label className="flex items-center gap-1.5 text-sm text-ink-soft">
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} className="rounded" /> All SKUs
        </label>
        <div className="ml-auto flex gap-2">
          <button onClick={exportExcel} className="inline-flex items-center gap-1 rounded-lg bg-brand-400 px-3 py-1.5 text-sm font-semibold text-coal-900 hover:bg-brand-300">Excel (full report)</button>
          <button onClick={() => exportCsvPdf('csv')} className="rounded-lg border border-surface-line px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-surface-sunken">CSV</button>
          <button onClick={() => exportCsvPdf('pdf')} className="rounded-lg border border-surface-line px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-surface-sunken">PDF</button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label={`Opening (1 ${monthLabel.split(' ')[0]})`} value={formatNumber(totals.opening)} />
        <StatCard label="Total Inbound" value={formatNumber(totals.inbound)} tone="in" />
        <StatCard label="Total Outbound" value={formatNumber(totals.outbound)} tone="out" />
        <StatCard label="Replacements Issued" value={formatNumber(totals.repl)} />
        <StatCard label="Closing Inventory" value={formatNumber(totals.closing)} />
      </div>

      {rows.length === 0 ? (
        <Card className="p-2"><EmptyState icon="analytics" title="No stock activity for this month"
          hint="Inbound (GRN), outbound (delivery) and replacement postings will appear here automatically." /></Card>
      ) : flow === 'summary' ? (
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="sticky top-0 z-10 bg-surface-sunken">
                <tr>
                  <th className={th}>Code</th><th className={th}>SKU Description</th>
                  <th className={`${th} text-right`}>Opening</th><th className={`${th} text-right`}>Inbound</th>
                  <th className={`${th} text-right`}>Outbound</th><th className={`${th} text-right`}>Repl. In</th>
                  <th className={`${th} text-right`}>Repl. Out</th><th className={`${th} text-right`}>Adjust/Other</th>
                  <th className={`${th} text-right`}>Closing</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(([cat, list]) => {
                  const s = list.reduce((a, r) => ({
                    opening: a.opening + r.opening, inbound: a.inbound + r.inbound, outbound: a.outbound + r.outbound,
                    replIn: a.replIn + r.replIn, replOut: a.replOut + r.replOut, other: a.other + r.otherNet, closing: a.closing + r.closing
                  }), { opening: 0, inbound: 0, outbound: 0, replIn: 0, replOut: 0, other: 0, closing: 0 })
                  return [
                    ...list.map(r => (
                      <tr key={cat + r.code} className="border-t border-surface-line hover:bg-surface-sunken/50">
                        <td className={`${td} font-medium`}>{r.code}</td>
                        <td className={`${td} max-w-[360px] truncate`}>{r.name}</td>
                        <td className={`${td} ${num}`}>{formatNumber(r.opening)}</td>
                        <td className={`${td} ${num} text-ok`}>{r.inbound ? formatNumber(r.inbound) : ''}</td>
                        <td className={`${td} ${num} text-bad`}>{r.outbound ? formatNumber(r.outbound) : ''}</td>
                        <td className={`${td} ${num}`}>{r.replIn ? formatNumber(r.replIn) : ''}</td>
                        <td className={`${td} ${num}`}>{r.replOut ? formatNumber(r.replOut) : ''}</td>
                        <td className={`${td} ${num}`}>{r.otherNet ? formatNumber(r.otherNet) : ''}</td>
                        <td className={`${td} ${num} font-semibold`}>{formatNumber(r.closing)}</td>
                      </tr>
                    )),
                    <tr key={cat + '__sub'} className="border-t border-surface-line bg-brand-50/60 font-semibold dark:bg-surface-sunken">
                      <td className={td} />
                      <td className={td}>Total {cat} (Pcs)</td>
                      <td className={`${td} ${num}`}>{formatNumber(s.opening)}</td>
                      <td className={`${td} ${num} text-ok`}>{formatNumber(s.inbound)}</td>
                      <td className={`${td} ${num} text-bad`}>{formatNumber(s.outbound)}</td>
                      <td className={`${td} ${num}`}>{formatNumber(s.replIn)}</td>
                      <td className={`${td} ${num}`}>{formatNumber(s.replOut)}</td>
                      <td className={`${td} ${num}`}>{formatNumber(s.other)}</td>
                      <td className={`${td} ${num}`}>{formatNumber(s.closing)}</td>
                    </tr>
                  ]
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="text-sm">
              <thead className="sticky top-0 z-10 bg-surface-sunken">
                <tr>
                  <th className={`${th} sticky left-0 z-10 bg-surface-sunken`}>Code</th>
                  <th className={th}>SKU Description</th>
                  {Array.from({ length: days }, (_, i) => <th key={i} className={`${th} text-right`}>{i + 1}</th>)}
                  <th className={`${th} text-right`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(([cat, list]) => {
                  const sub = Array.from({ length: days }, () => 0)
                  const rowsJsx = list.map(r => {
                    const byDay = pickDay(r)
                    byDay.forEach((v, i) => { sub[i] += v })
                    const total = byDay.reduce((s, v) => s + v, 0)
                    return (
                      <tr key={cat + r.code} className="border-t border-surface-line hover:bg-surface-sunken/50">
                        <td className={`${td} sticky left-0 z-10 bg-surface font-medium`}>{r.code}</td>
                        <td className={`${td} max-w-[280px] truncate`}>{r.name}</td>
                        {byDay.map((v, i) => <td key={i} className={`${td} ${num}`}>{v ? formatNumber(v) : ''}</td>)}
                        <td className={`${td} ${num} font-semibold`}>{total ? formatNumber(total) : ''}</td>
                      </tr>
                    )
                  })
                  const subTotal = sub.reduce((s, v) => s + v, 0)
                  return [
                    ...rowsJsx,
                    <tr key={cat + '__sub'} className="border-t border-surface-line bg-brand-50/60 font-semibold dark:bg-surface-sunken">
                      <td className={`${td} sticky left-0 z-10 bg-brand-50/60 dark:bg-surface-sunken`} />
                      <td className={td}>Total {cat} (Pcs)</td>
                      {sub.map((v, i) => <td key={i} className={`${td} ${num}`}>{v ? formatNumber(v) : ''}</td>)}
                      <td className={`${td} ${num}`}>{subTotal ? formatNumber(subTotal) : ''}</td>
                    </tr>
                  ]
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="text-xs text-ink-faint">
        Computed live from stock movements — GRN postings count as inbound, issued delivery challans as outbound,
        posted replacements as replacement. Opening is the ledger balance before 1 {monthLabel}; closing = opening + month net.
      </p>
    </div>
  )
}

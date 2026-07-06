import { useMemo } from 'react'
import { useCollection } from '@/hooks/useCollection'
import { Card, CardHeader } from '@/components/ui/Card'
import { formatNumber } from '@/lib/utils'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid
} from 'recharts'

// Same fixed categorical order used on the main Dashboard (green/gold/orange/red/gray) —
// kept identical here so color meaning stays consistent across the app.
const CAT_COLORS = ['#16a34a', '#f2a900', '#ea7a0c', '#dc2626', '#8c8f94']
const MAX_SERIES = 5 // top categories get their own color; the rest fold into "Other"
const MONTHS_SHOWN = 6

const monthKey = (d: string) => (d ?? '').slice(0, 7)
const monthLabel = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })

const lastNMonths = (n: number) => {
  const out: string[] = []
  const d = new Date()
  d.setDate(1)
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1)
    out.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

export function FinancialDashboard() {
  const { data: receipts, loading: l1 } = useCollection('finance_fund_receipts', { order: 'receipt_date' })
  const { data: expenses, loading: l2 } = useCollection('finance_expenses', { order: 'expense_date' })
  const { data: categories } = useCollection('finance_expense_categories', { order: 'name', ascending: true })
  const catName = (id: string) => (categories as any[]).find(c => c.id === id)?.name ?? 'Uncategorized'

  const totalReceived = (receipts as any[]).reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const totalExpense = (expenses as any[]).reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const balance = totalReceived - totalExpense

  const months = useMemo(() => lastNMonths(MONTHS_SHOWN), [])

  // Cumulative balance at the end of each of the last N months.
  const balanceTrend = useMemo(() => {
    return months.map(ym => {
      const cutoff = new Date(`${ym}-01T00:00:00`)
      cutoff.setMonth(cutoff.getMonth() + 1); cutoff.setDate(0)
      const cutoffStr = cutoff.toISOString().slice(0, 10)
      const received = (receipts as any[]).filter(r => r.receipt_date <= cutoffStr).reduce((s, r) => s + (Number(r.amount) || 0), 0)
      const spent = (expenses as any[]).filter(e => e.expense_date <= cutoffStr).reduce((s, e) => s + (Number(e.amount) || 0), 0)
      return { label: monthLabel(ym), balance: received - spent }
    })
  }, [months, receipts, expenses])

  // Top categories by total spend (within the shown window); the rest fold into "Other".
  const { topCats, categoryTrend } = useMemo(() => {
    const totals = new Map<string, number>()
    for (const e of expenses as any[]) {
      if (!months.includes(monthKey(e.expense_date))) continue
      const k = catName(e.category_id)
      totals.set(k, (totals.get(k) ?? 0) + (Number(e.amount) || 0))
    }
    const ranked = Array.from(totals.entries()).sort((a, b) => b[1] - a[1])
    const top = ranked.slice(0, MAX_SERIES).map(([name]) => name)
    const hasOther = ranked.length > MAX_SERIES

    const byMonth = months.map(ym => {
      const row: Record<string, any> = { label: monthLabel(ym) }
      for (const cat of top) row[cat] = 0
      if (hasOther) row['Other'] = 0
      for (const e of expenses as any[]) {
        if (monthKey(e.expense_date) !== ym) continue
        const cat = catName(e.category_id)
        const key = top.includes(cat) ? cat : (hasOther ? 'Other' : cat)
        row[key] = (row[key] ?? 0) + (Number(e.amount) || 0)
      }
      return row
    })
    return { topCats: hasOther ? [...top, 'Other'] : top, categoryTrend: byMonth }
  }, [months, expenses, categories])

  const Kpi = ({ label, value, tone }: any) => (
    <Card className="p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={'mt-1 text-2xl font-semibold ' + (tone === 'negative' ? 'text-bad' : 'text-ink')}>{value}</p>
    </Card>
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Total Fund Received" value={`${formatNumber(totalReceived, 2)} BDT`} />
        <Kpi label="Total Expense" value={`${formatNumber(totalExpense, 2)} BDT`} />
        <Kpi label="Current Balance" value={`${formatNumber(balance, 2)} BDT`} tone={balance < 0 ? 'negative' : undefined} />
      </div>

      <Card>
        <CardHeader title="Running Balance" subtitle={`Fund received minus expense, end of each month · last ${MONTHS_SHOWN} months`} />
        <div className="h-64 p-4">
          {l1 || l2 ? <p className="grid h-full place-items-center text-sm text-ink-soft">Loading…</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={balanceTrend} margin={{ left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.16)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-ink-faint" />
                <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} className="text-ink-faint" />
                <Tooltip contentStyle={{ borderRadius: 10, border: 'none', fontSize: 12, boxShadow: '0 6px 20px rgba(0,0,0,0.14)' }} />
                <Line type="monotone" dataKey="balance" name="Balance" stroke="#f2a900" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Expense by Category" subtitle={`Monthly spend, top ${MAX_SERIES} categories · last ${MONTHS_SHOWN} months`} />
        <div className="h-72 p-4">
          {categoryTrend.every(r => topCats.every(c => !r[c])) ? (
            <p className="grid h-full place-items-center text-sm text-ink-soft">No expense recorded yet</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryTrend} margin={{ left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.16)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-ink-faint" />
                <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} className="text-ink-faint" />
                <Tooltip contentStyle={{ borderRadius: 10, border: 'none', fontSize: 12, boxShadow: '0 6px 20px rgba(0,0,0,0.14)' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {topCats.map((cat, i) => (
                  <Bar key={cat} dataKey={cat} stackId="exp" fill={CAT_COLORS[i % CAT_COLORS.length]} radius={i === topCats.length - 1 ? [4, 4, 0, 0] : undefined} maxBarSize={48} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </div>
  )
}

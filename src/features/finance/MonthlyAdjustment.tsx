import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { useCollection } from '@/hooks/useCollection'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatNumber, formatDate, formatDateTime } from '@/lib/utils'
import { downloadMonthlyAdjustmentPDF } from '@/pdf/FinancePDF'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid
} from 'recharts'

// Same fixed categorical order used on the main Dashboard (green/gold/orange/red/gray) —
// kept identical here so color meaning stays consistent across the app.
const CAT_COLORS = ['#16a34a', '#f2a900', '#ea7a0c', '#dc2626', '#8c8f94']
const MAX_SERIES = 5 // top categories get their own color; the rest fold into "Other"
const TREND_MONTHS = 6

// Local calendar parts only — never round-trip through toISOString() here,
// since that converts to UTC and shifts the date for any UTC+ timezone
// (e.g. Asia/Dhaka, UTC+6), silently dropping month-end transactions.
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const monthLabel = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
const monthShortLabel = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
const inMonth = (dateStr: string, ym: string) => (dateStr ?? '').slice(0, 7) === ym
const monthKey = (d: string) => (d ?? '').slice(0, 7)
// Last calendar day of YYYY-MM, computed purely with UTC arithmetic so no
// local timezone conversion can shift it — "day 0 of next month" in UTC.
const lastDayOfMonth = (year: number, month: number) => String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, '0')

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

export function MonthlyAdjustment() {
  const { data: receipts, loading: l1 } = useCollection('finance_fund_receipts', { order: 'receipt_date' })
  const { data: expenses, loading: l2 } = useCollection('finance_expenses', { order: 'expense_date' })
  const { data: categories } = useCollection('finance_expense_categories', { order: 'name', ascending: true })
  const { data: adjustments, refresh: refreshAdj } = useCollection('finance_monthly_adjustments', { order: 'year' })
  const { currentClientId, can } = useAuth()
  const notify = useUI(s => s.notify)
  const canEdit = can('finance.create') || can('finance.edit')
  const [period, setPeriod] = useState(thisMonth())
  const [submitting, setSubmitting] = useState(false)

  const catName = (id: string) => (categories as any[]).find(c => c.id === id)?.name ?? 'Uncategorized'
  const [year, month] = period.split('-').map(Number)

  const monthReceipts = useMemo(() => (receipts as any[]).filter(r => inMonth(r.receipt_date, period)), [receipts, period])
  const monthExpenses = useMemo(() => (expenses as any[]).filter(e => inMonth(e.expense_date, period)), [expenses, period])
  const totalReceivedMonth = monthReceipts.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const totalExpenseMonth = monthExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)

  // Ledger-style carry-forward: this month's opening balance (B/D, "brought
  // down") is everything up to the end of the previous month; the closing
  // balance (C/D, "carried down") becomes next month's B/D automatically,
  // since it's the same all-time cumulative figure one month later.
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const prevMonthEndDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${lastDayOfMonth(prevYear, prevMonth)}`
  const openingBalance = (receipts as any[]).filter(r => r.receipt_date <= prevMonthEndDate).reduce((s, r) => s + (Number(r.amount) || 0), 0)
    - (expenses as any[]).filter(e => e.expense_date <= prevMonthEndDate).reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const closingBalance = openingBalance + totalReceivedMonth - totalExpenseMonth

  const categoryTotals = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of monthExpenses) { const k = catName(e.category_id); m.set(k, (m.get(k) ?? 0) + (Number(e.amount) || 0)) }
    return Array.from(m.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount)
  }, [monthExpenses, categories])

  const existing = (adjustments as any[]).find(a => a.year === year && a.month === month)

  const trendMonths = useMemo(() => lastNMonths(TREND_MONTHS), [])

  // Cumulative balance at the end of each of the last N months (all-time
  // fund received minus all-time expense, up to that month's last day).
  const balanceTrend = useMemo(() => {
    return trendMonths.map(ym => {
      const [y, m] = ym.split('-').map(Number)
      const cutoff = `${y}-${String(m).padStart(2, '0')}-${lastDayOfMonth(y, m)}`
      const received = (receipts as any[]).filter(r => r.receipt_date <= cutoff).reduce((s, r) => s + (Number(r.amount) || 0), 0)
      const spent = (expenses as any[]).filter(e => e.expense_date <= cutoff).reduce((s, e) => s + (Number(e.amount) || 0), 0)
      return { label: monthShortLabel(ym), balance: received - spent }
    })
  }, [trendMonths, receipts, expenses])

  // Top categories by spend within the trend window; the rest fold into "Other".
  const { topCats, categoryTrend } = useMemo(() => {
    const totals = new Map<string, number>()
    for (const e of expenses as any[]) {
      if (!trendMonths.includes(monthKey(e.expense_date))) continue
      const k = catName(e.category_id)
      totals.set(k, (totals.get(k) ?? 0) + (Number(e.amount) || 0))
    }
    const ranked = Array.from(totals.entries()).sort((a, b) => b[1] - a[1])
    const top = ranked.slice(0, MAX_SERIES).map(([name]) => name)
    const hasOther = ranked.length > MAX_SERIES

    const byMonth = trendMonths.map(ym => {
      const row: Record<string, any> = { label: monthShortLabel(ym) }
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
  }, [trendMonths, expenses, categories])

  const exportPDF = async () => {
    try {
      await downloadMonthlyAdjustmentPDF({
        period: monthLabel(period),
        receipts: monthReceipts.map(r => ({ date: formatDate(r.receipt_date), amount: Number(r.amount) || 0 })),
        expenses: monthExpenses.map(e => ({ date: formatDate(e.expense_date), category: catName(e.category_id), payee: e.payee_name, description: e.description, amount: Number(e.amount) || 0 })),
        categoryTotals,
        openingBalance, totalReceived: totalReceivedMonth, totalExpense: totalExpenseMonth, closingBalance
      })
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not generate PDF — check the company logo URL in Settings')
    }
  }

  const markSubmitted = async () => {
    setSubmitting(true)
    const payload = {
      client_id: currentClientId!, year, month,
      total_fund_received: totalReceivedMonth, total_expense: totalExpenseMonth, closing_balance: closingBalance,
      submitted_at: new Date().toISOString()
    }
    const { error } = existing
      ? await supabase.from('finance_monthly_adjustments').update(payload).eq('id', existing.id)
      : await supabase.from('finance_monthly_adjustments').insert(payload)
    setSubmitting(false)
    if (error) { notify('error', error.message); return }
    notify('success', `${monthLabel(period)} marked as submitted`)
    refreshAdj()
  }

  const Stat = ({ label, value, tone }: any) => (
    <Card className="p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={'mt-1 text-xl font-semibold ' + (tone === 'negative' ? 'text-bad' : 'text-ink')}>{value}</p>
    </Card>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input type="month" className="fiori-input w-48" value={period} onChange={e => setPeriod(e.target.value)} />
        {existing?.submitted_at && <Badge tone="positive">Submitted {formatDateTime(existing.submitted_at)}</Badge>}
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" icon="picture_as_pdf" onClick={exportPDF}>Export PDF</Button>
          {canEdit && <Button icon="task_alt" loading={submitting} onClick={markSubmitted}>{existing?.submitted_at ? 'Re-submit' : 'Mark Submitted'}</Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Balance B/D" value={`${formatNumber(openingBalance, 2)} BDT`} tone={openingBalance < 0 ? 'negative' : undefined} />
        <Stat label="Fund Received (Month)" value={`${formatNumber(totalReceivedMonth, 2)} BDT`} />
        <Stat label="Expense (Month)" value={`${formatNumber(totalExpenseMonth, 2)} BDT`} />
        <Stat label="Balance C/D" value={`${formatNumber(closingBalance, 2)} BDT`} tone={closingBalance < 0 ? 'negative' : undefined} />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="flex min-h-0 flex-col overflow-hidden p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Fund Received — {monthLabel(period)}</p>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-surface-line">
            {l1 ? <p className="p-3 text-sm text-ink-faint">Loading…</p> : monthReceipts.length === 0 ? <p className="p-3 text-sm text-ink-faint">No fund received this month</p> :
              monthReceipts.map((r, i) => (
                <div key={r.id} className={'flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                  <span className="text-ink">{formatDate(r.receipt_date)}</span>
                  <span className="font-semibold text-ink">{formatNumber(r.amount, 2)}</span>
                </div>
              ))}
          </div>
        </Card>

        <Card className="flex min-h-0 flex-col overflow-hidden p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Category Summary — {monthLabel(period)}</p>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-surface-line">
            {categoryTotals.length === 0 ? <p className="p-3 text-sm text-ink-faint">No expense this month</p> :
              categoryTotals.map((c, i) => (
                <div key={c.category} className={'flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                  <span className="text-ink">{c.category}</span>
                  <span className="font-semibold text-ink">{formatNumber(c.amount, 2)}</span>
                </div>
              ))}
          </div>
        </Card>
      </div>

      <Card className="flex min-h-0 flex-col overflow-hidden p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Expense Details — {monthLabel(period)}</p>
        <div className="max-h-72 overflow-y-auto rounded-xl border border-surface-line">
          {l2 ? <p className="p-3 text-sm text-ink-faint">Loading…</p> : monthExpenses.length === 0 ? <p className="p-3 text-sm text-ink-faint">No expenses this month</p> :
            monthExpenses.map((e, i) => (
              <div key={e.id} className={'flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                <div className="min-w-0">
                  <span className="text-ink">{formatDate(e.expense_date)} · {catName(e.category_id)}</span>
                  <p className="truncate text-xs text-ink-faint">{e.payee_name || '—'}{e.description ? ` — ${e.description}` : ''}</p>
                </div>
                <span className="shrink-0 font-semibold text-ink">{formatNumber(e.amount, 2)}</span>
              </div>
            ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Running Balance" subtitle={`Fund received minus expense, end of each month · last ${TREND_MONTHS} months`} />
          <div className="h-56 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={balanceTrend} margin={{ left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.16)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-ink-faint" />
                <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} className="text-ink-faint" />
                <Tooltip contentStyle={{ borderRadius: 10, border: 'none', fontSize: 12, boxShadow: '0 6px 20px rgba(0,0,0,0.14)' }} />
                <Line type="monotone" dataKey="balance" name="Balance" stroke="#f2a900" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Expense by Category" subtitle={`Monthly spend, top ${MAX_SERIES} categories · last ${TREND_MONTHS} months`} />
          <div className="h-56 p-4">
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
    </div>
  )
}

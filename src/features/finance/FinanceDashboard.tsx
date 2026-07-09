import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useCollection } from '@/hooks/useCollection'
import { Card, CardHeader } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { formatNumber, formatDate } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid
} from 'recharts'
import { StatCard } from './components/FinanceUI'
import { cashOut, totalDue } from './financeCash'

// Finance module home — the "accounts at a glance". All figures stay inside
// the finance module (finance.view), never on the shared dashboard.
const thisMonth = () => new Date().toISOString().slice(0, 7)
const monthOf = (d: string) => (d ?? '').slice(0, 7)
const sum = (rows: any[], f: (r: any) => number) => rows.reduce((s, r) => s + f(r), 0)
const DEPT_COLORS = ['#16a34a', '#f2a900', '#ea7a0c', '#dc2626', '#8c8f94', '#64748b']
const TREND_MONTHS = 6
const lastNMonths = (n: number) => {
  const out: string[] = []
  const d = new Date(); d.setDate(1)
  for (let i = n - 1; i >= 0; i--) {
    const mo = new Date(d.getFullYear(), d.getMonth() - i, 1)
    out.push(`${mo.getFullYear()}-${String(mo.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}
const monthShortLabel = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })

export function FinanceDashboard() {
  const { data: receipts } = useCollection('finance_fund_receipts', { order: 'receipt_date' })
  const { data: expenses } = useCollection('finance_expenses', { order: 'expense_date' })
  const { data: adjustments } = useCollection('finance_balance_adjustments', { order: 'adjustment_date' })
  const { data: payments } = useCollection('finance_vendor_payments', { order: 'payment_date' })
  const { data: budgets } = useCollection('finance_budgets', {})
  const { data: submissions } = useCollection('finance_ho_submissions', {})
  // expense_type is required + explicitly chosen at entry time (unlike the
  // old category_id, which was only ever inherited from an item master and
  // silently ended up null) — it's the fix for the "Uncategorized" bug too.
  const catName = (e: any) => e.expense_type || 'Uncategorized'

  const m = thisMonth()
  const k = useMemo(() => {
    const amt = (r: any) => Number(r.amount) || 0
    const allRecv = sum(receipts as any[], amt)
    const allAdj = sum(adjustments as any[], amt)
    // Cash-in-hand: credit purchases don't count until paid; vendor payments do.
    const cashSpent = sum(expenses as any[], cashOut) + sum(payments as any[], amt)
    const pendingCollection = (expenses as any[]).filter(e => e.voucher_status === 'pending_collection').length
    const readyForSubmission = (expenses as any[]).filter(e => e.voucher_status === 'collected' && !e.submission_id).length
    const submittedThisMonthIds = new Set((submissions as any[]).filter(s => monthOf(s.submission_date) === m).map(s => s.id))
    const submittedThisMonth = (expenses as any[]).filter(e => e.submission_id && submittedThisMonthIds.has(e.submission_id)).length
    return {
      balance: allRecv - cashSpent + allAdj,
      monthSpent: sum((expenses as any[]).filter(e => monthOf(e.expense_date) === m), amt),
      dues: totalDue(expenses as any[], payments as any[]),
      pendingCollection, readyForSubmission, submittedThisMonth
    }
  }, [receipts, expenses, adjustments, payments, submissions])

  // Budget vs spend for the current month (per department + overall).
  const [yy, mm] = m.split('-').map(Number)
  const budgetRows = useMemo(() => {
    const monthBudgets = (budgets as any[]).filter(b => b.year === yy && b.month === mm)
    if (!monthBudgets.length) return []
    const spentByDept = new Map<string, number>()
    ;(expenses as any[]).filter(e => monthOf(e.expense_date) === m).forEach(e => {
      const d = e.department || 'Others'; spentByDept.set(d, (spentByDept.get(d) ?? 0) + (Number(e.amount) || 0))
    })
    const totalSpent = [...spentByDept.values()].reduce((s, v) => s + v, 0)
    return monthBudgets.map(b => {
      const spent = b.department === 'All' ? totalSpent : (spentByDept.get(b.department) ?? 0)
      return { department: b.department, budget: Number(b.amount) || 0, spent, remaining: (Number(b.amount) || 0) - spent }
    }).sort((a, b) => (a.department === 'All' ? -1 : b.department === 'All' ? 1 : a.department.localeCompare(b.department)))
  }, [budgets, expenses, yy, mm])
  const overallBudget = budgetRows.find(b => b.department === 'All')

  const monthByHead = useMemo(() => {
    const map = new Map<string, number>()
    ;(expenses as any[]).filter(e => monthOf(e.expense_date) === m).forEach(e => {
      const key = catName(e); map.set(key, (map.get(key) ?? 0) + (Number(e.amount) || 0))
    })
    return [...map.entries()].map(([head, amount]) => ({ head, amount })).sort((a, b) => b.amount - a.amount)
  }, [expenses])

  const recent = useMemo(() => (expenses as any[]).slice(0, 8), [expenses])

  // Department-wise Expense Trend — same "stack the last N months" pattern as
  // the Cash Book's category trend chart, grouped by department instead.
  const trendMonths = useMemo(() => lastNMonths(TREND_MONTHS), [])
  const { depts, deptTrend } = useMemo(() => {
    const totals = new Map<string, number>()
    for (const e of expenses as any[]) {
      if (!trendMonths.includes(monthOf(e.expense_date))) continue
      const d = e.department || 'Others'
      totals.set(d, (totals.get(d) ?? 0) + (Number(e.amount) || 0))
    }
    const ranked = [...totals.keys()].sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0)).slice(0, 6)
    const byMonth = trendMonths.map(ym => {
      const row: Record<string, any> = { label: monthShortLabel(ym) }
      for (const d of ranked) row[d] = 0
      for (const e of expenses as any[]) {
        if (monthOf(e.expense_date) !== ym) continue
        const d = e.department || 'Others'
        if (ranked.includes(d)) row[d] = (row[d] ?? 0) + (Number(e.amount) || 0)
      }
      return row
    })
    return { depts: ranked, deptTrend: byMonth }
  }, [expenses, trendMonths])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="account_balance_wallet" tone={k.balance < 0 ? 'bad' : 'brand'} label="Fund Balance (in hand)" value={`${formatNumber(k.balance, 2)} BDT`} />
        <StatCard icon="shopping_cart" tone="bad" label="Spent this month" value={`${formatNumber(k.monthSpent, 2)} BDT`} />
        <StatCard icon="request_quote" tone={k.dues > 0.004 ? 'warn' : 'brand'} label="Vendor Dues (unpaid)" value={`${formatNumber(k.dues, 2)} BDT`} />
        <StatCard icon="savings" tone={overallBudget && overallBudget.remaining < 0 ? 'bad' : 'brand'} label="Budget Left (month)" value={overallBudget ? `${formatNumber(overallBudget.remaining, 2)} BDT` : '—'} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="pending_actions" tone={k.pendingCollection > 0 ? 'warn' : 'brand'} label="Pending Voucher Collection" value={formatNumber(k.pendingCollection)} />
        <StatCard icon="fact_check" tone="brand" label="Ready for HO Submission" value={formatNumber(k.readyForSubmission)} />
        <StatCard icon="task_alt" tone="ok" label="Submitted this month" value={formatNumber(k.submittedThisMonth)} />
      </div>

      {budgetRows.length > 0 && (
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Budget — this month</p>
            <Link to="/finance/setup" className="text-xs font-medium text-brand-700 hover:underline">Set budgets →</Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-surface-line">
            <div className="grid grid-cols-[1fr_110px_110px_120px] gap-2 border-b border-surface-line bg-surface-sunken px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              <span>Department</span><span className="text-right">Budget</span><span className="text-right">Spent</span><span className="text-right">Remaining</span>
            </div>
            {budgetRows.map((b, i) => (
              <div key={b.department} className={'grid grid-cols-[1fr_110px_110px_120px] gap-2 px-3 py-2.5 text-sm tabular-nums ' + (i ? 'border-t border-surface-line' : '')}>
                <span className="text-ink">{b.department === 'All' ? 'All departments' : b.department}</span>
                <span className="text-right text-ink-soft">{formatNumber(b.budget, 2)}</span>
                <span className="text-right text-ink-soft">{formatNumber(b.spent, 2)}</span>
                <span className={'text-right font-semibold ' + (b.remaining < 0 ? 'text-bad' : 'text-ok')}>{formatNumber(b.remaining, 2)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">This month by head</p>
            <Link to="/finance/voucher" className="text-xs font-medium text-brand-700 hover:underline">Expenses →</Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-surface-line">
            {monthByHead.length === 0 ? <p className="p-3 text-sm text-ink-faint">No spend this month</p> :
              monthByHead.map((c, i) => (
                <div key={c.head} className={'flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                  <span className="text-ink">{c.head}</span>
                  <span className="font-semibold text-ink">{formatNumber(c.amount, 2)}</span>
                </div>
              ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Recent expenses</p>
            <Link to="/finance/voucher" className="text-xs font-medium text-brand-700 hover:underline">All →</Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-surface-line">
            {recent.length === 0 ? <p className="p-3 text-sm text-ink-faint">No expenses yet</p> :
              recent.map((e: any, i: number) => (
                <div key={e.id} className={'flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                  <span className="min-w-0 truncate text-ink">{formatDate(e.expense_date)} · {catName(e)}{e.payee_name ? <span className="text-ink-faint"> · {e.payee_name}</span> : null}</span>
                  <span className="shrink-0 font-semibold text-ink">{formatNumber(e.amount, 2)}</span>
                </div>
              ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Department-wise Expense Trend" subtitle={`Monthly spend, top ${depts.length} departments · last ${TREND_MONTHS} months`} />
        <div className="h-56 p-4">
          {deptTrend.every(r => depts.every(d => !r[d])) ? (
            <p className="grid h-full place-items-center text-sm text-ink-soft">No expense recorded yet</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptTrend} margin={{ left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.16)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-ink-faint" />
                <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} className="text-ink-faint" />
                <Tooltip contentStyle={{ borderRadius: 10, border: 'none', fontSize: 12, boxShadow: '0 6px 20px rgba(0,0,0,0.14)' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {depts.map((d, i) => (
                  <Bar key={d} dataKey={d} stackId="dept" fill={DEPT_COLORS[i % DEPT_COLORS.length]} radius={i === depts.length - 1 ? [4, 4, 0, 0] : undefined} maxBarSize={48} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link to="/finance/requisition" className="inline-flex items-center gap-2 rounded-lg border border-surface-line bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:bg-surface-sunken"><Icon name="assignment" className="text-[18px] text-ink-soft" /> New Requisition</Link>
        <Link to="/finance/voucher" className="inline-flex items-center gap-2 rounded-lg border border-surface-line bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:bg-surface-sunken"><Icon name="receipt_long" className="text-[18px] text-ink-soft" /> New Expense</Link>
        <Link to="/finance/cash-book" className="inline-flex items-center gap-2 rounded-lg border border-surface-line bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:bg-surface-sunken"><Icon name="menu_book" className="text-[18px] text-ink-soft" /> Cash Book</Link>
      </div>
    </div>
  )
}

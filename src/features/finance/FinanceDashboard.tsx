import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useCollection } from '@/hooks/useCollection'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { formatNumber, formatDate } from '@/lib/utils'
import { StatCard } from './components/FinanceUI'
import { cashOut, totalDue } from './financeCash'

// Finance module home — the "accounts at a glance". All figures stay inside
// the finance module (finance.view), never on the shared dashboard.
const thisMonth = () => new Date().toISOString().slice(0, 7)
const monthOf = (d: string) => (d ?? '').slice(0, 7)
const sum = (rows: any[], f: (r: any) => number) => rows.reduce((s, r) => s + f(r), 0)

export function FinanceDashboard() {
  const { data: receipts } = useCollection('finance_fund_receipts', { order: 'receipt_date' })
  const { data: expenses } = useCollection('finance_expenses', { order: 'expense_date' })
  const { data: adjustments } = useCollection('finance_balance_adjustments', { order: 'adjustment_date' })
  const { data: payments } = useCollection('finance_vendor_payments', { order: 'payment_date' })
  const { data: budgets } = useCollection('finance_budgets', {})
  const { data: cats } = useCollection('finance_expense_categories', {})
  const catName = (id: string) => (cats as any[]).find(c => c.id === id)?.name ?? 'Uncategorized'

  const m = thisMonth()
  const k = useMemo(() => {
    const amt = (r: any) => Number(r.amount) || 0
    const allRecv = sum(receipts as any[], amt)
    const allAdj = sum(adjustments as any[], amt)
    // Cash-in-hand: credit purchases don't count until paid; vendor payments do.
    const cashSpent = sum(expenses as any[], cashOut) + sum(payments as any[], amt)
    return {
      balance: allRecv - cashSpent + allAdj,
      monthSpent: sum((expenses as any[]).filter(e => monthOf(e.expense_date) === m), amt),
      dues: totalDue(expenses as any[], payments as any[])
    }
  }, [receipts, expenses, adjustments, payments])

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
      const key = catName(e.category_id); map.set(key, (map.get(key) ?? 0) + (Number(e.amount) || 0))
    })
    return [...map.entries()].map(([head, amount]) => ({ head, amount })).sort((a, b) => b.amount - a.amount)
  }, [expenses, cats])

  const recent = useMemo(() => (expenses as any[]).slice(0, 8), [expenses])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="account_balance_wallet" tone={k.balance < 0 ? 'bad' : 'brand'} label="Fund Balance (in hand)" value={`${formatNumber(k.balance, 2)} BDT`} />
        <StatCard icon="shopping_cart" tone="bad" label="Spent this month" value={`${formatNumber(k.monthSpent, 2)} BDT`} />
        <StatCard icon="request_quote" tone={k.dues > 0.004 ? 'warn' : 'brand'} label="Vendor Dues (unpaid)" value={`${formatNumber(k.dues, 2)} BDT`} />
        <StatCard icon="savings" tone={overallBudget && overallBudget.remaining < 0 ? 'bad' : 'brand'} label="Budget Left (month)" value={overallBudget ? `${formatNumber(overallBudget.remaining, 2)} BDT` : '—'} />
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
            <Link to="/finance/register" className="text-xs font-medium text-brand-700 hover:underline">Registers →</Link>
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
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Recent procurement</p>
            <Link to="/finance/voucher" className="text-xs font-medium text-brand-700 hover:underline">All →</Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-surface-line">
            {recent.length === 0 ? <p className="p-3 text-sm text-ink-faint">No procurement yet</p> :
              recent.map((e: any, i: number) => (
                <div key={e.id} className={'flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                  <span className="min-w-0 truncate text-ink">{formatDate(e.expense_date)} · {catName(e.category_id)}{e.payee_name ? <span className="text-ink-faint"> · {e.payee_name}</span> : null}</span>
                  <span className="shrink-0 font-semibold text-ink">{formatNumber(e.amount, 2)}</span>
                </div>
              ))}
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link to="/finance/requisition" className="inline-flex items-center gap-2 rounded-lg border border-surface-line bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:bg-surface-sunken"><Icon name="assignment" className="text-[18px] text-ink-soft" /> New Requisition</Link>
        <Link to="/finance/voucher" className="inline-flex items-center gap-2 rounded-lg border border-surface-line bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:bg-surface-sunken"><Icon name="receipt_long" className="text-[18px] text-ink-soft" /> New Procurement</Link>
        <Link to="/finance/cash-book" className="inline-flex items-center gap-2 rounded-lg border border-surface-line bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:bg-surface-sunken"><Icon name="menu_book" className="text-[18px] text-ink-soft" /> Cash Book</Link>
      </div>
    </div>
  )
}

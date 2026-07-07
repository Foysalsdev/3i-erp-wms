import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { useCollection } from '@/hooks/useCollection'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatNumber, formatDate, formatDateTime } from '@/lib/utils'
import { downloadMonthlyAdjustmentPDF } from '@/pdf/FinancePDF'

// Local calendar parts only — never round-trip through toISOString() here,
// since that converts to UTC and shifts the date for any UTC+ timezone
// (e.g. Asia/Dhaka, UTC+6), silently dropping month-end transactions.
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const monthLabel = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
const inMonth = (dateStr: string, ym: string) => (dateStr ?? '').slice(0, 7) === ym
// Last calendar day of YYYY-MM, computed purely with UTC arithmetic so no
// local timezone conversion can shift it — "day 0 of next month" in UTC.
const lastDayOfMonth = (year: number, month: number) => String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, '0')

export function MonthlyAdjustment() {
  const { data: receipts, loading: l1 } = useCollection('finance_fund_receipts', { order: 'receipt_date' })
  const { data: expenses, loading: l2 } = useCollection('finance_expenses', { order: 'expense_date' })
  const { data: categories } = useCollection('finance_expense_categories', { order: 'name', ascending: true })
  const { data: adjustments, refresh: refreshAdj } = useCollection('finance_monthly_adjustments', { order: 'year' })
  const { currentClientId, can, clients } = useAuth()
  const clientName = clients.find((c: any) => c.id === currentClientId)?.name ?? ''
  const notify = useUI(s => s.notify)
  const canEdit = can('finance.create') || can('finance.edit')
  const [period, setPeriod] = useState(thisMonth())
  const [submitting, setSubmitting] = useState(false)

  const catName = (id: string) => (categories as any[]).find(c => c.id === id)?.name ?? 'Uncategorized'
  const [year, month] = period.split('-').map(Number)
  const monthEndDate = `${year}-${String(month).padStart(2, '0')}-${lastDayOfMonth(year, month)}`

  const monthReceipts = useMemo(() => (receipts as any[]).filter(r => inMonth(r.receipt_date, period)), [receipts, period])
  const monthExpenses = useMemo(() => (expenses as any[]).filter(e => inMonth(e.expense_date, period)), [expenses, period])
  const totalReceivedMonth = monthReceipts.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const totalExpenseMonth = monthExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)

  const allTimeReceived = (receipts as any[]).filter(r => r.receipt_date <= monthEndDate).reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const allTimeExpense = (expenses as any[]).filter(e => e.expense_date <= monthEndDate).reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const closingBalance = allTimeReceived - allTimeExpense

  const categoryTotals = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of monthExpenses) { const k = catName(e.category_id); m.set(k, (m.get(k) ?? 0) + (Number(e.amount) || 0)) }
    return Array.from(m.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount)
  }, [monthExpenses, categories])

  const existing = (adjustments as any[]).find(a => a.year === year && a.month === month)

  const exportPDF = async () => {
    try {
      await downloadMonthlyAdjustmentPDF({
        client: clientName, period: monthLabel(period),
        receipts: monthReceipts.map(r => ({ date: formatDate(r.receipt_date), amount: Number(r.amount) || 0 })),
        expenses: monthExpenses.map(e => ({ date: formatDate(e.expense_date), category: catName(e.category_id), payee: e.payee_name, description: e.description, amount: Number(e.amount) || 0 })),
        categoryTotals,
        totalReceived: totalReceivedMonth, totalExpense: totalExpenseMonth, closingBalance
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Fund Received (Month)" value={`${formatNumber(totalReceivedMonth, 2)} BDT`} />
        <Stat label="Expense (Month)" value={`${formatNumber(totalExpenseMonth, 2)} BDT`} />
        <Stat label="Closing Balance" value={`${formatNumber(closingBalance, 2)} BDT`} tone={closingBalance < 0 ? 'negative' : undefined} />
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
    </div>
  )
}

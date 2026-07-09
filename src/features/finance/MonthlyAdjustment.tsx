import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { useCollection } from '@/hooks/useCollection'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { formatNumber, formatDate, formatDateTime } from '@/lib/utils'
import { downloadMonthlyAdjustmentPDF, SUBMITTED_TO } from '@/pdf/FinancePDF'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid
} from 'recharts'
import { SectionHeader, StatCard } from './components/FinanceUI'
import { cashOut, isCredit } from './financeCash'

// Same fixed categorical order used on the main Dashboard (green/gold/orange/red/gray) —
// kept identical here so color meaning stays consistent across the app.
const CAT_COLORS = ['#16a34a', '#f2a900', '#ea7a0c', '#dc2626', '#8c8f94']
const OTHER_COLOR = '#64748b' // distinct from all 5 above — "Other" must never repeat a top category's color
const MAX_SERIES = 5 // top categories get their own color; the rest fold into "Other"
const TREND_MONTHS = 6

// Local calendar parts only — never round-trip through toISOString() here,
// since that converts to UTC and shifts the date for any UTC+ timezone
// (e.g. Asia/Dhaka, UTC+6), silently dropping month-end transactions.
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const today = () => new Date().toISOString().slice(0, 10)
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
  const { data: adjustments, refresh: refreshAdj } = useCollection('finance_monthly_adjustments', { order: 'year' })
  const { data: balanceAdjustments, refresh: refreshBalanceAdj } = useCollection('finance_balance_adjustments', { order: 'adjustment_date' })
  const { data: payments } = useCollection('finance_vendor_payments', { order: 'payment_date' })
  const { data: vendors } = useCollection('finance_vendors', {})
  const { currentClientId, can } = useAuth()
  const notify = useUI(s => s.notify)
  // Marking a month submitted is an insert the first time (needs
  // finance.create) and an update on every re-submit after that (needs
  // finance.edit) — matched below against whether a snapshot already exists.
  const canCreate = can('finance.create')
  const canEdit = can('finance.edit')
  // A ?period=YYYY-MM deep-link (from the My Tasks "Month to submit" matter)
  // lands straight on that month.
  const [params] = useSearchParams()
  const [period, setPeriod] = useState(/^\d{4}-\d{2}$/.test(params.get('period') || '') ? params.get('period')! : thisMonth())
  const [submitting, setSubmitting] = useState(false)
  const [addingAdjustment, setAddingAdjustment] = useState(false)

  const catName = (e: any) => e.expense_type || 'Uncategorized'
  const [year, month] = period.split('-').map(Number)

  const monthReceipts = useMemo(() => (receipts as any[]).filter(r => inMonth(r.receipt_date, period)), [receipts, period])
  const monthExpenses = useMemo(() => (expenses as any[]).filter(e => inMonth(e.expense_date, period)), [expenses, period])
  const monthPayments = useMemo(() => (payments as any[]).filter(p => inMonth(p.payment_date, period)), [payments, period])
  const monthBalanceAdjustments = useMemo(() => (balanceAdjustments as any[]).filter(a => inMonth(a.adjustment_date, period)), [balanceAdjustments, period])
  const vendorName = (id?: string) => (vendors as any[]).find(v => v.id === id)?.name || 'vendor'
  const totalReceivedMonth = monthReceipts.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  // Accrual spend (all purchases) — feeds the category analysis + the submitted snapshot.
  const totalExpenseMonth = monthExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  // Cash actually paid out this month = non-credit purchases + vendor payments.
  const monthCashPaid = monthExpenses.reduce((s, e) => s + cashOut(e), 0) + monthPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const totalAdjustmentMonth = monthBalanceAdjustments.reduce((s, a) => s + (Number(a.amount) || 0), 0)

  // Ledger-style carry-forward: this month's opening balance (B/D, "brought
  // down") is everything up to the end of the previous month; the closing
  // balance (C/D, "carried down") becomes next month's B/D automatically,
  // since it's the same all-time cumulative figure one month later. Manual
  // balance adjustments (seeding a starting balance carried from before this
  // system was used, or a one-off correction) fold into the same running
  // total alongside real receipts/expenses.
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const prevMonthEndDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${lastDayOfMonth(prevYear, prevMonth)}`
  const openingBalance = (receipts as any[]).filter(r => r.receipt_date <= prevMonthEndDate).reduce((s, r) => s + (Number(r.amount) || 0), 0)
    - (expenses as any[]).filter(e => e.expense_date <= prevMonthEndDate).reduce((s, e) => s + cashOut(e), 0)
    - (payments as any[]).filter(p => p.payment_date <= prevMonthEndDate).reduce((s, p) => s + (Number(p.amount) || 0), 0)
    + (balanceAdjustments as any[]).filter(a => a.adjustment_date <= prevMonthEndDate).reduce((s, a) => s + (Number(a.amount) || 0), 0)
  const closingBalance = openingBalance + totalReceivedMonth - monthCashPaid + totalAdjustmentMonth

  const categoryTotals = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of monthExpenses) { const k = catName(e); m.set(k, (m.get(k) ?? 0) + (Number(e.amount) || 0)) }
    return Array.from(m.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount)
  }, [monthExpenses])

  const existing = (adjustments as any[]).find(a => a.year === year && a.month === month)
  // Submitting only snapshots the figures at that moment — it doesn't lock
  // the underlying receipts/expenses, so a later edit can silently diverge
  // from what was already sent to Head Office. Surface that instead of
  // hiding it behind an always-live recompute.
  const submittedDrift = !!existing?.submitted_at && (
    Math.abs(Number(existing.total_fund_received) - totalReceivedMonth) > 0.01 ||
    Math.abs(Number(existing.total_expense) - totalExpenseMonth) > 0.01 ||
    Math.abs(Number(existing.closing_balance) - closingBalance) > 0.01
  )

  const trendMonths = useMemo(() => lastNMonths(TREND_MONTHS), [])

  // Cumulative balance at the end of each of the last N months (all-time
  // fund received minus all-time expense, up to that month's last day).
  const balanceTrend = useMemo(() => {
    return trendMonths.map(ym => {
      const [y, m] = ym.split('-').map(Number)
      const cutoff = `${y}-${String(m).padStart(2, '0')}-${lastDayOfMonth(y, m)}`
      const received = (receipts as any[]).filter(r => r.receipt_date <= cutoff).reduce((s, r) => s + (Number(r.amount) || 0), 0)
      const spent = (expenses as any[]).filter(e => e.expense_date <= cutoff).reduce((s, e) => s + cashOut(e), 0)
        + (payments as any[]).filter(p => p.payment_date <= cutoff).reduce((s, p) => s + (Number(p.amount) || 0), 0)
      const adjusted = (balanceAdjustments as any[]).filter(a => a.adjustment_date <= cutoff).reduce((s, a) => s + (Number(a.amount) || 0), 0)
      return { label: monthShortLabel(ym), balance: received - spent + adjusted }
    })
  }, [trendMonths, receipts, expenses, payments, balanceAdjustments])

  // Top categories by spend within the trend window; the rest fold into "Other".
  const { topCats, categoryTrend } = useMemo(() => {
    const totals = new Map<string, number>()
    for (const e of expenses as any[]) {
      if (!trendMonths.includes(monthKey(e.expense_date))) continue
      const k = catName(e)
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
        const cat = catName(e)
        const key = top.includes(cat) ? cat : (hasOther ? 'Other' : cat)
        row[key] = (row[key] ?? 0) + (Number(e.amount) || 0)
      }
      return row
    })
    return { topCats: hasOther ? [...top, 'Other'] : top, categoryTrend: byMonth }
  }, [trendMonths, expenses])

  const exportPDF = async () => {
    try {
      // Fold receipts, manual balance adjustments and expenses into one
      // date-ordered cash book, carrying a running balance from the opening
      // B/D — a signed adjustment lands in Receipt (Dr) if positive, Payment
      // (Cr) if negative, so the running balance stays exact either way.
      type Posting = { raw: string; particulars: string; ref?: string; delta: number }
      const postings: Posting[] = [
        ...monthReceipts.map(r => ({ raw: r.receipt_date as string, particulars: `Fund received from ${SUBMITTED_TO}`, delta: Number(r.amount) || 0 })),
        ...monthBalanceAdjustments.map((a: any) => ({ raw: a.adjustment_date as string, particulars: `Balance adjustment${a.remarks ? ` — ${a.remarks}` : ''}`, delta: Number(a.amount) || 0 })),
        // Credit purchases don't move cash — they land in Dues, not the cash book.
        ...monthExpenses.filter(e => !isCredit(e)).map(e => ({
          raw: e.expense_date as string,
          particulars: catName(e) + (e.payee_name ? ` — ${e.payee_name}` : '') + (e.description ? ` (${e.description})` : ''),
          ref: e.doc_no || e.bill_ref || undefined,
          delta: -(Number(e.amount) || 0)
        })),
        ...monthPayments.map((p: any) => ({
          raw: p.payment_date as string,
          particulars: `Paid to ${vendorName(p.vendor_id)}${p.remarks ? ` — ${p.remarks}` : ''}`,
          delta: -(Number(p.amount) || 0)
        }))
      ].sort((a, b) => a.raw < b.raw ? -1 : a.raw > b.raw ? 1 : 0)

      let running = openingBalance
      const ledger = postings.map(p => {
        running += p.delta
        return {
          date: formatDate(p.raw), particulars: p.particulars, ref: p.ref,
          receipt: p.delta > 0 ? p.delta : undefined,
          payment: p.delta < 0 ? -p.delta : undefined,
          balance: running
        }
      })

      await downloadMonthlyAdjustmentPDF({
        period: monthLabel(period),
        openingBalance, closingBalance, ledger, categoryTotals
      })
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not generate PDF — check the company logo URL in Settings')
    }
  }

  const markSubmitted = async () => {
    // This declares the month's figures final and sent to Head Office — too
    // consequential to fire on a stray click, especially Re-submit which
    // silently overwrites the already-submitted figures.
    const question = existing?.submitted_at
      ? `Re-submit ${monthLabel(period)}? This overwrites the figures already sent to Head Office (submitted ${formatDateTime(existing.submitted_at)}).`
      : `Mark ${monthLabel(period)} as submitted to Head Office? Balance C/D: ${formatNumber(closingBalance, 2)} BDT.`
    if (!window.confirm(question)) return
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

  // Reopen a submitted month: clears submitted_at, which lifts the DB period
  // lock so its receipts/expenses/adjustments can be edited again.
  const reopen = async () => {
    if (!existing) return
    if (!window.confirm(`Reopen ${monthLabel(period)}? Its transactions become editable again and you'll need to re-submit afterwards.`)) return
    setSubmitting(true)
    const { error } = await supabase.from('finance_monthly_adjustments').update({ submitted_at: null }).eq('id', existing.id)
    setSubmitting(false)
    if (error) { notify('error', error.message); return }
    notify('success', `${monthLabel(period)} reopened — now editable`)
    refreshAdj()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input type="month" className="fiori-input w-48" value={period} onChange={e => setPeriod(e.target.value)} />
        {existing?.submitted_at && (
          <Badge tone={submittedDrift ? 'critical' : 'positive'}>
            <Icon name="lock" className="text-[13px]" /> Submitted {formatDateTime(existing.submitted_at)}{submittedDrift ? ' · figures changed since' : ''}
          </Badge>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" icon="picture_as_pdf" onClick={exportPDF}>Export PDF</Button>
          {existing?.submitted_at
            ? <>
                {canEdit && <Button variant="secondary" icon="lock_open" loading={submitting} onClick={reopen}>Reopen</Button>}
                {canEdit && <Button icon="task_alt" loading={submitting} onClick={markSubmitted}>Re-submit</Button>}
              </>
            : (existing ? canEdit : canCreate) && <Button icon="task_alt" loading={submitting} onClick={markSubmitted}>Mark Submitted</Button>}
        </div>
      </div>
      {existing?.submitted_at && !submittedDrift && (
        <p className="rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok">
          <Icon name="lock" className="text-[14px]" /> This month is submitted &amp; locked — its receipts, expenses and balance adjustments can't be changed. Use Reopen to edit, then re-submit.
        </p>
      )}
      {submittedDrift && (
        <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">
          This month's receipts/expenses were edited after it was submitted — the figures shown no longer match what was sent to Head Office
          (submitted: {formatNumber(existing.total_fund_received, 2)} received / {formatNumber(existing.total_expense, 2)} expense / {formatNumber(existing.closing_balance, 2)} C/D).
          Re-submit to send the corrected figures.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon="account_balance" tone={openingBalance < 0 ? 'bad' : 'brand'} label="Balance B/D" value={`${formatNumber(openingBalance, 2)} BDT`} />
        <StatCard icon="payments" tone="ok" label="Fund Received (Month)" value={`${formatNumber(totalReceivedMonth, 2)} BDT`} />
        <StatCard icon="shopping_cart" tone="bad" label="Cash Paid (Month)" value={`${formatNumber(monthCashPaid, 2)} BDT`} />
        <StatCard icon="account_balance_wallet" tone={closingBalance < 0 ? 'bad' : 'brand'} label="Balance C/D" value={`${formatNumber(closingBalance, 2)} BDT`} />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="flex min-h-0 flex-col overflow-hidden p-4">
          <SectionHeader icon="payments" tone="ok" title={`Fund Received — ${monthLabel(period)}`} />
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
          <SectionHeader icon="tune" title={`Balance Adjustments — ${monthLabel(period)}`}
            action={canCreate && !addingAdjustment && <Button size="sm" variant="secondary" icon="add" onClick={() => setAddingAdjustment(true)}>Add</Button>} />
          {addingAdjustment && (
            <AddBalanceAdjustmentRow clientId={currentClientId!} notify={notify}
              onDone={() => { setAddingAdjustment(false); refreshBalanceAdj() }} onCancel={() => setAddingAdjustment(false)} />
          )}
          <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-surface-line">
            {monthBalanceAdjustments.length === 0 && !addingAdjustment ? <p className="p-3 text-sm text-ink-faint">No adjustments this month</p> :
              monthBalanceAdjustments.map((a: any, i: number) => (
                <div key={a.id ?? i} className={'flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                  <span className="text-ink">{formatDate(a.adjustment_date)}{a.remarks ? <span className="text-ink-faint"> · {a.remarks}</span> : null}</span>
                  <span className={'font-semibold ' + (Number(a.amount) < 0 ? 'text-bad' : 'text-ink')}>{Number(a.amount) > 0 ? '+' : ''}{formatNumber(a.amount, 2)}</span>
                </div>
              ))}
          </div>
        </Card>

        <Card className="flex min-h-0 flex-col overflow-hidden p-4">
          <SectionHeader icon="pie_chart" title={`Category Summary — ${monthLabel(period)}`} />
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
        <SectionHeader icon="receipt_long" tone="bad" title={`Expense Details — ${monthLabel(period)}`} />
        <div className="max-h-72 overflow-y-auto rounded-xl border border-surface-line">
          {l2 ? <p className="p-3 text-sm text-ink-faint">Loading…</p> : monthExpenses.length === 0 ? <p className="p-3 text-sm text-ink-faint">No expenses this month</p> :
            monthExpenses.map((e, i) => (
              <div key={e.id} className={'flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                <div className="min-w-0">
                  <span className="text-ink">{formatDate(e.expense_date)} · {catName(e)}</span>
                  <p className="truncate text-xs text-ink-faint">{e.payee_name || '—'}{e.description ? ` — ${e.description}` : ''}</p>
                </div>
                <span className="flex shrink-0 items-center gap-2 font-semibold text-ink">{isCredit(e) && <Badge tone="critical">Credit (unpaid)</Badge>}{formatNumber(e.amount, 2)}</span>
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
                    <Bar key={cat} dataKey={cat} stackId="exp" fill={cat === 'Other' ? OTHER_COLOR : CAT_COLORS[i]} radius={i === topCats.length - 1 ? [4, 4, 0, 0] : undefined} maxBarSize={48} />
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

// A signed manual correction to the running balance — most commonly used
// once, to seed the opening balance this system inherited from whatever
// tracking (Excel, paper) was used before it, but also available for any
// later one-off correction (a bank charge, a rounding fix) that isn't a
// real fund receipt or expense.
function AddBalanceAdjustmentRow({ clientId, notify, onDone, onCancel }: any) {
  const [date, setDate] = useState(today())
  const [amount, setAmount] = useState('')
  const [remarks, setRemarks] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!Number(amount)) { notify('error', 'Enter an adjustment amount (positive to add, negative to subtract)'); return }
    setSaving(true)
    const { error } = await supabase.from('finance_balance_adjustments').insert({
      client_id: clientId, adjustment_date: date, amount: Number(amount), remarks: remarks || null
    })
    setSaving(false)
    if (error) { notify('error', error.message); return }
    notify('success', 'Balance adjustment recorded')
    onDone()
  }

  return (
    <div className="mb-2 rounded-lg border border-surface-line bg-surface-sunken/40 p-2">
      <div className="grid grid-cols-[130px_110px_1fr_auto_auto] items-center gap-2">
        <input className="fiori-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
        <input className="fiori-input" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="+/- Amount" />
        <input className="fiori-input" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="e.g. Opening balance carried from manual records" />
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button size="sm" loading={saving} onClick={save}>Save</Button>
      </div>
      <p className="mt-1.5 text-xs text-ink-faint">Positive adds to the balance, negative subtracts. Dated on or before this month, it also carries into every later month's B/D.</p>
    </div>
  )
}

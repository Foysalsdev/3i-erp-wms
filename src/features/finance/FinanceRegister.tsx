import { useMemo, useState } from 'react'
import { useCollection } from '@/hooks/useCollection'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { SelectBox } from '@/components/ui/SelectBox'
import { formatNumber, formatDate } from '@/lib/utils'
import { downloadCSV, downloadReportPDF, ReportToolbar, type RepCol } from '@/features/reports/export'
import { StatCard } from './components/FinanceUI'

// Finance registers live inside the finance module (gated by finance.view), not
// in the shared Reports module — the spend log is sensitive. One filterable
// view toggles between the Voucher (expense) register and the Requisition
// register; both export to CSV and a company-letterhead PDF.
const monthOf = (d: string) => (d ?? '').slice(0, 7)

export function FinanceRegister() {
  const { data: expenses } = useCollection('finance_expenses', { order: 'expense_date' })
  const { data: reqs } = useCollection('finance_requisitions', { order: 'req_date' })
  const { data: cats } = useCollection('finance_expense_categories', { order: 'name', ascending: true })
  const catName = (id: string) => (cats as any[]).find(c => c.id === id)?.name ?? 'Uncategorized'
  const [reg, setReg] = useState<'voucher' | 'requisition'>('voucher')
  const [month, setMonth] = useState('')
  const [head, setHead] = useState('')

  const vData = useMemo(() => (expenses as any[])
    .filter(e => (!month || monthOf(e.expense_date) === month) && (!head || e.category_id === head))
    .map(e => ({ id: e.id, date: formatDate(e.expense_date), head: catName(e.category_id), payee: e.payee_name || '—', mode: e.payment_mode || '—', bill: e.vendor_bill_no || '—', amount: Number(e.amount) || 0 })),
    [expenses, cats, month, head])

  const rData = useMemo(() => (reqs as any[])
    .filter(r => !month || monthOf(r.req_date) === month)
    .map(r => ({ id: r.id, no: r.req_no, date: formatDate(r.req_date), sender: r.sender_name || '—', amount: Number(r.grand_total) || 0 })),
    [reqs, month])

  const isV = reg === 'voucher'
  const total = (isV ? vData : rData).reduce((s, r) => s + r.amount, 0)
  const count = (isV ? vData : rData).length

  const vCols: RepCol[] = [
    { key: 'date', header: 'Date', width: '13%' }, { key: 'head', header: 'Expense Head', width: '24%' },
    { key: 'payee', header: 'Paid To', width: '21%' }, { key: 'mode', header: 'Mode', width: '11%' },
    { key: 'bill', header: 'Vendor Bill', width: '14%' }, { key: 'amount', header: 'Amount (BDT)', align: 'right', width: '15%' }
  ]
  const rCols: RepCol[] = [
    { key: 'no', header: 'Requisition No', width: '24%' }, { key: 'date', header: 'Date', width: '18%' },
    { key: 'sender', header: 'Sent By', width: '33%' }, { key: 'amount', header: 'Requested (BDT)', align: 'right', width: '25%' }
  ]
  const cols = isV ? vCols : rCols
  const csv = useMemo(() => (isV ? vData.map(({ id, ...r }) => ({ ...r, amount: r.amount.toFixed(2) }))
    : rData.map(({ id, ...r }) => ({ ...r, amount: r.amount.toFixed(2) }))), [isV, vData, rData])
  const title = isV ? 'Procurement Register' : 'Requisition Register'
  const subtitle = `${isV ? 'Total spend' : 'Total requested'} ${formatNumber(total, 2)} BDT · ${count} entries${month ? ` · ${month}` : ''}`

  const vTable = [
    { key: 'date', header: 'Date', accessor: (r: any) => r.date },
    { key: 'head', header: 'Expense Head', accessor: (r: any) => r.head, className: 'font-medium' },
    { key: 'payee', header: 'Paid To', accessor: (r: any) => r.payee },
    { key: 'mode', header: 'Mode', render: (r: any) => r.mode === '—' ? '—' : <Badge tone="neutral">{r.mode}</Badge> },
    { key: 'bill', header: 'Vendor Bill', accessor: (r: any) => r.bill },
    { key: 'amount', header: 'Amount', className: 'text-right', accessor: (r: any) => formatNumber(r.amount, 2) }
  ]
  const rTable = [
    { key: 'no', header: 'Requisition No', accessor: (r: any) => r.no, className: 'font-medium' },
    { key: 'date', header: 'Date', accessor: (r: any) => r.date },
    { key: 'sender', header: 'Sent By', accessor: (r: any) => r.sender },
    { key: 'amount', header: 'Requested', className: 'text-right', accessor: (r: any) => formatNumber(r.amount, 2) }
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-surface-line p-0.5">
          {(['voucher', 'requisition'] as const).map(k => (
            <button key={k} onClick={() => setReg(k)}
              className={'rounded-md px-3 py-1.5 text-sm font-medium ' + (reg === k ? 'bg-brand-400 text-coal-900' : 'text-ink-soft hover:bg-surface-sunken')}>
              {k === 'voucher' ? 'Procurement' : 'Requisitions'}
            </button>
          ))}
        </div>
        <input type="month" className="fiori-input w-44" value={month} onChange={e => setMonth(e.target.value)} />
        {month && <button onClick={() => setMonth('')} className="text-xs text-ink-faint hover:text-ink">Clear month</button>}
        {isV && (
          <SelectBox className="w-52" value={head} onChange={e => setHead(e.target.value)}>
            <option value="">All expense heads</option>
            {(cats as any[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectBox>
        )}
        <div className="ml-auto"><ReportToolbar count={count} onCSV={() => downloadCSV(title, cols, csv)} onPDF={() => downloadReportPDF(title, subtitle, cols, csv)} /></div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard icon="receipt_long" label="Entries" value={formatNumber(count)} />
        <StatCard icon="payments" tone={isV ? 'bad' : 'ok'} label={isV ? 'Total Spend' : 'Total Requested'} value={`${formatNumber(total, 2)} BDT`} />
        {isV && <StatCard icon="pie_chart" label="Heads" value={formatNumber(new Set(vData.map(d => d.head)).size)} />}
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DataTable fill columns={isV ? vTable : rTable} rows={isV ? vData : rData} rowKey={(r: any) => r.id} emptyTitle={isV ? 'No vouchers' : 'No requisitions'} />
      </Card>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { useCollection } from '@/hooks/useCollection'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { ActionMenu } from '@/components/ui/ActionMenu'
import { ConfirmDelete } from '@/components/ui/ConfirmDelete'
import { SearchBar } from '@/components/shared/SearchBar'
import { SelectBox } from '@/components/ui/SelectBox'
import { formatNumber, formatDate } from '@/lib/utils'
import { downloadBillVoucherPDF } from '@/pdf/FinancePDF'
import { downloadCSV, downloadReportPDF, ReportToolbar, type RepCol } from '@/features/reports/export'
import { useAutoOpen } from '@/hooks/useAutoOpen'
import { StatCard, SectionHeader } from './components/FinanceUI'
import { ExpenseForm, EXPENSE_TYPES } from './ExpenseForm'
import { VOUCHER_STATUS_LABEL, VOUCHER_STATUS_TONE, fetchExpenseLines } from './financeCash'

const today = () => new Date().toISOString().slice(0, 10)
const monthOf = (d: string) => (d ?? '').slice(0, 7)

// Finance → Expenses (was "Procurement"): every operational expense type,
// one dynamic entry form (ExpenseForm). Each row is one expense; Procurement
// rows also carry an item grid (finance_expense_bills).
export function Expenses() {
  const { data: raw, loading, refresh } = useCollection('finance_expenses', { order: 'created_at', ascending: false })
  const { data: items, refresh: refreshItems } = useCollection('finance_items', { order: 'name', ascending: true })
  const { data: categories } = useCollection('finance_expense_categories', { order: 'name', ascending: true })
  const { currentClientId, can, isPlatformAdmin } = useAuth()
  const notify = useUI(s => s.notify)
  const canCreate = can('finance.create'), canEdit = can('finance.edit')
  const [q, setQ] = useState('')
  const [month, setMonth] = useState('')
  const [type, setType] = useState('')
  const [modal, setModal] = useState<{ record: any; quick?: boolean } | null>(null)
  useAutoOpen(() => setModal({ record: null }))
  const [viewing, setViewing] = useState<any>(null)
  const [deleting, setDeleting] = useState<any>(null)

  const data = useMemo(() => (raw as any[]).filter(e => !e.deleted_at), [raw])
  const refreshMasters = () => refreshItems()
  const recentPayees = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const e of data) {
      const p = (e.payee_name || '').trim()
      if (p && !seen.has(p.toLowerCase())) { seen.add(p.toLowerCase()); out.push(p) }
      if (out.length >= 20) break
    }
    return out
  }, [data])

  // Frequently used expense combos (type + description), ranked by recency-weighted
  // frequency across the last 200 entries — one click opens a prefilled entry.
  const frequentExpenses = useMemo(() => {
    const counts = new Map<string, { expense_type: string; description: string; department?: string; payment_mode?: string; count: number }>()
    for (const e of data.slice(0, 200)) {
      if (e.expense_type === 'Procurement') continue
      const key = `${e.expense_type}::${(e.description || '').trim().toLowerCase()}`
      const cur = counts.get(key)
      if (cur) cur.count++
      else counts.set(key, { expense_type: e.expense_type, description: e.description || '', department: e.department, payment_mode: e.payment_mode, count: 1 })
    }
    return [...counts.values()].filter(c => c.count > 1).sort((a, b) => b.count - a.count).slice(0, 6)
  }, [data])

  const fetchLines = fetchExpenseLines

  const openView = async (r: any) => {
    try { setViewing(r.expense_type === 'Procurement' ? { ...r, ...(await fetchLines(r.id)) } : r) }
    catch (e: any) { notify('error', e?.message ?? 'Could not load the expense') }
  }
  const openEdit = async (r: any) => {
    if (r.submission_id) { notify('error', 'This voucher is submitted to Head Office (locked). Unlock it from Voucher Register first.'); return }
    try {
      const extra = r.expense_type === 'Procurement' ? await fetchLines(r.id) : {}
      setModal({ record: { ...r, ...extra } })
    } catch (e: any) { notify('error', e?.message ?? 'Could not load the expense') }
  }
  const duplicate = async (r: any) => {
    const extra = r.expense_type === 'Procurement' ? await fetchLines(r.id).catch((e: any) => { notify('error', e?.message ?? 'Could not load the expense'); return null }) : {}
    if (extra === null) return
    setModal({
      record: {
        expense_type: r.expense_type, department: r.department, payment_mode: r.payment_mode,
        payee_name: r.payee_name, doc_type: r.doc_type, details: r.details, expense_date: today(), ...extra
      }
    })
  }
  const openFrequent = (f: any) => setModal({
    record: { expense_type: f.expense_type, description: f.description, department: f.department, payment_mode: f.payment_mode || 'Cash', expense_date: today() }
  })

  const printBill = async (r: any) => {
    try {
      const { __items, __addl } = r.expense_type === 'Procurement' ? await fetchLines(r.id) : { __items: [], __addl: [] }
      const lines = [
        ...__items.map((it: any) => ({ particulars: it.name || '—', unit: it.unit || undefined, qty: it.qty ?? undefined, rate: it.rate ?? undefined, amount: (Number(it.qty) || 0) * (Number(it.rate) || 0) })),
        ...__addl.map((a: any) => ({ particulars: a.expense_type || 'Additional', amount: Number(a.amount) || 0 }))
      ]
      await downloadBillVoucherPDF({
        title: r.expense_type || 'Expense',
        billRef: r.doc_no || r.vendor_bill_no || r.id.slice(0, 8).toUpperCase(),
        date: formatDate(r.expense_date),
        payee: r.payee_name || undefined,
        purpose: [r.department, r.description].filter(Boolean).join(' · ') || undefined,
        lines: lines.length ? lines : [{ particulars: r.expense_type || 'Expense', amount: Number(r.amount) || 0 }],
        lessDeduction: 0,
        signLabels: ['Prepared By', 'Verified By', 'Approved By', 'Head Office']
      })
      if (r.doc_type === 'internal_voucher') await supabase.from('finance_expenses').update({ print_count: (r.print_count || 0) + 1 }).eq('id', r.id).then(() => refresh())
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not generate the PDF')
    }
  }

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return data.filter(r =>
      (!month || monthOf(r.expense_date) === month) &&
      (!type || r.expense_type === type) &&
      (!t ||
        String(r.doc_no ?? '').toLowerCase().includes(t) ||
        String(r.payee_name ?? '').toLowerCase().includes(t) ||
        String(r.department ?? '').toLowerCase().includes(t) ||
        String(r.expense_type ?? '').toLowerCase().includes(t)))
  }, [data, q, month, type])

  const exportCols: RepCol[] = [
    { key: 'no', header: 'Expense ID', width: '14%' }, { key: 'date', header: 'Date', width: '10%' },
    { key: 'type', header: 'Type', width: '13%' }, { key: 'vendor', header: 'Vendor/Payee', width: '17%' },
    { key: 'dept', header: 'Department', width: '12%' }, { key: 'pay', header: 'Payment', width: '9%' },
    { key: 'status', header: 'Voucher Status', width: '13%' }, { key: 'amount', header: 'Total (BDT)', align: 'right', width: '12%' }
  ]
  const exportRows = useMemo(() => rows.map(r => ({
    no: r.doc_no || (r.is_draft ? 'Draft' : '—'), date: formatDate(r.expense_date), type: r.expense_type || '—',
    vendor: r.payee_name || '—', dept: r.department || '—', pay: r.payment_mode || '—',
    status: VOUCHER_STATUS_LABEL[r.voucher_status] || r.voucher_status || '—', amount: (Number(r.amount) || 0).toFixed(2)
  })), [rows])
  const exportTotal = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const exportSubtitle = `Total spend ${formatNumber(exportTotal, 2)} BDT · ${rows.length} entries${month ? ` · ${month}` : ''}`

  const columns = [
    { key: 'doc_no', header: 'Expense ID', render: (r: any) => <span className="font-medium">{r.doc_no || (r.is_draft ? <Badge tone="neutral">Draft</Badge> : '—')}</span> },
    { key: 'expense_date', header: 'Date', render: (r: any) => formatDate(r.expense_date), sortable: true },
    { key: 'expense_type', header: 'Type', render: (r: any) => r.expense_type || '—' },
    { key: 'vendor', header: 'Vendor/Payee', render: (r: any) => r.payee_name || '—' },
    { key: 'department', header: 'Department', render: (r: any) => r.department || '—' },
    { key: 'payment_mode', header: 'Payment', render: (r: any) => r.payment_mode || '—' },
    { key: 'voucher_status', header: 'Voucher Status', render: (r: any) => <Badge tone={VOUCHER_STATUS_TONE[r.voucher_status] || 'neutral'}>{VOUCHER_STATUS_LABEL[r.voucher_status] || r.voucher_status}</Badge> },
    { key: 'amount', header: 'Total (BDT)', accessor: (r: any) => formatNumber(r.amount, 2), className: 'text-right' },
    {
      key: '__a', header: '', className: 'w-px whitespace-nowrap',
      render: (r: any) => (
        <div className="flex justify-end" onClick={e => e.stopPropagation()}>
          <ActionMenu items={[
            { icon: 'visibility', label: 'View', onClick: () => openView(r) },
            { icon: 'receipt_long', label: 'Generate PDF', onClick: () => printBill(r) },
            ...(canCreate ? [{ icon: 'content_copy', label: 'Duplicate', onClick: () => duplicate(r) }] : []),
            ...(canEdit && !r.submission_id ? [{ icon: 'edit', label: 'Edit', onClick: () => openEdit(r) }] : []),
            ...(isPlatformAdmin && !r.submission_id ? [{ icon: 'delete', label: 'Delete', tone: '!text-bad hover:!text-bad hover:!bg-bad/10', onClick: () => setDeleting(r) }] : [])
          ]} />
        </div>
      )
    }
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {frequentExpenses.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-ink-faint">Frequently used:</span>
          {frequentExpenses.map((f, i) => (
            <button key={i} type="button" onClick={() => openFrequent(f)}
              className="rounded-full border border-surface-line px-3 py-1 text-xs font-medium text-ink-soft transition-colors hover:border-brand-400 hover:text-brand-600">
              + {f.expense_type}{f.description ? ` · ${f.description}` : ''}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-60"><SearchBar value={q} onChange={setQ} placeholder="Search expense ID, vendor…" /></div>
        <input type="month" className="fiori-input w-40" value={month} onChange={e => setMonth(e.target.value)} />
        {month && <button onClick={() => setMonth('')} className="text-xs text-ink-faint hover:text-ink">Clear</button>}
        <SelectBox className="w-48" value={type} onChange={e => setType(e.target.value)}>
          <option value="">All types</option>
          {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </SelectBox>
        <ReportToolbar count={rows.length} onCSV={() => downloadCSV('Expense Register', exportCols, exportRows)} onPDF={() => downloadReportPDF('Expense Register', exportSubtitle, exportCols, exportRows)} />
        {canCreate && <Button variant="secondary" icon="bolt" onClick={() => setModal({ record: null, quick: true })}>Quick Entry</Button>}
        {canCreate && <Button className="ml-auto" icon="add" onClick={() => setModal({ record: null })}>New Expense</Button>}
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DataTable fill columns={columns} rows={rows} loading={loading} rowKey={(r: any) => r.id}
          onRowClick={canEdit ? openEdit : openView} emptyTitle="No expenses recorded yet" />
      </Card>

      {modal && (
        <ExpenseForm record={modal.record} quick={modal.quick} clientId={currentClientId!} items={items} categories={categories} recentPayees={recentPayees}
          onMastersChanged={refreshMasters} notify={notify} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh() }} />
      )}

      {viewing && (
        <ExpenseOverview p={viewing} canEdit={canEdit}
          onEdit={() => { const r = viewing; setViewing(null); openEdit(r) }}
          onPrint={() => printBill(viewing)} onClose={() => setViewing(null)} />
      )}

      <ConfirmDelete open={!!deleting} onClose={() => setDeleting(null)}
        name={deleting ? `Expense · ${deleting.doc_no || formatDate(deleting.expense_date)}` : undefined}
        onConfirm={async () => {
          // Soft delete — data stays for reconciliation, just hidden everywhere.
          const res = await supabase.from('finance_expenses').update({ deleted_at: new Date().toISOString() }).eq('id', deleting.id)
          if (!res.error) { setDeleting(null); refresh() }
          return res
        }} />
    </div>
  )
}

export function ExpenseOverview({ p, canEdit, onEdit, onPrint, onClose }: any) {
  const items: any[] = p.__items ?? []
  const addl: any[] = p.__addl ?? []
  const isProcurement = p.expense_type === 'Procurement'
  const subtotal = items.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.rate) || 0), 0)
  const addlTotal = addl.reduce((s, a) => s + (Number(a.amount) || 0), 0)
  const details = p.details ?? {}
  return (
    <Modal open onClose={onClose} title={`Expense — ${p.doc_no || (p.is_draft ? 'Draft' : '')}`} size="lg">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard icon="calendar_month" label="Date" value={formatDate(p.expense_date)} />
          <StatCard icon="local_shipping" label="Vendor/Payee" value={p.payee_name || '—'} />
          <StatCard icon="sell" label="Type" value={p.expense_type || '—'} />
          <StatCard icon="account_balance" label="Payment" value={p.payment_mode || '—'} />
          <StatCard icon="apartment" label="Department" value={p.department || '—'} />
          <StatCard icon="payments" tone="bad" label="Total" value={`${formatNumber(p.amount, 2)} BDT`} />
        </div>
        {!isProcurement && Object.keys(details).length > 0 && (
          <div>
            <SectionHeader icon="tune" title={`${p.expense_type} Details`} />
            <div className="overflow-hidden rounded-xl border border-surface-line">
              {Object.entries(details).filter(([, v]) => v !== '' && v != null).map(([k, v], i) => (
                <div key={k} className={'flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                  <span className="capitalize text-ink-faint">{k.replace(/_/g, ' ')}</span><span className="text-ink">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {isProcurement && <div>
          <SectionHeader icon="inventory_2" title="Items" />
          <div className="overflow-hidden rounded-xl border border-surface-line">
            {items.length === 0 ? <p className="p-3 text-sm text-ink-faint">No items</p> : items.map((it, i) => (
              <div key={i} className={'flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                <span className="text-ink">{it.name || '—'}<span className="text-ink-faint"> · {it.qty ?? ''} {it.unit ?? ''} × {formatNumber(it.rate, 2)}</span></span>
                <span className="font-semibold tabular-nums text-ink">{formatNumber((Number(it.qty) || 0) * (Number(it.rate) || 0), 2)}</span>
              </div>
            ))}
          </div>
        </div>}
        {addl.length > 0 && <div>
          <SectionHeader icon="add_card" title="Additional Expenses" />
          <div className="overflow-hidden rounded-xl border border-surface-line">
            {addl.map((a, i) => (
              <div key={i} className={'flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                <span className="text-ink">{a.expense_type || '—'}</span><span className="font-semibold tabular-nums text-ink">{formatNumber(a.amount, 2)}</span>
              </div>
            ))}
          </div>
        </div>}
        {isProcurement && <div className="flex flex-col items-end gap-1 text-sm">
          <div className="flex w-full max-w-xs justify-between"><span className="text-ink-soft">Subtotal</span><span className="tabular-nums">{formatNumber(subtotal, 2)}</span></div>
          <div className="flex w-full max-w-xs justify-between"><span className="text-ink-soft">Additional</span><span className="tabular-nums">{formatNumber(addlTotal, 2)}</span></div>
          <div className="flex w-full max-w-xs justify-between border-t border-surface-line pt-1"><span className="font-semibold">Grand Total</span><span className="font-bold tabular-nums text-brand-700 dark:text-brand-300">{formatNumber(p.amount, 2)} BDT</span></div>
        </div>}
        {p.description && <p className="text-sm text-ink-soft"><span className="text-ink-faint">Remarks: </span>{p.description}</p>}
        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="secondary" icon="receipt_long" onClick={onPrint}>Generate PDF</Button>
          {canEdit && !p.submission_id && <Button icon="edit" onClick={onEdit}>Edit</Button>}
        </div>
      </div>
    </Modal>
  )
}

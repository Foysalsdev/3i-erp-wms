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
import { SearchBar } from '@/components/shared/SearchBar'
import { SelectBox } from '@/components/ui/SelectBox'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { formatNumber, formatDate, formatDateTime } from '@/lib/utils'
import { downloadBillVoucherPDF } from '@/pdf/FinancePDF'
import { downloadCSV, downloadReportPDF, ReportToolbar, type RepCol } from '@/features/reports/export'
import { VOUCHER_STATUS_LABEL, VOUCHER_STATUS_TONE, DOC_TYPE_LABEL, fetchExpenseLines } from './financeCash'
import { ExpenseForm, EXPENSE_TYPES, PAYMENT_METHODS } from './ExpenseForm'
import { ExpenseOverview } from './Expenses'

const monthOf = (d: string) => (d ?? '').slice(0, 7)

// Finance → Voucher Register: every expense in one filterable list, its
// voucher status and HO Submission status side by side. A voucher locks the
// moment it's inside a submitted HO Submission (submission_id set) — Edit
// disappears and only "Unlock" (with a reason) can free it, for the manual
// returned-voucher flow.
export function VoucherRegister() {
  const { data: rawExpenses, loading, refresh } = useCollection('finance_expenses', { order: 'created_at', ascending: false })
  const { data: submissions } = useCollection('finance_ho_submissions', {})
  const { data: items, refresh: refreshItems } = useCollection('finance_items', { order: 'name', ascending: true })
  const { data: categories } = useCollection('finance_expense_categories', {})
  const { currentClientId, can, isPlatformAdmin } = useAuth()
  const notify = useUI(s => s.notify)
  const canEdit = can('finance.edit')
  const [q, setQ] = useState('')
  const [month, setMonth] = useState('')
  const [type, setType] = useState('')
  const [department, setDepartment] = useState('')
  const [payMethod, setPayMethod] = useState('')
  const [voucherStatus, setVoucherStatus] = useState('')
  const [submissionFilter, setSubmissionFilter] = useState('')
  const [minAmt, setMinAmt] = useState('')
  const [maxAmt, setMaxAmt] = useState('')
  const [editModal, setEditModal] = useState<any>(null)
  const [viewing, setViewing] = useState<any>(null)
  const [markLost, setMarkLost] = useState<any>(null)
  const [unlocking, setUnlocking] = useState<any>(null)

  const data = useMemo(() => (rawExpenses as any[]).filter(e => !e.deleted_at && !e.is_draft), [rawExpenses])
  const submissionById = useMemo(() => new Map((submissions as any[]).map(s => [s.id, s])), [submissions])
  const departments = useMemo(() => [...new Set(data.map(e => e.department).filter(Boolean))].sort(), [data])
  const submissionStatus = (r: any) => !r.submission_id ? 'not_submitted' : (submissionById.get(r.submission_id)?.status || 'submitted')

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return data.filter(r => {
      if (month && monthOf(r.expense_date) !== month) return false
      if (type && r.expense_type !== type) return false
      if (department && r.department !== department) return false
      if (payMethod && r.payment_mode !== payMethod) return false
      if (voucherStatus && r.voucher_status !== voucherStatus) return false
      if (submissionFilter && submissionStatus(r) !== submissionFilter) return false
      if (minAmt && (Number(r.amount) || 0) < Number(minAmt)) return false
      if (maxAmt && (Number(r.amount) || 0) > Number(maxAmt)) return false
      if (t && !String(r.doc_no ?? '').toLowerCase().includes(t) && !String(r.payee_name ?? '').toLowerCase().includes(t) && !String(r.vendor_bill_no ?? '').toLowerCase().includes(t)) return false
      return true
    })
  }, [data, q, month, type, department, payMethod, voucherStatus, submissionFilter, minAmt, maxAmt, submissionById])

  const openView = async (r: any) => setViewing(r.expense_type === 'Procurement' ? { ...r, ...(await fetchExpenseLines(r.id)) } : r)
  const openEdit = async (r: any) => {
    if (r.submission_id) { notify('error', 'This voucher is submitted to Head Office (locked). Use Unlock first.'); return }
    const extra = r.expense_type === 'Procurement' ? await fetchExpenseLines(r.id) : {}
    setEditModal({ ...r, ...extra })
  }
  const printBill = async (r: any) => {
    try {
      const { __items, __addl } = r.expense_type === 'Procurement' ? await fetchExpenseLines(r.id) : { __items: [], __addl: [] }
      const lines = [
        ...(__items ?? []).map((it: any) => ({ particulars: it.name || '—', unit: it.unit || undefined, qty: it.qty ?? undefined, rate: it.rate ?? undefined, amount: (Number(it.qty) || 0) * (Number(it.rate) || 0) })),
        ...(__addl ?? []).map((a: any) => ({ particulars: a.expense_type || 'Additional', amount: Number(a.amount) || 0 }))
      ]
      await downloadBillVoucherPDF({
        title: r.expense_type || 'Expense', billRef: r.doc_no || r.vendor_bill_no || r.id.slice(0, 8).toUpperCase(),
        date: formatDate(r.expense_date), payee: r.payee_name || undefined,
        purpose: [r.department, r.description].filter(Boolean).join(' · ') || undefined,
        lines: lines.length ? lines : [{ particulars: r.expense_type || 'Expense', amount: Number(r.amount) || 0 }],
        lessDeduction: 0, signLabels: ['Prepared By', 'Verified By', 'Approved By', 'Head Office']
      })
      if (r.doc_type === 'internal_voucher') await supabase.from('finance_expenses').update({ print_count: (r.print_count || 0) + 1 }).eq('id', r.id).then(() => refresh())
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not generate the PDF')
    }
  }
  const markCollected = async (r: any) => {
    const { error } = await supabase.from('finance_expenses').update({ voucher_status: 'collected' }).eq('id', r.id)
    if (error) { notify('error', error.message); return }
    notify('success', 'Marked Collected'); refresh()
  }
  const doMarkLost = async () => {
    const { error } = await supabase.from('finance_expenses').update({ voucher_status: 'lost', description: [markLost.record.description, markLost.note ? `Lost: ${markLost.note}` : null].filter(Boolean).join(' · ') }).eq('id', markLost.record.id)
    if (error) { notify('error', error.message); return }
    notify('success', 'Marked Lost'); setMarkLost(null); refresh()
  }
  const doUnlock = async () => {
    const r = unlocking.record
    const { error } = await supabase.from('finance_expenses').update({ submission_id: null, voucher_status: 'collected' }).eq('id', r.id)
    if (error) { notify('error', error.message); return }
    await supabase.from('finance_ho_submission_vouchers').update({ returned_at: new Date().toISOString(), return_note: unlocking.note || null })
      .eq('submission_id', r.submission_id).eq('expense_id', r.id)
    notify('success', 'Voucher unlocked — back to Ready for Submission'); setUnlocking(null); refresh()
  }

  const exportCols: RepCol[] = [
    { key: 'no', header: 'Expense ID', width: '13%' }, { key: 'vno', header: 'Voucher No', width: '12%' },
    { key: 'doc', header: 'Doc Type', width: '13%' }, { key: 'type', header: 'Expense Type', width: '12%' },
    { key: 'vendor', header: 'Vendor/Payee', width: '15%' }, { key: 'amount', header: 'Amount (BDT)', align: 'right', width: '11%' },
    { key: 'vstatus', header: 'Voucher Status', width: '12%' }, { key: 'sstatus', header: 'HO Submission', width: '12%' }
  ]
  const exportRows = useMemo(() => rows.map(r => ({
    no: r.doc_no || '—', vno: r.vendor_bill_no || '—', doc: DOC_TYPE_LABEL[r.doc_type] || r.doc_type,
    type: r.expense_type || '—', vendor: r.payee_name || '—', amount: (Number(r.amount) || 0).toFixed(2),
    vstatus: VOUCHER_STATUS_LABEL[r.voucher_status] || r.voucher_status || '—',
    sstatus: submissionStatus(r) === 'not_submitted' ? 'Not Submitted' : (submissionById.get(r.submission_id)?.submission_no || '—')
  })), [rows, submissionById])

  const columns = [
    { key: 'doc_no', header: 'Expense ID', render: (r: any) => <span className="font-medium">{r.doc_no || '—'}</span> },
    { key: 'vendor_bill_no', header: 'Voucher No', render: (r: any) => r.vendor_bill_no || '—' },
    { key: 'doc_type', header: 'Doc Type', render: (r: any) => DOC_TYPE_LABEL[r.doc_type] || r.doc_type },
    { key: 'expense_type', header: 'Type', render: (r: any) => r.expense_type || '—' },
    { key: 'vendor', header: 'Vendor/Payee', render: (r: any) => r.payee_name || '—' },
    { key: 'amount', header: 'Amount', accessor: (r: any) => formatNumber(r.amount, 2), className: 'text-right' },
    { key: 'voucher_status', header: 'Voucher Status', render: (r: any) => <Badge tone={VOUCHER_STATUS_TONE[r.voucher_status] || 'neutral'}>{VOUCHER_STATUS_LABEL[r.voucher_status] || r.voucher_status}</Badge> },
    {
      key: 'submission', header: 'HO Submission', render: (r: any) => {
        const st = submissionStatus(r)
        if (st === 'not_submitted') return <span className="text-ink-faint">—</span>
        const sub = submissionById.get(r.submission_id)
        return <Badge tone={st === 'verified' ? 'positive' : 'brand'}>{sub?.submission_no || 'Submitted'}</Badge>
      }
    },
    { key: 'created_at', header: 'Created', render: (r: any) => formatDateTime(r.created_at) },
    {
      key: '__a', header: '', className: 'w-px whitespace-nowrap',
      render: (r: any) => (
        <div className="flex justify-end" onClick={e => e.stopPropagation()}>
          <ActionMenu items={[
            { icon: 'visibility', label: 'View', onClick: () => openView(r) },
            { icon: 'receipt_long', label: 'Print', onClick: () => printBill(r) },
            ...(r.voucher_status === 'pending_collection' || r.voucher_status === 'lost' ? [{ icon: 'inventory', label: 'Mark Collected', onClick: () => markCollected(r) }] : []),
            ...(r.voucher_status === 'pending_collection' ? [{ icon: 'help', label: 'Mark Lost', onClick: () => setMarkLost({ record: r, note: '' }) }] : []),
            ...(canEdit && !r.submission_id ? [{ icon: 'edit', label: 'Edit', onClick: () => openEdit(r) }] : []),
            ...(canEdit && r.submission_id && submissionStatus(r) !== 'verified' ? [{ icon: 'lock_open', label: 'Unlock', onClick: () => setUnlocking({ record: r, note: '' }) }] : []),
            ...(isPlatformAdmin && !r.submission_id ? [{ icon: 'delete', label: 'Delete', tone: '!text-bad hover:!text-bad hover:!bg-bad/10', onClick: async () => { await supabase.from('finance_expenses').update({ deleted_at: new Date().toISOString() }).eq('id', r.id); refresh() } }] : [])
          ]} />
        </div>
      )
    }
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-56"><SearchBar value={q} onChange={setQ} placeholder="Search ID, vendor, voucher no…" /></div>
        <input type="month" className="fiori-input w-36" value={month} onChange={e => setMonth(e.target.value)} />
        <SelectBox className="w-40" value={type} onChange={e => setType(e.target.value)}><option value="">All types</option>{EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</SelectBox>
        <SelectBox className="w-40" value={department} onChange={e => setDepartment(e.target.value)}><option value="">All departments</option>{departments.map(d => <option key={d} value={d}>{d}</option>)}</SelectBox>
        <SelectBox className="w-32" value={payMethod} onChange={e => setPayMethod(e.target.value)}><option value="">All payment</option>{PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}</SelectBox>
        <SelectBox className="w-40" value={voucherStatus} onChange={e => setVoucherStatus(e.target.value)}>
          <option value="">All voucher status</option>
          {Object.entries(VOUCHER_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </SelectBox>
        <SelectBox className="w-40" value={submissionFilter} onChange={e => setSubmissionFilter(e.target.value)}>
          <option value="">All submission status</option>
          <option value="not_submitted">Not Submitted</option><option value="submitted">Submitted</option><option value="verified">Verified</option>
        </SelectBox>
        <input className="fiori-input w-24" type="number" placeholder="Min BDT" value={minAmt} onChange={e => setMinAmt(e.target.value)} />
        <input className="fiori-input w-24" type="number" placeholder="Max BDT" value={maxAmt} onChange={e => setMaxAmt(e.target.value)} />
        <ReportToolbar count={rows.length} onCSV={() => downloadCSV('Voucher Register', exportCols, exportRows)} onPDF={() => downloadReportPDF('Voucher Register', `${rows.length} vouchers`, exportCols, exportRows)} />
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DataTable fill columns={columns} rows={rows} loading={loading} rowKey={(r: any) => r.id} onRowClick={openView} emptyTitle="No vouchers yet" />
      </Card>

      {editModal && (
        <ExpenseForm record={editModal} clientId={currentClientId!} items={items} categories={categories} recentPayees={[]}
          onMastersChanged={refreshItems} notify={notify} onClose={() => setEditModal(null)} onDone={() => { setEditModal(null); refresh() }} />
      )}
      {viewing && <ExpenseOverview p={viewing} canEdit={canEdit && !viewing.submission_id} onEdit={() => { const r = viewing; setViewing(null); openEdit(r) }} onPrint={() => printBill(viewing)} onClose={() => setViewing(null)} />}

      {markLost && (
        <Modal open onClose={() => setMarkLost(null)} title="Mark Voucher Lost">
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">This is just a record note — there's no re-issue process, it simply flags this voucher as lost.</p>
            <Field label="Note"><Textarea value={markLost.note} onChange={e => setMarkLost((x: any) => ({ ...x, note: e.target.value }))} placeholder="Optional" /></Field>
            <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
              <Button variant="ghost" onClick={() => setMarkLost(null)}>Cancel</Button>
              <Button onClick={doMarkLost}>Mark Lost</Button>
            </div>
          </div>
        </Modal>
      )}

      {unlocking && (
        <Modal open onClose={() => setUnlocking(null)} title="Unlock Voucher">
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">For a voucher HO returned. This clears the lock and puts it back to Ready for Submission so it can go into the next batch.</p>
            <Field label="Reason"><Input value={unlocking.note} onChange={e => setUnlocking((x: any) => ({ ...x, note: e.target.value }))} placeholder="e.g. Returned by HO — missing signature" /></Field>
            <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
              <Button variant="ghost" onClick={() => setUnlocking(null)}>Cancel</Button>
              <Button icon="lock_open" onClick={doUnlock}>Unlock</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

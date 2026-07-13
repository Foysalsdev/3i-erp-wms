import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { useCollection } from '@/hooks/useCollection'
import { nextFinanceDocNumber } from '@/hooks/useDocNumber'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { Field, Textarea } from '@/components/ui/Field'
import { formatNumber, formatDate } from '@/lib/utils'
import type { CoverSheetGroup } from '@/pdf/FinancePDF'
import type { Expense, HoSubmission as Submission } from './financeCash'
import type { TablesInsert } from '@/types/database.types'
import { SectionHeader, StatCard } from './components/FinanceUI'

const today = () => new Date().toISOString().slice(0, 10)

// Finance → HO Submission: month-end, batch "Ready for Submission" vouchers
// (voucher_status='collected', not yet in any submission) into one
// submission with an auto-generated HOS- number, lock them, and print the
// Cover Sheet — category-grouped, with a single Sl. No sequence that runs
// continuously across the whole batch (never resets per category).
export function HOSubmission() {
  const { data: rawExpenses, refresh: refreshExpenses } = useCollection('finance_expenses', { order: 'expense_date' })
  const { data: submissions, refresh: refreshSubs } = useCollection('finance_ho_submissions', { order: 'created_at', ascending: false })
  const { currentClientId, can } = useAuth()
  const notify = useUI(s => s.notify)
  const canCreate = can('finance.create')
  const [creating, setCreating] = useState(false)
  const [reprinting, setReprinting] = useState<string | null>(null)
  const [verifying, setVerifying] = useState<Submission | null>(null)

  const eligible = useMemo(() => rawExpenses.filter(e => !e.deleted_at && !e.is_draft && e.voucher_status === 'collected' && !e.submission_id), [rawExpenses])

  const markVerified = async (s: Submission) => {
    const { error } = await supabase.from('finance_ho_submissions').update({ status: 'verified', verified_at: new Date().toISOString() }).eq('id', s.id)
    if (error) { notify('error', error.message); return }
    notify('success', `${s.submission_no} marked Verified`); setVerifying(null); refreshSubs()
  }

  const reprint = async (s: Submission) => {
    setReprinting(s.id)
    try {
      const { data: sv, error } = await supabase.from('finance_ho_submission_vouchers').select('*').eq('submission_id', s.id).order('sl_no')
      if (error) throw error
      const expById = new Map(rawExpenses.map(e => [e.id, e]))
      const groups: CoverSheetGroup[] = []
      const byCat = new Map<string, CoverSheetGroup>()
      for (const row of sv ?? []) {
        let g = byCat.get(row.category_label)
        if (!g) { g = { category: row.category_label, rows: [] }; byCat.set(row.category_label, g); groups.push(g) }
        const exp = expById.get(row.expense_id)
        g.rows.push({ slNo: row.sl_no, expenseId: exp?.doc_no || row.expense_id.slice(0, 8).toUpperCase(), vendorPayee: exp?.payee_name || '', amount: Number(exp?.amount) || 0, date: exp ? formatDate(exp.expense_date) : '' })
      }
      const { downloadCoverSheetPDF } = await import('@/pdf/FinancePDF')  // lazy: pdf chunk loads on demand
      await downloadCoverSheetPDF({ submissionNo: s.submission_no, submissionDate: formatDate(s.submission_date), voucherCount: s.voucher_count, totalAmount: Number(s.total_amount) || 0, groups })
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not rebuild the Cover Sheet')
    } finally {
      setReprinting(null)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard icon="fact_check" tone="brand" label="Ready for Submission" value={formatNumber(eligible.length)} />
        <StatCard icon="inventory" label="Submissions (all time)" value={formatNumber(submissions.length)} />
        <StatCard icon="task_alt" tone="ok" label="Verified" value={formatNumber(submissions.filter(s => s.status === 'verified').length)} />
      </div>

      <div className="flex justify-end">
        {canCreate && <Button icon="playlist_add_check" disabled={!eligible.length} onClick={() => setCreating(true)}>Create Submission</Button>}
      </div>

      <Card className="p-4">
        <SectionHeader icon="inventory" title="Past Submissions" />
        <div className="overflow-x-auto">
          <div className="min-w-[680px] overflow-hidden rounded-xl border border-surface-line">
            <div className="grid grid-cols-[1fr_120px_100px_130px_110px_140px] gap-2 border-b border-surface-line bg-surface-sunken px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              <span>Submission No</span><span>Date</span><span className="text-right">Vouchers</span><span className="text-right">Total (BDT)</span><span>Status</span><span className="text-right">Action</span>
            </div>
            {submissions.length === 0 ? <p className="p-4 text-sm text-ink-faint">No submissions yet.</p> :
              submissions.map((s, i) => (
                <div key={s.id} className={'grid grid-cols-[1fr_120px_100px_130px_110px_140px] items-center gap-2 px-3 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                  <span className="font-medium text-ink">{s.submission_no}</span>
                  <span className="text-ink-soft">{formatDate(s.submission_date)}</span>
                  <span className="text-right tabular-nums text-ink-soft">{s.voucher_count}</span>
                  <span className="text-right tabular-nums font-semibold text-ink">{formatNumber(s.total_amount, 2)}</span>
                  <span><Badge tone={s.status === 'verified' ? 'positive' : 'brand'}>{s.status === 'verified' ? 'Verified' : 'Submitted'}</Badge></span>
                  <span className="flex justify-end gap-1">
                    <button title="Reprint Cover Sheet" className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-sunken hover:text-ink disabled:opacity-40" disabled={reprinting === s.id} onClick={() => reprint(s)}><Icon name="print" className="text-[18px]" /></button>
                    {s.status !== 'verified' && can('finance.edit') && <button title="Mark Verified" className="rounded-lg p-1.5 text-ink-faint hover:bg-ok/10 hover:text-ok" onClick={() => setVerifying(s)}><Icon name="task_alt" className="text-[18px]" /></button>}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </Card>

      {creating && (
        <CreateSubmissionModal clientId={currentClientId!} eligible={eligible} notify={notify}
          onClose={() => setCreating(false)} onDone={() => { setCreating(false); refreshExpenses(); refreshSubs() }} />
      )}

      {verifying && (
        <Modal open onClose={() => setVerifying(null)} title="Mark Submission Verified">
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">Mark <b>{verifying.submission_no}</b> as Verified once Head Office confirms it received the batch — this is for your own record only.</p>
            <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
              <Button variant="ghost" onClick={() => setVerifying(null)}>Cancel</Button>
              <Button icon="task_alt" onClick={() => markVerified(verifying)}>Mark Verified</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function CreateSubmissionModal({ clientId, eligible, notify, onClose, onDone }: {
  clientId: string; eligible: Expense[]; notify: (kind: 'success' | 'error', msg: string) => void
  onClose: () => void; onDone: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [remarks, setRemarks] = useState('')
  const [saving, setSaving] = useState(false)
  const toggle = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSelected(s => s.size === eligible.length ? new Set() : new Set(eligible.map(e => e.id)))

  const selectedRows = eligible.filter(e => selected.has(e.id))
  const [order, setOrder] = useState<string[] | null>(null)
  const categoryOrder = useMemo(() => {
    if (order) return order.filter(c => selectedRows.some(r => r.expense_type === c))
    const seen: string[] = []
    // eligible rows are always finalized, so expense_type is set
    for (const r of selectedRows) if (!seen.includes(r.expense_type!)) seen.push(r.expense_type!)
    return seen
  }, [order, selectedRows])
  const moveCategory = (cat: string, dir: -1 | 1) => {
    const cur = categoryOrder
    const i = cur.indexOf(cat), j = i + dir
    if (j < 0 || j >= cur.length) return
    const next = [...cur]; [next[i], next[j]] = [next[j], next[i]]
    setOrder(next)
  }
  const totalAmount = selectedRows.reduce((s, r) => s + (Number(r.amount) || 0), 0)

  const create = async () => {
    if (!selectedRows.length) { notify('error', 'Select at least one voucher'); return }
    setSaving(true)
    try {
      const submission_no = await nextFinanceDocNumber(clientId, 'HOS')
      if (!submission_no) throw new Error('Could not generate the HO Submission number')
      const { data: sub, error } = await supabase.from('finance_ho_submissions').insert({
         submission_no, submission_date: today(), voucher_count: selectedRows.length,
        total_amount: totalAmount, remarks: remarks || null, category_order: categoryOrder, status: 'submitted'
      }).select('*').single()
      if (error) throw error

      const groups = categoryOrder.map(cat => ({ category: cat, rows: selectedRows.filter(r => r.expense_type === cat).sort((a, b) => (a.expense_date < b.expense_date ? -1 : a.expense_date > b.expense_date ? 1 : 0)) }))
      let slNo = 0
      const svPayload: TablesInsert<'finance_ho_submission_vouchers'>[] = []
      const pdfGroups = groups.map(g => ({
        category: g.category,
        rows: g.rows.map(r => {
          slNo++
          svPayload.push({  submission_id: sub.id, expense_id: r.id, sl_no: slNo, category_label: g.category })
          return { slNo, expenseId: r.doc_no || r.id.slice(0, 8).toUpperCase(), vendorPayee: r.payee_name || '', amount: Number(r.amount) || 0, date: formatDate(r.expense_date) }
        })
      }))
      const { error: svErr } = await supabase.from('finance_ho_submission_vouchers').insert(svPayload)
      if (svErr) throw svErr

      const { error: lockErr } = await supabase.from('finance_expenses')
        .update({ submission_id: sub.id, voucher_status: 'submitted' })
        .in('id', selectedRows.map(r => r.id))
      if (lockErr) throw lockErr

      const { downloadCoverSheetPDF } = await import('@/pdf/FinancePDF')  // lazy: pdf chunk loads on demand
      await downloadCoverSheetPDF({ submissionNo: submission_no, submissionDate: formatDate(today()), voucherCount: selectedRows.length, totalAmount, groups: pdfGroups })
      notify('success', `${submission_no} created — ${selectedRows.length} vouchers locked`)
      onDone()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not create the submission')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Create HO Submission" size="xl">
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">Select the vouchers ready to go to Head Office. Their Sl. No on the Cover Sheet will run continuously across categories in the order below.</p>
        <div className="overflow-hidden rounded-xl border border-surface-line">
          <div className="grid grid-cols-[32px_1fr_120px_120px_110px] gap-2 border-b border-surface-line bg-surface-sunken px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
            <input type="checkbox" checked={selected.size === eligible.length && eligible.length > 0} onChange={toggleAll} />
            <span>Vendor / Payee</span><span>Expense Type</span><span>Expense ID</span><span className="text-right">Amount</span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {eligible.length === 0 ? <p className="p-4 text-sm text-ink-faint">Nothing ready for submission.</p> :
              eligible.map((r, i) => (
                <label key={r.id} className={'grid cursor-pointer grid-cols-[32px_1fr_120px_120px_110px] items-center gap-2 px-3 py-2 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                  <span className="min-w-0 truncate text-ink">{r.payee_name || '—'}</span>
                  <span className="text-ink-soft">{r.expense_type}</span>
                  <span className="text-ink-soft">{r.doc_no || '—'}</span>
                  <span className="text-right tabular-nums font-medium text-ink">{formatNumber(r.amount, 2)}</span>
                </label>
              ))}
          </div>
        </div>

        {categoryOrder.length > 1 && (
          <div>
            <SectionHeader icon="format_list_numbered" title="Category order on the Cover Sheet" />
            <div className="overflow-hidden rounded-xl border border-surface-line">
              {categoryOrder.map((cat, i) => (
                <div key={cat} className={'flex items-center justify-between gap-3 px-3.5 py-2 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                  <span className="text-ink">{i + 1}. {cat}</span>
                  <span className="flex gap-1">
                    <button type="button" disabled={i === 0} className="rounded p-1 text-ink-faint hover:bg-surface-sunken disabled:opacity-30" onClick={() => moveCategory(cat, -1)}><Icon name="arrow_upward" className="text-[16px]" /></button>
                    <button type="button" disabled={i === categoryOrder.length - 1} className="rounded p-1 text-ink-faint hover:bg-surface-sunken disabled:opacity-30" onClick={() => moveCategory(cat, 1)}><Icon name="arrow_downward" className="text-[16px]" /></button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Field label="Remarks"><Textarea value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional" /></Field>

        <div className="flex items-center justify-between rounded-xl bg-surface-sunken px-4 py-3 text-sm">
          <span className="text-ink-soft">{selectedRows.length} voucher(s) selected</span>
          <span className="font-bold tabular-nums text-brand-700 dark:text-brand-300">{formatNumber(totalAmount, 2)} BDT</span>
        </div>

        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button icon="playlist_add_check" loading={saving} disabled={!selectedRows.length} onClick={create}>Create & Print Cover Sheet</Button>
        </div>
      </div>
    </Modal>
  )
}

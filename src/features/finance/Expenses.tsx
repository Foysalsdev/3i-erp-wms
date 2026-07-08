import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { useCollection } from '@/hooks/useCollection'
import { nextDocNumber } from '@/hooks/useDocNumber'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ActionMenu } from '@/components/ui/ActionMenu'
import { ConfirmDelete } from '@/components/ui/ConfirmDelete'
import { SearchBar } from '@/components/shared/SearchBar'
import { Field, Input, Select } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Combobox } from '@/components/shared/Combobox'
import { Link } from 'react-router-dom'
import { formatNumber, formatDate } from '@/lib/utils'
import { downloadBillVoucherPDF } from '@/pdf/FinancePDF'
import { useAutoOpen } from '@/hooks/useAutoOpen'
import { useRememberedField } from '@/hooks/useRememberedField'
import { SectionHeader, StatCard, FinancePanel } from './components/FinanceUI'

const today = () => new Date().toISOString().slice(0, 10)
const DEFAULT_SIGN_LABELS = 'Prepared By, Verified By, Approved By, Head Office'
const HANDOVER_SIGN_LABELS = 'Handed Over By, Received By'
const PAYMENT_MODES = ['Cash', 'Bank', 'bKash', 'Nagad', 'Card', 'Other']
const blankBill = () => ({ bill_ref: '', unit: '', qty: undefined as number | undefined, rate: undefined as number | undefined, remarks: '', amount: undefined as number | undefined })
const signLabelList = (s: string) => (s || DEFAULT_SIGN_LABELS).split(',').map(x => x.trim()).filter(Boolean)

export function Expenses() {
  const { data, loading, refresh } = useCollection('finance_expenses', { order: 'expense_date' })
  const { data: categories } = useCollection('finance_expense_categories', { order: 'name', ascending: true })
  const { currentClientId, can, isPlatformAdmin } = useAuth()
  const notify = useUI(s => s.notify)
  // Split by DB operation: RLS requires finance.create for new expenses and
  // finance.edit for updates — a role with only one shouldn't be shown the
  // action that will fail.
  const canCreate = can('finance.create')
  const canEdit = can('finance.edit')
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  useAutoOpen(() => { setEditing(null); setModal(true) })
  const [viewing, setViewing] = useState<any>(null)
  const [deleting, setDeleting] = useState<any>(null)

  // Vouchers pick from the active Expense Head master (managed in Finance →
  // Setup) — not created inline. The code shows as the mono chip, the name as
  // the description.
  const catItems = (categories as any[]).filter(c => c.is_active !== false)
    .map(c => ({ id: c.id, label: c.code || c.name, sublabel: c.code ? c.name : undefined }))
  const catName = (id: string) => (categories as any[]).find(c => c.id === id)?.name ?? '—'

  const fetchBills = async (expenseId: string) => {
    const { data: bills } = await supabase.from('finance_expense_bills').select('*').eq('expense_id', expenseId).order('created_at')
    return bills ?? []
  }

  const openView = async (r: any) => setViewing({ ...r, __bills: await fetchBills(r.id) })
  const openEdit = async (r: any) => { const bills = await fetchBills(r.id); setEditing({ ...r, __bills: bills }); setModal(true) }

  // The category name doubles as the printed bill/voucher's title (Dinner
  // Bill, Labour Bill, Accommodation Rent, ...) — no separate "bill type"
  // field, since that's exactly what category already means here.
  const printBill = async (r: any) => {
    try {
      const bills = await fetchBills(r.id)
      // A quick single-amount expense has no breakdown lines — synthesise one
      // row from the expense itself so the voucher still has a body.
      const lines = bills.length
        ? bills.map((b: any) => ({
            particulars: b.bill_ref || '—', unit: b.unit || undefined,
            qty: b.qty != null ? Number(b.qty) : undefined, rate: b.rate != null ? Number(b.rate) : undefined,
            remarks: b.remarks || undefined, amount: Number(b.amount) || 0
          }))
        : [{ particulars: r.description || catName(r.category_id) || 'Expense', amount: Number(r.amount) || 0 }]
      await downloadBillVoucherPDF({
        title: catName(r.category_id) === '—' ? 'Expense Voucher' : catName(r.category_id),
        billRef: r.bill_ref || r.id.slice(0, 8).toUpperCase(),
        date: formatDate(r.expense_date),
        payee: r.payee_name || undefined,
        purpose: r.description || undefined,
        lines,
        lessDeduction: Number(r.less_deduction) || 0,
        signLabels: signLabelList(r.sign_labels),
        showLineSignature: !!r.show_line_signature
      })
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not generate the bill/voucher PDF')
    }
  }

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    const list = !t ? (data as any[]) : (data as any[]).filter(r =>
      String(r.payee_name ?? '').toLowerCase().includes(t) || String(r.description ?? '').toLowerCase().includes(t) || catName(r.category_id).toLowerCase().includes(t))
    return list
  }, [data, q, categories])

  const columns = [
    { key: 'expense_date', header: 'Date', render: (r: any) => formatDate(r.expense_date), sortable: true },
    { key: 'category', header: 'Expense Head', render: (r: any) => catName(r.category_id) },
    { key: 'payee_name', header: 'Paid To', render: (r: any) => r.payee_name || '—' },
    { key: 'payment_mode', header: 'Mode', render: (r: any) => r.payment_mode || '—' },
    { key: 'description', header: 'Description', render: (r: any) => <span className="truncate">{r.description || '—'}</span> },
    { key: 'amount', header: 'Amount', accessor: (r: any) => formatNumber(r.amount, 2), className: 'text-right' },
    {
      key: '__a', header: '', className: 'w-px whitespace-nowrap',
      render: (r: any) => (
        <div className="flex justify-end" onClick={e => e.stopPropagation()}>
          <ActionMenu items={[
            { icon: 'visibility', label: 'View', onClick: () => openView(r) },
            { icon: 'receipt_long', label: 'Generate Bill / Voucher', onClick: () => printBill(r) },
            ...(canEdit ? [{ icon: 'edit', label: 'Edit', onClick: () => openEdit(r) }] : []),
            ...(isPlatformAdmin ? [{ icon: 'delete', label: 'Delete', tone: '!text-bad hover:!text-bad hover:!bg-bad/10', onClick: () => setDeleting(r) }] : [])
          ]} />
        </div>
      )
    }
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-72"><SearchBar value={q} onChange={setQ} placeholder="Search payee, description, category…" /></div>
        <span className="text-sm text-ink-soft">{rows.length} records</span>
        {canCreate && <Button className="ml-auto" icon="add" onClick={() => { setEditing(null); setModal(true) }}>New Expense</Button>}
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DataTable fill columns={columns} rows={rows} loading={loading} rowKey={(r: any) => r.id}
          onRowClick={canEdit ? openEdit : openView} emptyTitle="No expenses recorded yet" />
      </Card>

      {modal && (
        <ExpenseForm record={editing} clientId={currentClientId!} catItems={catItems} heads={categories} notify={notify}
          onClose={() => setModal(false)} onDone={() => { setModal(false); refresh() }} />
      )}

      {viewing && (
        <ExpenseOverview exp={viewing} catName={catName(viewing.category_id)} canEdit={canEdit}
          onEdit={() => { const r = viewing; setViewing(null); openEdit(r) }}
          onPrintBill={() => printBill(viewing)} onClose={() => setViewing(null)} />
      )}

      <ConfirmDelete open={!!deleting} onClose={() => setDeleting(null)}
        name={deleting ? `Expense · ${formatDate(deleting.expense_date)} · ${formatNumber(deleting.amount, 2)}` : undefined}
        onConfirm={async () => {
          const res = await supabase.from('finance_expenses').delete().eq('id', deleting.id)
          if (!res.error) { setDeleting(null); refresh() }
          return res
        }} />
    </div>
  )
}

function ExpenseForm({ record, clientId, catItems, heads, notify, onClose, onDone }: any) {
  const [rememberedSignLabels, rememberSignLabels] = useRememberedField('sign_labels', DEFAULT_SIGN_LABELS)
  const [h, setH] = useState<any>(record ?? { expense_date: today(), sign_labels: rememberedSignLabels, less_deduction: 0, payment_mode: 'Cash', amount: '' })
  // Line items are OPTIONAL — a small cash purchase is just a single amount, a
  // larger one an itemised breakdown. So start with none.
  const [bills, setBills] = useState<any[]>(record?.__bills ?? [])
  const [showVoucher, setShowVoucher] = useState(!!record?.bill_ref)
  const [saving, setSaving] = useState(false)
  // The form auto-adapts to the picked Expense Head's configured behaviour
  // (Finance → Setup): mode = single | itemised | handover, plus owner-copy.
  // Every applied value stays user-overridable below.
  const initHead = record?.category_id ? (heads as any[])?.find((x: any) => x.id === record.category_id) : null
  const [mode, setMode] = useState<string>(initHead?.voucher_mode || 'single')
  const [ownerCopy, setOwnerCopy] = useState<boolean>(!!initHead?.owner_copy_required)
  const set = (patch: any) => setH((x: any) => ({ ...x, ...patch }))

  // On head select, apply that head's configured behaviour.
  const applyHead = (id: string) => {
    const head = (heads as any[])?.find((x: any) => x.id === id)
    const m = head?.voucher_mode || 'single'
    setMode(m)
    setOwnerCopy(!!head?.owner_copy_required)
    const patch: any = { category_id: id }
    if (head?.default_sign_labels) patch.sign_labels = head.default_sign_labels
    else if (m === 'handover') patch.sign_labels = HANDOVER_SIGN_LABELS
    if (head?.default_line_signature) patch.show_line_signature = true
    set(patch)
    if (m === 'itemised') setBills(bs => bs.length ? bs : [blankBill()])
    if (m === 'handover' || head?.default_line_signature) setShowVoucher(true)
  }
  const setBill = (i: number, patch: any) => setBills(bs => bs.map((b, idx) => {
    if (idx !== i) return b
    const next = { ...b, ...patch }
    // Qty × Rate auto-fills Amount (matches how these bills are actually
    // priced — dinner @ rate/head, labour @ rate/unit) — still overridable.
    if (('qty' in patch || 'rate' in patch) && Number(next.qty) > 0 && Number(next.rate) > 0) next.amount = Number(next.qty) * Number(next.rate)
    return next
  }))

  // When a breakdown is present the amount is its sum; otherwise it's typed
  // directly on the header (the quick single-amount purchase).
  const lineTotal = bills.reduce((s, b) => s + (Number(b.amount) || 0), 0)
  const hasLines = bills.length > 0
  // Breakdown grid is shown for itemised heads (or when the record already has
  // lines); single/handover heads keep the clean single-amount form.
  const showBreakdown = mode === 'itemised' || hasLines
  const total = hasLines ? lineTotal : (Number(h.amount) || 0)
  const net = total - (Number(h.less_deduction) || 0)

  const save = async () => {
    if (!(total > 0)) { notify('error', 'Enter the expense amount (or add a breakdown line with an amount)'); return }
    if (h.sign_labels) rememberSignLabels(h.sign_labels)
    setSaving(true)
    try {
      const header = {
        client_id: clientId, expense_date: h.expense_date || today(), category_id: h.category_id || null,
        payee_name: h.payee_name || null, description: h.description || null, amount: total,
        payment_mode: h.payment_mode || null, vendor_bill_no: h.vendor_bill_no || null,
        bill_ref: h.bill_ref || null, less_deduction: Number(h.less_deduction) || 0,
        sign_labels: h.sign_labels || null, show_line_signature: !!h.show_line_signature
      }
      let expId = record?.id
      if (record) {
        const { error } = await supabase.from('finance_expenses').update(header).eq('id', record.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('finance_expenses').insert(header).select('id').single()
        if (error) throw error
        expId = data.id
      }
      await supabase.from('finance_expense_bills').delete().eq('expense_id', expId)
      const payload = bills.filter(b => Number(b.amount) > 0).map(b => ({
        client_id: clientId, expense_id: expId, bill_ref: b.bill_ref || null, amount: Number(b.amount) || 0,
        unit: b.unit || null, qty: b.qty ? Number(b.qty) : null, rate: b.rate ? Number(b.rate) : null, remarks: b.remarks || null
      }))
      if (payload.length) {
        const { error: billErr } = await supabase.from('finance_expense_bills').insert(payload)
        if (billErr) throw billErr
      }
      notify('success', `Expense ${record ? 'updated' : 'recorded'}`)
      onDone()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not save expense')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`${record ? 'Edit' : 'New'} Expense`} size="xl">
      <div className="space-y-4">
        <FinancePanel icon="receipt_long" title="Expense Details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Date" required><Input type="date" value={h.expense_date ?? ''} onChange={e => set({ expense_date: e.target.value })} /></Field>
            <Field label="Expense Head" required>
              {catItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-surface-line px-3 py-2 text-xs text-ink-faint">
                  No expense heads yet. Add them in <Link to="/finance/setup" className="font-medium text-brand-600 hover:underline">Finance → Setup</Link>.
                </div>
              ) : (
                <Combobox items={catItems} value={h.category_id ?? ''} onChange={applyHead}
                  placeholder="Pick an expense head…" />
              )}
            </Field>
            <Field label="Paid To"><Input value={h.payee_name ?? ''} onChange={e => set({ payee_name: e.target.value })} placeholder="Shop / vendor / person paid" /></Field>
            <Field label="Payment Mode">
              <Select value={h.payment_mode ?? 'Cash'} onChange={e => set({ payment_mode: e.target.value })}>
                {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </Select>
            </Field>
            <Field label="Amount (BDT)" required>
              <Input type="number" value={hasLines ? total : (h.amount ?? '')} onChange={e => set({ amount: e.target.value })}
                disabled={hasLines} placeholder="Total amount paid" />
            </Field>
            {mode !== 'handover' && <Field label="Vendor Bill No"><Input value={h.vendor_bill_no ?? ''} onChange={e => set({ vendor_bill_no: e.target.value })} placeholder="Shop's own bill no — leave blank if none" /></Field>}
            <Field label="Description / Note" className="sm:col-span-2"><Input value={h.description ?? ''} onChange={e => set({ description: e.target.value })} placeholder="What was this purchase for" /></Field>
          </div>
          {hasLines && <p className="mt-2 text-xs text-ink-faint">Amount is the sum of the itemised breakdown below.</p>}
          {mode === 'handover' && <p className="mt-2 text-xs text-ink-soft">Handover head — record who handed over and who received on the voucher signatures below (no vendor bill).</p>}
          {ownerCopy && <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"><Icon name="info" className="text-[15px]" /> Owner copy required — keep a signed copy for the accommodation owner / recipient.</p>}
        </FinancePanel>

        {showBreakdown && <div>
          <SectionHeader icon="view_list" title="Itemised breakdown"
            action={<Button size="sm" variant="secondary" icon="add" onClick={() => setBills(bs => [...bs, blankBill()])}>Add Line</Button>} />
          {!hasLines ? (
            <p className="rounded-xl border border-dashed border-surface-line px-3 py-3 text-sm text-ink-faint">
              No breakdown yet — add lines for a detailed purchase (e.g. many items, or labour per unit), or just type the single amount above.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-surface-line">
              <div className="grid grid-cols-[1fr_80px_70px_80px_1fr_110px_32px] gap-2 border-b border-surface-line bg-surface-sunken px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                <span>Particulars *</span><span>Unit</span><span>Qty</span><span>Rate</span><span>Remarks</span><span className="text-right">Amount (BDT) *</span><span />
              </div>
              {bills.map((b, i) => (
                <div key={i} className="grid grid-cols-[1fr_80px_70px_80px_1fr_110px_32px] items-center gap-2 border-b border-surface-line px-2 py-1.5 last:border-b-0 odd:bg-surface even:bg-surface-sunken/25">
                  <input className="fiori-input" value={b.bill_ref ?? ''} onChange={e => setBill(i, { bill_ref: e.target.value })} placeholder="e.g. Dinner for all staff" />
                  <input className="fiori-input" value={b.unit ?? ''} onChange={e => setBill(i, { unit: e.target.value })} placeholder="Person" />
                  <input className="fiori-input" type="number" value={b.qty ?? ''} onChange={e => setBill(i, { qty: e.target.value === '' ? undefined : Number(e.target.value) })} />
                  <input className="fiori-input" type="number" value={b.rate ?? ''} onChange={e => setBill(i, { rate: e.target.value === '' ? undefined : Number(e.target.value) })} />
                  <input className="fiori-input" value={b.remarks ?? ''} onChange={e => setBill(i, { remarks: e.target.value })} />
                  <input className="fiori-input text-right" type="number" value={b.amount ?? ''} onChange={e => setBill(i, { amount: e.target.value === '' ? undefined : (Number(e.target.value) || 0) })} placeholder="0.00" />
                  <button type="button" className="flex items-center justify-center text-ink-faint hover:text-bad" onClick={() => setBills(bs => bs.filter((_, idx) => idx !== i))}>
                    <Icon name="close" className="text-[18px]" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 flex justify-end gap-2 text-sm">
            <span className="rounded-lg bg-surface-sunken px-3 py-1.5"><span className="text-ink-faint">Total:&nbsp;</span><span className="font-semibold text-ink">{formatNumber(total, 2)}</span></span>
            <span className="rounded-lg bg-brand-50 px-3 py-1.5 dark:bg-brand-500/15"><span className="text-ink-soft">Net (after deduction):&nbsp;</span><span className="font-bold text-brand-700 dark:text-brand-300">{formatNumber(net, 2)} BDT</span></span>
          </div>
        </div>}

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-ink-soft">
            <input type="checkbox" checked={showVoucher} onChange={e => {
              const on = e.target.checked; setShowVoucher(on)
              if (on && !h.bill_ref) nextDocNumber(clientId, 'BILL').then(no => { if (no) set({ bill_ref: no }) })
            }} />
            Generate a self-voucher / receipt for this expense (signature slip — for cash payments with no vendor bill, or when a signed voucher is still needed)
          </label>
          {showVoucher && (
            <FinancePanel icon="edit_note" tone="warn" title="Voucher / Receipt print details">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Voucher Reference No"><Input value={h.bill_ref ?? ''} onChange={e => set({ bill_ref: e.target.value })} placeholder="Auto-generated — editable" /></Field>
                <Field label="Less: Advance / Deduction (BDT)"><Input type="number" value={h.less_deduction ?? 0} onChange={e => set({ less_deduction: Number(e.target.value) || 0 })} /></Field>
                <Field label="Signature Labels (comma separated)">
                  <Input value={h.sign_labels ?? ''} onChange={e => set({ sign_labels: e.target.value })} placeholder={DEFAULT_SIGN_LABELS} />
                </Field>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
                <input type="checkbox" checked={!!h.show_line_signature} onChange={e => set({ show_line_signature: e.target.checked })} />
                Add a blank signature column per line (for multiple workers to sign individually)
              </label>
            </FinancePanel>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button icon="save" loading={saving} onClick={save}>{record ? 'Update' : 'Save'}</Button>
        </div>
      </div>
    </Modal>
  )
}

function ExpenseOverview({ exp, catName, canEdit, onEdit, onPrintBill, onClose }: any) {
  const bills: any[] = exp.__bills ?? []
  return (
    <Modal open onClose={onClose} title="Expense Detail" size="lg">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard icon="calendar_month" label="Date" value={formatDate(exp.expense_date)} />
          <StatCard icon="sell" label="Expense Head" value={catName} />
          <StatCard icon="person" label="Paid To" value={exp.payee_name || '—'} />
          <StatCard icon="account_balance" label="Payment Mode" value={exp.payment_mode || '—'} />
          <StatCard icon="receipt" label="Vendor Bill No" value={exp.vendor_bill_no || '—'} />
          <StatCard icon="payments" tone="bad" label="Amount" value={`${formatNumber(exp.amount, 2)} BDT`} />
        </div>
        {exp.description && <div><SectionHeader icon="notes" title="Description / Note" /><p className="-mt-1 text-sm text-ink-soft">{exp.description}</p></div>}
        {bills.length > 0 && <div>
          <SectionHeader icon="view_list" title="Itemised breakdown" />
          <div className="overflow-hidden rounded-xl border border-surface-line">
            {bills.map((b, i) => (
              <div key={b.id ?? i} className={'flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                <span className="text-ink">{b.bill_ref || '—'}{b.qty || b.rate ? <span className="text-ink-faint"> · {b.qty ?? ''} {b.unit ?? ''} × {b.rate ?? ''}</span> : null}</span>
                <span className="font-semibold text-ink">{formatNumber(b.amount, 2)}</span>
              </div>
            ))}
          </div>
        </div>}
        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="secondary" icon="receipt_long" onClick={onPrintBill}>Generate Voucher / Receipt</Button>
          {canEdit && <Button icon="edit" onClick={onEdit}>Edit</Button>}
        </div>
      </div>
    </Modal>
  )
}

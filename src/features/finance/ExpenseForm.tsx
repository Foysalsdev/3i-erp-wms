import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useCollection } from '@/hooks/useCollection'
import { nextFinanceDocNumber } from '@/hooks/useDocNumber'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { CreatableCombobox } from '@/components/shared/CreatableCombobox'
import { cn, formatNumber } from '@/lib/utils'
import { FinancePanel, SectionHeader } from './components/FinanceUI'

const today = () => new Date().toISOString().slice(0, 10)

export const EXPENSE_TYPES = [
  'Procurement', 'Labour', 'Maintenance', 'Rent', 'Fuel', 'Utility Bill',
  'Refreshment', 'Transport Expense', 'Service Charge', 'Others'
] as const
export const PAYMENT_METHODS = ['Cash', 'Bank', 'Credit', 'bKash', 'Nagad', 'Card']
export const DEPARTMENTS = ['Warehouse', 'Transport', 'Office Administration', 'HR', 'IT', 'Security', 'Generator', 'Forklift', 'Others']
export const DOC_TYPES: { value: string; label: string }[] = [
  { value: 'vendor_voucher', label: 'Vendor Voucher / Cash Memo' },
  { value: 'internal_voucher', label: 'Internal Voucher' },
  { value: 'no_document', label: 'No Document' }
]
// Labour has no external document to attach; every other type defaults to
// whatever the shop hands over. Neither is a hard rule — always editable.
const DEFAULT_DOC_TYPE = (t: string) => (t === 'Labour' ? 'internal_voucher' : 'vendor_voucher')
const ADDL_TYPES = ['Transport', 'Loading', 'Unloading', 'Delivery Charge', 'Others']

// Type-specific extra fields, kept in the `details` jsonb bag instead of a
// dozen sparse columns — every Expense Type except Procurement (which keeps
// its own item-grid below) is just one of these small field sets.
type DetailField = { key: string; label: string; type: 'text' | 'number' | 'month'; placeholder?: string }
const TYPE_FIELDS: Record<string, DetailField[]> = {
  Labour: [
    { key: 'labour_type', label: 'Labour Type', type: 'text', placeholder: 'e.g. Loading, Cleaning' },
    { key: 'worker_count', label: 'Number of Workers', type: 'number' },
    { key: 'rate_per_worker', label: 'Rate per Worker', type: 'number' },
    { key: 'work_description', label: 'Work / Purpose Description', type: 'text' },
    { key: 'required_by', label: 'Required By', type: 'text', placeholder: 'Name' },
    { key: 'approved_by', label: 'Approved By', type: 'text', placeholder: 'Name' }
  ],
  Maintenance: [
    { key: 'asset', label: 'Asset', type: 'text' },
    { key: 'maintenance_category', label: 'Maintenance Category', type: 'text' },
    { key: 'description', label: 'Description', type: 'text' }
  ],
  Rent: [
    { key: 'property_name', label: 'Property Name', type: 'text' },
    { key: 'month', label: 'Month', type: 'month' },
    { key: 'owner_name', label: 'Owner Name', type: 'text' }
  ],
  Fuel: [
    { key: 'asset', label: 'Asset', type: 'text' },
    { key: 'fuel_type', label: 'Fuel Type', type: 'text' },
    { key: 'quantity', label: 'Quantity', type: 'number' },
    { key: 'unit_price', label: 'Unit Price', type: 'number' }
  ],
  'Utility Bill': [
    { key: 'utility_type', label: 'Utility Type', type: 'text' },
    { key: 'bill_month', label: 'Bill Month', type: 'month' },
    { key: 'bill_number', label: 'Bill Number', type: 'text' }
  ],
  Refreshment: [
    { key: 'description', label: 'Description', type: 'text' },
    { key: 'person_count', label: 'Number of Persons', type: 'number' }
  ],
  'Transport Expense': [
    { key: 'description', label: 'Description', type: 'text' },
    { key: 'person_count', label: 'Number of Persons', type: 'number' }
  ],
  'Service Charge': [{ key: 'description', label: 'Description', type: 'text' }],
  Others: [{ key: 'description', label: 'Description', type: 'text' }]
}
// Where quantity x rate should auto-calculate the amount, per type.
const AUTO_CALC: Record<string, { qty: string; rate: string }> = {
  Labour: { qty: 'worker_count', rate: 'rate_per_worker' },
  Fuel: { qty: 'quantity', rate: 'unit_price' }
}

const blankItem = () => ({ item_id: '', name: '', category_id: '', unit: '', qty: undefined as number | undefined, rate: undefined as number | undefined })
const blankAddl = () => ({ expense_type: '', amount: undefined as number | undefined })
const lineTotal = (r: any) => (Number(r.qty) || 0) * (Number(r.rate) || 0)
const numOrU = (v: string) => v === '' ? undefined : Number(v)

// Dynamic Expense entry covering all 10 Expense Types. Procurement keeps the
// existing fast item-grid entry; every other type is a small set of detail
// fields (see TYPE_FIELDS) plus the shared header (type, vendor/payee,
// payment, document, amount). No vendor master required anywhere — Vendor /
// Payee is a plain free-text field with a recent-names suggestion list only.
export function ExpenseForm({ record, clientId, items, categories, recentPayees, quick, onMastersChanged, notify, onClose, onDone }: any) {
  const [h, setH] = useState<any>(record ?? {
    expense_type: quick ? 'Refreshment' : 'Procurement', expense_date: today(), payment_mode: 'Cash',
    department: 'Warehouse', doc_type: DEFAULT_DOC_TYPE(quick ? 'Refreshment' : 'Procurement'), details: {}
  })
  const [rows, setRows] = useState<any[]>(record?.__items?.length ? record.__items : [blankItem()])
  const [addl, setAddl] = useState<any[]>(record?.__addl ?? [])
  const [docTypeTouched, setDocTypeTouched] = useState(!!record?.id)
  const [saving, setSaving] = useState(false)
  const set = (patch: any) => setH((x: any) => ({ ...x, ...patch }))
  const setDetail = (key: string, value: any) => setH((x: any) => ({ ...x, details: { ...(x.details ?? {}), [key]: value } }))

  const itemOptions = useMemo(() => (items as any[]).filter(i => i.is_active !== false)
    .map(i => ({ id: i.id, label: i.name, sublabel: i.unit || undefined })), [items])
  const catName = (id?: string) => (categories as any[]).find(c => c.id === id)?.name

  const setRow = (i: number, patch: any) => setRows(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  const pickItem = (i: number, id: string) => {
    const it = (items as any[]).find(x => x.id === id)
    if (!it) { setRow(i, { item_id: id }); return }
    setRow(i, { item_id: id, name: it.name, unit: it.unit || '', rate: it.last_price != null ? Number(it.last_price) : undefined, category_id: it.category_id || '' })
  }
  const createItem = async (name: string) => {
    const { data, error } = await supabase.from('finance_items').insert({ client_id: clientId, name }).select('id,name').single()
    if (error) { notify('error', error.message); return null }
    onMastersChanged?.()
    return { id: data.id, label: data.name }
  }
  const addFrequent = (it: any) => setRows(rs => {
    const base = rs.filter(r => r.name || r.item_id)
    return [...base, { item_id: it.id, name: it.name, unit: it.unit || '', rate: it.last_price != null ? Number(it.last_price) : undefined, category_id: it.category_id || '', qty: undefined }]
  })

  const isProcurement = h.expense_type === 'Procurement'
  const isCredit = h.payment_mode === 'Credit'
  const details = h.details ?? {}
  const fields = TYPE_FIELDS[h.expense_type] ?? []
  const autoCalc = AUTO_CALC[h.expense_type]
  const autoAmount = autoCalc ? (Number(details[autoCalc.qty]) || 0) * (Number(details[autoCalc.rate]) || 0) : undefined

  const validRows = rows.filter(r => (r.name || r.item_id) && Number(r.qty) > 0)
  const subtotal = rows.reduce((s, r) => s + lineTotal(r), 0)
  const addlTotal = addl.reduce((s, a) => s + (Number(a.amount) || 0), 0)
  const grand = isProcurement ? subtotal + addlTotal : (autoAmount ?? (Number(h.amount) || 0))

  // Budget monitoring — same soft-warning-only rule as before, now for every type.
  const { data: budgets } = useCollection('finance_budgets', {})
  const { data: allExpenses } = useCollection('finance_expenses', {})
  const period = (h.expense_date || today()).slice(0, 7)
  const [by, bm] = period.split('-').map(Number)
  const dept = h.department || 'Warehouse'
  const budgetRow = (budgets as any[]).find(b => b.year === by && b.month === bm && b.department === dept)
    || (budgets as any[]).find(b => b.year === by && b.month === bm && b.department === 'All')
  const monthSpentDept = budgetRow ? (allExpenses as any[]).filter(e =>
    (e.expense_date || '').slice(0, 7) === period && e.id !== record?.id && !e.deleted_at && !e.is_draft &&
    (budgetRow.department === 'All' || (e.department || 'Others') === dept)
  ).reduce((s, e) => s + (Number(e.amount) || 0), 0) : 0
  const budgetRemaining = budgetRow ? Number(budgetRow.amount) - monthSpentDept - grand : 0
  const overBudget = !!budgetRow && budgetRemaining < 0

  // Soft duplicate-voucher-number warning — never blocks (a different vendor
  // can legitimately share the same memo number).
  const dupVoucher = h.doc_type === 'vendor_voucher' && h.vendor_bill_no?.trim() &&
    (allExpenses as any[]).some(e => e.id !== record?.id && !e.deleted_at && !e.is_draft && e.vendor_bill_no?.trim() === h.vendor_bill_no.trim())

  const onTypeChange = (t: string) => {
    const patch: any = { expense_type: t, details: {} }
    if (!docTypeTouched) patch.doc_type = DEFAULT_DOC_TYPE(t)
    set(patch)
  }

  const save = async (asDraft: boolean) => {
    if (!asDraft) {
      if (!h.expense_type) { notify('error', 'Select an Expense Type'); return }
      if (!h.department) { notify('error', 'Select a Department'); return }
      if (isProcurement) {
        if (!validRows.length) { notify('error', 'Add at least one item with a quantity'); return }
      } else if (!(grand > 0)) { notify('error', 'Enter an amount'); return }
      if (isCredit && !h.due_date) { notify('error', 'Credit payment needs a due date'); return }
    }
    setSaving(true)
    try {
      const willFinalize = !asDraft
      let voucherNo = h.vendor_bill_no ?? null
      if (willFinalize && h.doc_type === 'internal_voucher' && !voucherNo) {
        voucherNo = await nextFinanceDocNumber(clientId, 'IV')
        if (!voucherNo) throw new Error('Could not generate the Internal Voucher number')
      }
      const header: any = {
        client_id: clientId, expense_date: h.expense_date || today(), expense_type: h.expense_type,
        payee_name: h.payee_name || null, payment_mode: h.payment_mode || null,
        due_date: isCredit ? (h.due_date || null) : null, department: h.department || null,
        description: h.description || null, amount: grand,
        doc_type: h.doc_type || 'vendor_voucher', vendor_bill_no: voucherNo,
        details: isProcurement ? {} : details,
        is_draft: asDraft,
        voucher_status: h.doc_type === 'no_document' ? 'collected' : (h.voucher_status || 'pending_collection')
      }
      let expId = record?.id
      if (record?.id) {
        const { error } = await supabase.from('finance_expenses').update(header).eq('id', record.id)
        if (error) throw error
      } else {
        if (willFinalize) {
          header.doc_no = await nextFinanceDocNumber(clientId, 'EXP')
          if (!header.doc_no) throw new Error('Could not generate the Expense ID')
        }
        const { data, error } = await supabase.from('finance_expenses').insert(header).select('id').single()
        if (error) throw error
        expId = data.id
      }
      // Finalizing a draft that never got an Expense ID assigns one now.
      if (willFinalize && record?.id && !record.doc_no) {
        const doc_no = await nextFinanceDocNumber(clientId, 'EXP')
        if (!doc_no) throw new Error('Could not generate the Expense ID')
        const { error } = await supabase.from('finance_expenses').update({ doc_no }).eq('id', expId)
        if (error) throw error
      }
      if (isProcurement) {
        await supabase.from('finance_expense_bills').delete().eq('expense_id', expId)
        const billPayload = validRows.map(r => ({
          client_id: clientId, expense_id: expId, item_id: r.item_id || null, bill_ref: r.name || null,
          category_id: r.category_id || null, unit: r.unit || null, qty: Number(r.qty) || null,
          rate: Number(r.rate) || null, amount: lineTotal(r)
        }))
        if (billPayload.length) {
          const { error } = await supabase.from('finance_expense_bills').insert(billPayload)
          if (error) throw error
        }
        for (const r of validRows) {
          if (!r.item_id) continue
          await supabase.from('finance_items').update({
            unit: r.unit || null, last_price: Number(r.rate) || null, category_id: r.category_id || null
          }).eq('id', r.item_id)
        }
        await supabase.from('finance_additional_expenses').delete().eq('expense_id', expId)
        const addlPayload = addl.filter(a => a.expense_type && Number(a.amount) > 0)
          .map(a => ({ client_id: clientId, expense_id: expId, expense_type: a.expense_type, amount: Number(a.amount) || 0 }))
        if (addlPayload.length) {
          const { error } = await supabase.from('finance_additional_expenses').insert(addlPayload)
          if (error) throw error
        }
      }
      onMastersChanged?.()
      notify('success', `Expense ${asDraft ? 'saved as draft' : record?.id ? 'updated' : 'saved'}`)
      onDone()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not save expense')
    } finally {
      setSaving(false)
    }
  }

  const frequent = (items as any[]).filter(i => i.is_active !== false).slice(0, 8)

  return (
    <Modal open onClose={onClose} title={record?.id ? `Expense — ${record.doc_no || 'Draft'}` : quick ? 'Quick Entry' : 'New Expense'} size="xl">
      <div className="space-y-4">
        <FinancePanel icon="assignment" title="Expense Details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Expense ID"><Input value={record?.doc_no ?? (h.is_draft ? 'Draft' : 'Auto on save')} disabled /></Field>
            <Field label="Date" required><Input type="date" value={h.expense_date ?? ''} onChange={e => set({ expense_date: e.target.value })} /></Field>
            <Field label="Expense Type" required>
              <Select value={h.expense_type ?? 'Procurement'} onChange={e => onTypeChange(e.target.value)}>
                {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Department" required>
              <Select value={h.department ?? 'Warehouse'} onChange={e => set({ department: e.target.value })}>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </Select>
            </Field>
            <Field label="Vendor / Payee">
              <Input list="recent-payees" value={h.payee_name ?? ''} onChange={e => set({ payee_name: e.target.value })} placeholder="Type a name…" />
              <datalist id="recent-payees">{(recentPayees ?? []).map((p: string) => <option key={p} value={p} />)}</datalist>
            </Field>
            <Field label="Payment Method">
              <Select value={h.payment_mode ?? 'Cash'} onChange={e => set({ payment_mode: e.target.value })}>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </Select>
            </Field>
            {isCredit && <Field label="Due Date" required><Input type="date" value={h.due_date ?? ''} onChange={e => set({ due_date: e.target.value })} /></Field>}
            <Field label="Supporting Document">
              <Select value={h.doc_type ?? 'vendor_voucher'} onChange={e => { setDocTypeTouched(true); set({ doc_type: e.target.value }) }}>
                {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </Select>
            </Field>
            {h.doc_type === 'vendor_voucher' && (
              <Field label="Voucher Number"><Input value={h.vendor_bill_no ?? ''} onChange={e => set({ vendor_bill_no: e.target.value })} placeholder="From the vendor's memo/bill" /></Field>
            )}
            {h.doc_type === 'internal_voucher' && (
              <Field label="Voucher Number"><Input value={record?.vendor_bill_no ?? 'Auto on save'} disabled /></Field>
            )}
            {!isProcurement && (
              <Field label="Amount (BDT)" required={!autoCalc}>
                <Input type="number" value={autoAmount != null ? autoAmount : (h.amount ?? '')} disabled={!!autoCalc}
                  onChange={e => set({ amount: numOrU(e.target.value) })} placeholder="0.00" />
              </Field>
            )}
          </div>
        </FinancePanel>

        {dupVoucher && (
          <p className="rounded-lg bg-warn/10 px-3 py-2 text-xs font-medium text-warn">
            <Icon name="warning" className="text-[14px]" /> This Voucher Number is already used on another expense — still fine if it's a different vendor.
          </p>
        )}

        {!isProcurement && fields.length > 0 && (
          <div>
            <SectionHeader icon="tune" title={`${h.expense_type} Details`} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {fields.map(f => (
                <Field key={f.key} label={f.label}>
                  <Input type={f.type === 'month' ? 'month' : f.type === 'number' ? 'number' : 'text'}
                    value={details[f.key] ?? ''} placeholder={f.placeholder}
                    onChange={e => setDetail(f.key, f.type === 'number' ? numOrU(e.target.value) : e.target.value)} />
                </Field>
              ))}
            </div>
            {autoCalc && <p className="-mt-1 text-xs text-ink-faint">Amount auto-calculates from {fields.find(f => f.key === autoCalc.qty)?.label} × {fields.find(f => f.key === autoCalc.rate)?.label}.</p>}
          </div>
        )}

        {isProcurement && (
          <>
            {frequent.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-ink-faint">Frequently used:</span>
                {frequent.map(it => (
                  <button key={it.id} type="button" onClick={() => addFrequent(it)}
                    className="rounded-full border border-surface-line px-3 py-1 text-xs font-medium text-ink-soft transition-colors hover:border-brand-400 hover:text-brand-600">
                    + {it.name}
                  </button>
                ))}
              </div>
            )}
            <div>
              <SectionHeader icon="inventory_2" title="Items"
                action={<Button size="sm" variant="secondary" icon="add" onClick={() => setRows(rs => [...rs, blankItem()])}>Add Item</Button>} />
              <div className="overflow-x-auto rounded-xl border border-surface-line">
                <div style={{ minWidth: 640 }}>
                  <div className="grid grid-cols-[1fr_80px_90px_110px_110px_32px] gap-2 border-b border-surface-line bg-surface-sunken px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                    <span>Item *</span><span>Qty *</span><span>Unit</span><span className="text-right">Unit Price</span><span className="text-right">Total</span><span />
                  </div>
                  {rows.map((r, i) => (
                    <div key={i} className="grid grid-cols-[1fr_80px_90px_110px_110px_32px] items-center gap-2 border-b border-surface-line px-2 py-1.5 last:border-b-0">
                      <div>
                        <CreatableCombobox items={itemOptions} value={r.item_id ?? ''} onChange={(id: string) => pickItem(i, id)}
                          onCreate={async (name: string) => { const c = await createItem(name); if (c) setRow(i, { item_id: c.id, name: c.label }); return c }}
                          noun="item" placeholder="Search or add an item…" />
                        {r.category_id && <span className="mt-0.5 block truncate pl-1 text-[11px] text-ink-faint">{catName(r.category_id)}</span>}
                      </div>
                      <input className="fiori-input h-9 text-right" type="number" value={r.qty ?? ''} onChange={e => setRow(i, { qty: numOrU(e.target.value) })} />
                      <input className="fiori-input h-9" value={r.unit ?? ''} onChange={e => setRow(i, { unit: e.target.value })} placeholder="pcs" />
                      <input className="fiori-input h-9 text-right" type="number" value={r.rate ?? ''} onChange={e => setRow(i, { rate: numOrU(e.target.value) })} />
                      <span className="px-2 text-right text-sm font-medium tabular-nums text-ink">{formatNumber(lineTotal(r), 2)}</span>
                      <button type="button" className="flex items-center justify-center text-ink-faint hover:text-bad disabled:opacity-25"
                        disabled={rows.length <= 1} onClick={() => setRows(rs => rs.filter((_, idx) => idx !== i))}><Icon name="close" className="text-[16px]" /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <SectionHeader icon="add_card" title="Additional Expenses (optional)"
                action={<Button size="sm" variant="ghost" icon="add" onClick={() => setAddl(a => [...a, blankAddl()])}>Add</Button>} />
              {addl.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-surface-line">
                  {addl.map((a, i) => (
                    <div key={i} className="grid grid-cols-[1fr_130px_32px] items-center gap-2 border-b border-surface-line px-2 py-1.5 last:border-b-0">
                      <input className="fiori-input h-9" list="addl-types" value={a.expense_type ?? ''} onChange={e => setAddl(x => x.map((y, idx) => idx === i ? { ...y, expense_type: e.target.value } : y))} placeholder="Transport, Loading…" />
                      <input className="fiori-input h-9 text-right" type="number" value={a.amount ?? ''} onChange={e => setAddl(x => x.map((y, idx) => idx === i ? { ...y, amount: numOrU(e.target.value) } : y))} placeholder="0.00" />
                      <button type="button" className="flex items-center justify-center text-ink-faint hover:text-bad" onClick={() => setAddl(x => x.filter((_, idx) => idx !== i))}><Icon name="close" className="text-[16px]" /></button>
                    </div>
                  ))}
                  <datalist id="addl-types">{ADDL_TYPES.map(t => <option key={t} value={t} />)}</datalist>
                </div>
              )}
            </div>
          </>
        )}

        <Field label="Remarks"><Textarea value={h.description ?? ''} onChange={e => set({ description: e.target.value })} placeholder="Optional note" /></Field>

        {budgetRow && (
          <div className={cn('rounded-xl border px-4 py-3 text-sm', overBudget ? 'border-bad/40 bg-bad/5' : 'border-surface-line bg-surface-sunken/40')}>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Budget · {budgetRow.department} · {period}</span>
              <span className="text-ink-soft">Budget <b className="tabular-nums text-ink">{formatNumber(budgetRow.amount, 2)}</b></span>
              <span className="text-ink-soft">Spent <b className="tabular-nums text-ink">{formatNumber(monthSpentDept, 2)}</b></span>
              <span className="text-ink-soft">This entry <b className="tabular-nums text-ink">{formatNumber(grand, 2)}</b></span>
              <span className={cn('font-semibold', overBudget ? 'text-bad' : 'text-ok')}>Remaining {formatNumber(budgetRemaining, 2)}</span>
            </div>
            {overBudget && <p className="mt-1 text-xs font-medium text-bad">This entry exceeds the {budgetRow.department} budget for {period} — you can still save it.</p>}
          </div>
        )}

        {isProcurement && (
          <div className="flex flex-col items-end gap-1 rounded-xl bg-surface-sunken px-4 py-3 text-sm">
            <div className="flex w-full max-w-xs justify-between"><span className="text-ink-soft">Subtotal</span><span className="tabular-nums text-ink">{formatNumber(subtotal, 2)}</span></div>
            <div className="flex w-full max-w-xs justify-between"><span className="text-ink-soft">Additional</span><span className="tabular-nums text-ink">{formatNumber(addlTotal, 2)}</span></div>
            <div className="flex w-full max-w-xs justify-between border-t border-surface-line pt-1"><span className="font-semibold text-ink">Grand Total</span><span className="font-bold tabular-nums text-brand-700 dark:text-brand-300">{formatNumber(grand, 2)} BDT</span></div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="secondary" icon="drafts" loading={saving} onClick={() => save(true)}>Save as Draft</Button>
          <Button icon="save" loading={saving} onClick={() => save(false)}>{record?.id && !record.is_draft ? 'Update' : 'Save Expense'}</Button>
        </div>
      </div>
    </Modal>
  )
}

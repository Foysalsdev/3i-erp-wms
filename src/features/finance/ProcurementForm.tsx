import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { nextDocNumber } from '@/hooks/useDocNumber'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { CreatableCombobox } from '@/components/shared/CreatableCombobox'
import { formatNumber } from '@/lib/utils'
import { FinancePanel, SectionHeader } from './components/FinanceUI'

const today = () => new Date().toISOString().slice(0, 10)
export const PROCUREMENT_TYPES = ['Daily Operation', 'Asset Purchase', 'Maintenance', 'Emergency Purchase']
export const PAYMENT_METHODS = ['Cash', 'Bank', 'Credit', 'bKash', 'Nagad', 'Card']
export const DEPARTMENTS = ['Warehouse', 'Transport', 'Office Administration', 'HR', 'IT', 'Security', 'Generator', 'Forklift', 'Others']
const ADDL_TYPES = ['Transport', 'Loading', 'Unloading', 'Delivery Charge', 'Others']

const blankItem = () => ({ item_id: '', name: '', category_id: '', unit: '', qty: undefined as number | undefined, rate: undefined as number | undefined })
const blankAddl = () => ({ expense_type: '', amount: undefined as number | undefined })
const lineTotal = (r: any) => (Number(r.qty) || 0) * (Number(r.rate) || 0)
const numOrU = (v: string) => v === '' ? undefined : Number(v)

// Daily Operation Procurement — one fast form: pick a vendor, punch items into a
// grid (searchable, with last-price memory), optional extra costs, and save the
// whole bill in one go. Items and vendors are managed masters that grow as you
// type (inline "add to database").
export function ProcurementForm({ record, clientId, vendors, items, categories, onMastersChanged, notify, onClose, onDone }: any) {
  const [h, setH] = useState<any>(record ?? {
    procurement_type: 'Daily Operation', expense_date: today(), payment_mode: 'Cash', department: 'Warehouse'
  })
  const [rows, setRows] = useState<any[]>(record?.__items?.length ? record.__items : [blankItem()])
  const [addl, setAddl] = useState<any[]>(record?.__addl ?? [])
  const [saving, setSaving] = useState(false)
  const set = (patch: any) => setH((x: any) => ({ ...x, ...patch }))

  const itemOptions = useMemo(() => (items as any[]).filter(i => i.is_active !== false)
    .map(i => ({ id: i.id, label: i.name, sublabel: i.unit || undefined })), [items])
  const vendorOptions = useMemo(() => (vendors as any[]).filter(v => v.is_active !== false)
    .map(v => ({ id: v.id, label: v.name, sublabel: v.contact_number || undefined })), [vendors])
  const catName = (id?: string) => (categories as any[]).find(c => c.id === id)?.name

  const setRow = (i: number, patch: any) => setRows(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  // Picking an existing item pulls its remembered unit / last price / category so
  // a repeat buy needs only a quantity. Values stay editable.
  const pickItem = (i: number, id: string) => {
    const it = (items as any[]).find(x => x.id === id)
    if (!it) { setRow(i, { item_id: id }); return }
    setRow(i, { item_id: id, name: it.name, unit: it.unit || '', rate: it.last_price != null ? Number(it.last_price) : undefined, category_id: it.category_id || '' })
    if (!h.vendor_id && it.last_vendor_id) set({ vendor_id: it.last_vendor_id })
  }
  const createItem = async (name: string) => {
    const { data, error } = await supabase.from('finance_items').insert({ client_id: clientId, name }).select('id,name').single()
    if (error) { notify('error', error.message); return null }
    onMastersChanged?.()
    return { id: data.id, label: data.name }
  }
  const createVendor = async (name: string) => {
    const { data, error } = await supabase.from('finance_vendors').insert({ client_id: clientId, name }).select('id,name').single()
    if (error) { notify('error', error.message); return null }
    onMastersChanged?.()
    return { id: data.id, label: data.name }
  }
  // A frequently-used item chip drops a ready row (unit + last price prefilled).
  const addFrequent = (it: any) => setRows(rs => {
    const base = rs.filter(r => r.name || r.item_id)
    return [...base, { item_id: it.id, name: it.name, unit: it.unit || '', rate: it.last_price != null ? Number(it.last_price) : undefined, category_id: it.category_id || '', qty: undefined }]
  })

  const validRows = rows.filter(r => (r.name || r.item_id) && Number(r.qty) > 0)
  const subtotal = rows.reduce((s, r) => s + lineTotal(r), 0)
  const addlTotal = addl.reduce((s, a) => s + (Number(a.amount) || 0), 0)
  const grand = subtotal + addlTotal
  const isCredit = h.payment_mode === 'Credit'

  const save = async () => {
    if (!h.vendor_id) { notify('error', 'Select a vendor'); return }
    if (!validRows.length) { notify('error', 'Add at least one item with a quantity'); return }
    if (rows.some(r => (r.name || r.item_id) && Number(r.rate) < 0)) { notify('error', 'Unit price cannot be negative'); return }
    if (isCredit && !h.due_date) { notify('error', 'Credit payment needs a due date'); return }
    setSaving(true)
    try {
      const vendorName = (vendors as any[]).find(v => v.id === h.vendor_id)?.name || null
      const header: any = {
        client_id: clientId, expense_date: h.expense_date || today(), procurement_type: h.procurement_type || 'Daily Operation',
        vendor_id: h.vendor_id, payee_name: vendorName, payment_mode: h.payment_mode || null,
        due_date: isCredit ? (h.due_date || null) : null, department: h.department || null,
        description: h.description || null, amount: grand, status: 'posted',
        category_id: validRows[0]?.category_id || null
      }
      let expId = record?.id
      if (record?.id) {
        const { error } = await supabase.from('finance_expenses').update(header).eq('id', record.id)
        if (error) throw error
      } else {
        header.doc_no = await nextDocNumber(clientId, 'PROC')
        const { data, error } = await supabase.from('finance_expenses').insert(header).select('id').single()
        if (error) throw error
        expId = data.id
      }
      // Items → finance_expense_bills (rewritten), plus remember each item's
      // latest unit / price / vendor on the item master.
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
          unit: r.unit || null, last_price: Number(r.rate) || null, last_vendor_id: h.vendor_id, category_id: r.category_id || null
        }).eq('id', r.item_id)
      }
      // Additional expenses
      await supabase.from('finance_additional_expenses').delete().eq('expense_id', expId)
      const addlPayload = addl.filter(a => a.expense_type && Number(a.amount) > 0)
        .map(a => ({ client_id: clientId, expense_id: expId, expense_type: a.expense_type, amount: Number(a.amount) || 0 }))
      if (addlPayload.length) {
        const { error } = await supabase.from('finance_additional_expenses').insert(addlPayload)
        if (error) throw error
      }
      onMastersChanged?.()
      notify('success', `Procurement ${record?.id ? 'updated' : 'saved'}`)
      onDone()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not save procurement')
    } finally {
      setSaving(false)
    }
  }

  const frequent = (items as any[]).filter(i => i.is_active !== false).slice(0, 8)

  return (
    <Modal open onClose={onClose} title={record?.id ? `Procurement — ${record.doc_no || ''}` : 'New Procurement'} size="xl">
      <div className="space-y-4">
        {/* Header */}
        <FinancePanel icon="assignment" title="Procurement">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Procurement No"><Input value={record?.doc_no ?? 'Auto on save'} disabled /></Field>
            <Field label="Date" required><Input type="date" value={h.expense_date ?? ''} onChange={e => set({ expense_date: e.target.value })} /></Field>
            <Field label="Type">
              <Select value={h.procurement_type ?? 'Daily Operation'} onChange={e => set({ procurement_type: e.target.value })}>
                {PROCUREMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Vendor" required>
              <CreatableCombobox items={vendorOptions} value={h.vendor_id ?? ''} onChange={(id: string) => set({ vendor_id: id })}
                onCreate={createVendor} noun="vendor" placeholder="Search or add a vendor…" />
            </Field>
            <Field label="Payment Method">
              <Select value={h.payment_mode ?? 'Cash'} onChange={e => set({ payment_mode: e.target.value })}>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </Select>
            </Field>
            {isCredit
              ? <Field label="Due Date" required><Input type="date" value={h.due_date ?? ''} onChange={e => set({ due_date: e.target.value })} /></Field>
              : <Field label="Department">
                  <Select value={h.department ?? 'Warehouse'} onChange={e => set({ department: e.target.value })}>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </Select>
                </Field>}
            {isCredit && <Field label="Department">
              <Select value={h.department ?? 'Warehouse'} onChange={e => set({ department: e.target.value })}>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </Select>
            </Field>}
          </div>
        </FinancePanel>

        {/* Frequently used */}
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

        {/* Items */}
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

        {/* Additional expenses */}
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

        <Field label="Remarks"><Input value={h.description ?? ''} onChange={e => set({ description: e.target.value })} placeholder="Optional note" /></Field>

        {/* Summary */}
        <div className="flex flex-col items-end gap-1 rounded-xl bg-surface-sunken px-4 py-3 text-sm">
          <div className="flex w-full max-w-xs justify-between"><span className="text-ink-soft">Subtotal</span><span className="tabular-nums text-ink">{formatNumber(subtotal, 2)}</span></div>
          <div className="flex w-full max-w-xs justify-between"><span className="text-ink-soft">Additional</span><span className="tabular-nums text-ink">{formatNumber(addlTotal, 2)}</span></div>
          <div className="flex w-full max-w-xs justify-between border-t border-surface-line pt-1"><span className="font-semibold text-ink">Grand Total</span><span className="font-bold tabular-nums text-brand-700 dark:text-brand-300">{formatNumber(grand, 2)} BDT</span></div>
        </div>

        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button icon="save" loading={saving} onClick={save}>{record?.id ? 'Update' : 'Save Procurement'}</Button>
        </div>
      </div>
    </Modal>
  )
}

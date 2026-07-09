import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { useCollection } from '@/hooks/useCollection'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { Field, Input, Select } from '@/components/ui/Field'
import { ConfirmDelete } from '@/components/ui/ConfirmDelete'
import { formatNumber, formatDate } from '@/lib/utils'
import { SectionHeader } from './components/FinanceUI'
import { DEPARTMENTS } from './ProcurementForm'

const today = () => new Date().toISOString().slice(0, 10)
const BUDGET_DEPTS = ['All', ...DEPARTMENTS]
const monthLabel = (y: number, m: number) => new Date(`${y}-${String(m).padStart(2, '0')}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

// Finance master data for procurement: Categories (expense heads), Vendors,
// Items (with remembered unit/last price), and the cash-book opening balance.
export function FinanceSetup() {
  const { currentClientId, can } = useAuth()
  const notify = useUI(s => s.notify)
  const canCreate = can('finance.create'), canEdit = can('finance.edit'), canDelete = can('finance.delete')
  const { data: cats, refresh: refreshCats } = useCollection('finance_expense_categories', { order: 'name', ascending: true })
  const { data: vendors, refresh: refreshVendors } = useCollection('finance_vendors', { order: 'name', ascending: true })
  const { data: items, refresh: refreshItems } = useCollection('finance_items', { order: 'name', ascending: true })
  const { data: openings, refresh: refreshOpenings } = useCollection('finance_balance_adjustments', { order: 'adjustment_date', ascending: true })
  const { data: budgets, refresh: refreshBudgets } = useCollection('finance_budgets', { order: 'year', ascending: false })
  const [edit, setEdit] = useState<{ kind: string; rec: any } | null>(null)
  const [del, setDel] = useState<{ table: string; rec: any; label: string } | null>(null)
  const [opening, setOpening] = useState(false)
  const [budgetEdit, setBudgetEdit] = useState<any>(null)
  const perms = { canCreate, canEdit, canDelete }
  const catName = (id?: string) => (cats as any[]).find(c => c.id === id)?.name || '—'

  const toggleActive = async (table: string, rec: any, refresh: () => void) => {
    const { error } = await supabase.from(table as any).update({ is_active: !rec.is_active }).eq('id', rec.id)
    if (error) { notify('error', error.message); return }
    refresh()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      {/* Categories */}
      <MasterCard icon="sell" title="Expense Categories" hint="The heads your procurement falls under (Fuel, Stationery, Cleaning, Safety Items, Labour…)."
        rows={cats as any[]} perms={perms} onNew={() => setEdit({ kind: 'category', rec: { name: '', code: '', is_active: true } })}
        onEdit={(r: any) => setEdit({ kind: 'category', rec: r })} onToggle={(r: any) => toggleActive('finance_expense_categories', r, refreshCats)}
        onDelete={(r: any) => setDel({ table: 'finance_expense_categories', rec: r, label: `Category · ${r.name}` })}
        cols={[{ h: 'Code', w: '110px', render: (r: any) => <span className="font-mono text-xs text-ink-soft">{r.code || '—'}</span> }, { h: 'Name', w: '1fr', render: (r: any) => r.name }]} />

      {/* Vendors */}
      <MasterCard icon="local_shipping" title="Vendors" hint="Shops / suppliers you buy from. New vendors can also be added straight from the procurement form."
        rows={vendors as any[]} perms={perms} onNew={() => setEdit({ kind: 'vendor', rec: { name: '', contact_number: '', is_active: true } })}
        onEdit={(r: any) => setEdit({ kind: 'vendor', rec: r })} onToggle={(r: any) => toggleActive('finance_vendors', r, refreshVendors)}
        onDelete={(r: any) => setDel({ table: 'finance_vendors', rec: r, label: `Vendor · ${r.name}` })}
        cols={[{ h: 'Name', w: '1fr', render: (r: any) => r.name }, { h: 'Contact', w: '150px', render: (r: any) => <span className="text-ink-soft">{r.contact_number || '—'}</span> }]} />

      {/* Items */}
      <MasterCard icon="inventory_2" title="Items" hint="Reusable items with remembered unit & last price. New items can be added from the procurement form too."
        rows={items as any[]} perms={perms} onNew={() => setEdit({ kind: 'item', rec: { name: '', category_id: '', unit: '', is_active: true } })}
        onEdit={(r: any) => setEdit({ kind: 'item', rec: r })} onToggle={(r: any) => toggleActive('finance_items', r, refreshItems)}
        onDelete={(r: any) => setDel({ table: 'finance_items', rec: r, label: `Item · ${r.name}` })}
        cols={[
          { h: 'Name', w: '1fr', render: (r: any) => r.name },
          { h: 'Category', w: '150px', render: (r: any) => <span className="text-ink-soft">{catName(r.category_id)}</span> },
          { h: 'Unit', w: '80px', render: (r: any) => <span className="text-ink-soft">{r.unit || '—'}</span> },
          { h: 'Last Price', w: '100px', render: (r: any) => <span className="tabular-nums text-ink-soft">{r.last_price != null ? formatNumber(r.last_price, 2) : '—'}</span> }
        ]} />

      {/* Monthly Budgets */}
      <Card className="p-4">
        <SectionHeader icon="savings" title="Monthly Budgets"
          action={canCreate && <Button size="sm" variant="secondary" icon="add" onClick={() => { const d = new Date(); setBudgetEdit({ year: d.getFullYear(), month: d.getMonth() + 1, department: 'All', amount: '' }) }}>New Budget</Button>} />
        <p className="-mt-1 mb-3 text-xs text-ink-faint">Monthly spend budget per department (or All for the whole warehouse). Shown live on the procurement form and dashboard.</p>
        {(budgets as any[]).length === 0 ? (
          <p className="rounded-xl border border-dashed border-surface-line px-3 py-3 text-sm text-ink-faint">No budgets set.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-surface-line">
            <div className="grid grid-cols-[1fr_1fr_130px_80px] gap-2 border-b border-surface-line bg-surface-sunken px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              <span>Month</span><span>Department</span><span className="text-right">Budget (BDT)</span><span className="text-right">Action</span>
            </div>
            {(budgets as any[]).map((b, i) => (
              <div key={b.id} className={'grid grid-cols-[1fr_1fr_130px_80px] items-center gap-2 px-3 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                <span className="text-ink">{monthLabel(b.year, b.month)}</span>
                <span className="text-ink-soft">{b.department}</span>
                <span className="text-right font-semibold tabular-nums text-ink">{formatNumber(b.amount, 2)}</span>
                <span className="flex items-center justify-end gap-1">
                  {canEdit && <button title="Edit" className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-sunken hover:text-ink" onClick={() => setBudgetEdit(b)}><Icon name="edit" className="text-[18px]" /></button>}
                  {canDelete && <button title="Delete" className="rounded-lg p-1.5 text-ink-faint hover:bg-bad/10 hover:text-bad" onClick={() => setDel({ table: 'finance_budgets', rec: b, label: `Budget · ${monthLabel(b.year, b.month)} · ${b.department}` })}><Icon name="delete" className="text-[18px]" /></button>}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Opening Balance */}
      <Card className="p-4">
        <SectionHeader icon="account_balance_wallet" title="Opening Balance"
          action={canCreate && <Button size="sm" variant="secondary" icon="add" onClick={() => setOpening(true)}>Set Opening Balance</Button>} />
        <p className="-mt-1 mb-3 text-xs text-ink-faint">Cash-in-hand carried into the module before any tracked receipt. Seeds the cash book's brought-down figure.</p>
        {(openings as any[]).length === 0 ? (
          <p className="rounded-xl border border-dashed border-surface-line px-3 py-3 text-sm text-ink-faint">No opening balance / adjustments recorded.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-surface-line">
            {(openings as any[]).map((o, i) => (
              <div key={o.id} className={'grid grid-cols-[120px_1fr_130px] items-center gap-2 px-3 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                <span className="text-ink-soft">{formatDate(o.adjustment_date)}</span>
                <span className="text-ink">{o.remarks || '—'}</span>
                <span className={'text-right font-semibold tabular-nums ' + (Number(o.amount) < 0 ? 'text-bad' : 'text-ink')}>{formatNumber(o.amount, 2)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {edit && <MasterForm kind={edit.kind} rec={edit.rec} clientId={currentClientId!} cats={cats as any[]} notify={notify}
        onClose={() => setEdit(null)} onDone={() => { setEdit(null); refreshCats(); refreshVendors(); refreshItems() }} />}
      {budgetEdit && <BudgetForm rec={budgetEdit} clientId={currentClientId!} notify={notify}
        onClose={() => setBudgetEdit(null)} onDone={() => { setBudgetEdit(null); refreshBudgets() }} />}
      {opening && <OpeningBalanceForm clientId={currentClientId!} notify={notify} onClose={() => setOpening(false)} onDone={() => { setOpening(false); refreshOpenings() }} />}
      <ConfirmDelete open={!!del} onClose={() => setDel(null)} name={del?.label}
        onConfirm={async () => {
          const res = await supabase.from(del!.table as any).delete().eq('id', del!.rec.id)
          if (!res.error) { setDel(null); refreshCats(); refreshVendors(); refreshItems(); refreshBudgets() }
          return res
        }} />
    </div>
  )
}

function MasterCard({ icon, title, hint, rows, perms, cols, onNew, onEdit, onToggle, onDelete }: any) {
  const template = `${cols.map((c: any) => c.w).join(' ')} 90px 96px`
  return (
    <Card className="p-4">
      <SectionHeader icon={icon} title={title}
        action={perms.canCreate && <Button size="sm" variant="secondary" icon="add" onClick={onNew}>New</Button>} />
      <p className="-mt-1 mb-3 text-xs text-ink-faint">{hint}</p>
      <div className="overflow-x-auto">
        <div className="min-w-[560px] overflow-hidden rounded-xl border border-surface-line">
          <div className="grid gap-2 border-b border-surface-line bg-surface-sunken px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft" style={{ gridTemplateColumns: template }}>
            {cols.map((c: any) => <span key={c.h}>{c.h}</span>)}<span>Status</span><span className="text-right">Action</span>
          </div>
          {rows.length === 0 ? <p className="p-4 text-sm text-ink-faint">Nothing yet.</p> : rows.map((r: any, i: number) => (
            <div key={r.id} className={'grid items-center gap-2 px-3 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')} style={{ gridTemplateColumns: template }}>
              {cols.map((c: any) => <span key={c.h} className={'min-w-0 truncate ' + (r.is_active === false ? 'text-ink-faint line-through' : 'text-ink')}>{c.render(r)}</span>)}
              <span><Badge tone={r.is_active !== false ? 'positive' : 'neutral'}>{r.is_active !== false ? 'Active' : 'Inactive'}</Badge></span>
              <span className="flex items-center justify-end gap-1">
                {perms.canEdit && <button title={r.is_active !== false ? 'Deactivate' : 'Activate'} className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-sunken hover:text-ink" onClick={() => onToggle(r)}><Icon name={r.is_active !== false ? 'toggle_on' : 'toggle_off'} className="text-[18px]" /></button>}
                {perms.canEdit && <button title="Edit" className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-sunken hover:text-ink" onClick={() => onEdit(r)}><Icon name="edit" className="text-[18px]" /></button>}
                {perms.canDelete && <button title="Delete" className="rounded-lg p-1.5 text-ink-faint hover:bg-bad/10 hover:text-bad" onClick={() => onDelete(r)}><Icon name="delete" className="text-[18px]" /></button>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

const TABLES: Record<string, string> = { category: 'finance_expense_categories', vendor: 'finance_vendors', item: 'finance_items' }
const TITLES: Record<string, string> = { category: 'Category', vendor: 'Vendor', item: 'Item' }

function MasterForm({ kind, rec, clientId, cats, notify, onClose, onDone }: any) {
  const [r, setR] = useState<any>(rec)
  const [saving, setSaving] = useState(false)
  const set = (patch: any) => setR((x: any) => ({ ...x, ...patch }))
  const save = async () => {
    if (!r.name?.trim()) { notify('error', 'Enter a name'); return }
    setSaving(true)
    const base: any = { client_id: clientId, name: r.name.trim(), is_active: r.is_active ?? true }
    if (kind === 'category') base.code = r.code?.trim() || null
    if (kind === 'vendor') base.contact_number = r.contact_number?.trim() || null
    if (kind === 'item') { base.category_id = r.category_id || null; base.unit = r.unit?.trim() || null }
    const table = TABLES[kind]
    const res = r.id ? await supabase.from(table as any).update(base).eq('id', r.id) : await supabase.from(table as any).insert(base)
    setSaving(false)
    if (res.error) { notify('error', res.error.message); return }
    notify('success', `${TITLES[kind]} ${r.id ? 'updated' : 'added'}`); onDone()
  }
  return (
    <Modal open onClose={onClose} title={`${r.id ? 'Edit' : 'New'} ${TITLES[kind]}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {kind === 'category' && <Field label="Code"><Input value={r.code ?? ''} onChange={e => set({ code: e.target.value })} placeholder="e.g. FUEL" /></Field>}
          <Field label="Name" required className={kind === 'category' ? '' : 'sm:col-span-2'}><Input value={r.name ?? ''} onChange={e => set({ name: e.target.value })} /></Field>
          {kind === 'vendor' && <Field label="Contact Number" className="sm:col-span-2"><Input value={r.contact_number ?? ''} onChange={e => set({ contact_number: e.target.value })} placeholder="Optional" /></Field>}
          {kind === 'item' && <>
            <Field label="Category"><Select value={r.category_id ?? ''} onChange={e => set({ category_id: e.target.value })}><option value="">—</option>{(cats as any[]).filter(c => c.is_active !== false).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label="Unit"><Input value={r.unit ?? ''} onChange={e => set({ unit: e.target.value })} placeholder="pcs, Ltr, kg…" /></Field>
          </>}
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" checked={r.is_active ?? true} onChange={e => set({ is_active: e.target.checked })} /> Active
        </label>
        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button icon="save" loading={saving} onClick={save}>{r.id ? 'Update' : 'Add'}</Button>
        </div>
      </div>
    </Modal>
  )
}

function BudgetForm({ rec, clientId, notify, onClose, onDone }: any) {
  const [b, setB] = useState<any>({ month: `${rec.year}-${String(rec.month).padStart(2, '0')}`, department: rec.department || 'All', amount: rec.amount ?? '' })
  const [saving, setSaving] = useState(false)
  const save = async () => {
    const [y, m] = (b.month || '').split('-').map(Number)
    if (!y || !m) { notify('error', 'Pick a month'); return }
    if (!(Number(b.amount) >= 0)) { notify('error', 'Enter a budget amount'); return }
    setSaving(true)
    const payload = { client_id: clientId, year: y, month: m, department: b.department || 'All', amount: Number(b.amount) }
    const res = rec.id
      ? await supabase.from('finance_budgets').update(payload).eq('id', rec.id)
      : await supabase.from('finance_budgets').upsert(payload, { onConflict: 'client_id,year,month,department' })
    setSaving(false)
    if (res.error) { notify('error', res.error.message); return }
    notify('success', `Budget ${rec.id ? 'updated' : 'saved'}`); onDone()
  }
  return (
    <Modal open onClose={onClose} title={`${rec.id ? 'Edit' : 'New'} Budget`}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Month" required><Input type="month" value={b.month} onChange={e => setB({ ...b, month: e.target.value })} /></Field>
          <Field label="Department"><Select value={b.department} onChange={e => setB({ ...b, department: e.target.value })}>{BUDGET_DEPTS.map(d => <option key={d} value={d}>{d}</option>)}</Select></Field>
          <Field label="Budget (BDT)" required><Input type="number" value={b.amount} onChange={e => setB({ ...b, amount: e.target.value })} placeholder="0.00" /></Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button icon="save" loading={saving} onClick={save}>{rec.id ? 'Update' : 'Save'}</Button>
        </div>
      </div>
    </Modal>
  )
}

function OpeningBalanceForm({ clientId, notify, onClose, onDone }: any) {
  const [o, setO] = useState<any>({ adjustment_date: today(), amount: '', remarks: 'Opening Balance' })
  const [saving, setSaving] = useState(false)
  const save = async () => {
    const amt = Number(o.amount)
    if (!amt) { notify('error', 'Enter the opening balance amount'); return }
    setSaving(true)
    const { error } = await supabase.from('finance_balance_adjustments').insert({ client_id: clientId, adjustment_date: o.adjustment_date || today(), amount: amt, remarks: o.remarks?.trim() || 'Opening Balance' })
    setSaving(false)
    if (error) { notify('error', error.message); return }
    notify('success', 'Opening balance recorded'); onDone()
  }
  return (
    <Modal open onClose={onClose} title="Set Opening Balance">
      <div className="space-y-4">
        <p className="text-xs text-ink-faint">Cash-in-hand at the start. Use a negative amount only to correct/reduce the running balance.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Date" required><Input type="date" value={o.adjustment_date} onChange={e => setO({ ...o, adjustment_date: e.target.value })} /></Field>
          <Field label="Amount (BDT)" required><Input type="number" value={o.amount} onChange={e => setO({ ...o, amount: e.target.value })} placeholder="0.00" /></Field>
        </div>
        <Field label="Remarks"><Input value={o.remarks} onChange={e => setO({ ...o, remarks: e.target.value })} /></Field>
        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button icon="save" loading={saving} onClick={save}>Save</Button>
        </div>
      </div>
    </Modal>
  )
}

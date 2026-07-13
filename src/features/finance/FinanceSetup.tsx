import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { useCollection } from '@/hooks/useCollection'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Icon } from '@/components/ui/Icon'
import { Field, Input, Select } from '@/components/ui/Field'
import { ConfirmDelete } from '@/components/ui/ConfirmDelete'
import { formatNumber, formatDate } from '@/lib/utils'
import { SectionHeader } from './components/FinanceUI'
import type { FinanceItem, ExpenseCategory } from './financeCash'
import type { Tables } from '@/types/database.types'
import type { ReactNode } from 'react'
import { DEPARTMENTS } from './ExpenseForm'

const today = () => new Date().toISOString().slice(0, 10)
const BUDGET_DEPTS = ['All', ...DEPARTMENTS]
const monthLabel = (y: number, m: number) => new Date(`${y}-${String(m).padStart(2, '0')}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

// Finance master data: Categories (expense heads), Items (with remembered
// unit/last price, used by Procurement's item grid), Monthly Budgets and the
// cash-book opening balance. Vendor/Payee is free text everywhere — no
// vendor master here by design.
export function FinanceSetup() {
  const { currentClientId, can } = useAuth()
  const notify = useUI(s => s.notify)
  const canCreate = can('finance.create'), canEdit = can('finance.edit'), canDelete = can('finance.delete')
  const { data: cats, refresh: refreshCats } = useCollection('finance_expense_categories', { order: 'name', ascending: true })
  const { data: items, refresh: refreshItems } = useCollection('finance_items', { order: 'name', ascending: true })
  const { data: openings, refresh: refreshOpenings } = useCollection('finance_balance_adjustments', { order: 'adjustment_date', ascending: true })
  const { data: budgets, refresh: refreshBudgets } = useCollection('finance_budgets', { order: 'year', ascending: false })
  const [edit, setEdit] = useState<{ kind: MasterKind; rec: Partial<FinanceItem & ExpenseCategory> } | null>(null)
  const [del, setDel] = useState<{ table: MasterTable | 'finance_budgets'; rec: { id: string }; label: string } | null>(null)
  const [opening, setOpening] = useState(false)
  const [budgetEdit, setBudgetEdit] = useState<Partial<Tables<'finance_budgets'>> | null>(null)
  const perms = { canCreate, canEdit, canDelete }
  const catName = (id?: string | null) => cats.find(c => c.id === id)?.name || '—'

  const toggleActive = async (table: MasterTable, rec: { id: string; is_active: boolean | null }, refresh: () => void) => {
    const { error } = await supabase.from(table).update({ is_active: !rec.is_active }).eq('id', rec.id)
    if (error) { notify('error', error.message); return }
    refresh()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      {/* Categories */}
      <MasterCard icon="sell" title="Expense Categories" hint="The heads your procurement falls under (Fuel, Stationery, Cleaning, Safety Items, Labour…)."
        rows={cats} perms={perms} onNew={() => setEdit({ kind: 'category', rec: { name: '', code: '', is_active: true } })}
        onEdit={r => setEdit({ kind: 'category', rec: r })} onToggle={r => toggleActive('finance_expense_categories', r, refreshCats)}
        onDelete={r => setDel({ table: 'finance_expense_categories', rec: r, label: `Category · ${r.name}` })}
        cols={[{ h: 'Code', w: '110px', render: r => <span className="font-mono text-xs text-ink-soft">{r.code || '—'}</span> }, { h: 'Name', w: '1fr', render: r => r.name }]} />

      {/* Items */}
      <MasterCard icon="inventory_2" title="Items" hint="Reusable items with remembered unit & last price, used by the Procurement expense type's item grid. New items can be added from the entry form too."
        rows={items} perms={perms} onNew={() => setEdit({ kind: 'item', rec: { name: '', category_id: '', unit: '', is_active: true } })}
        onEdit={r => setEdit({ kind: 'item', rec: r })} onToggle={r => toggleActive('finance_items', r, refreshItems)}
        onDelete={r => setDel({ table: 'finance_items', rec: r, label: `Item · ${r.name}` })}
        cols={[
          { h: 'Name', w: '1fr', render: r => r.name },
          { h: 'Category', w: '150px', render: r => <span className="text-ink-soft">{catName(r.category_id)}</span> },
          { h: 'Unit', w: '80px', render: r => <span className="text-ink-soft">{r.unit || '—'}</span> },
          { h: 'Last Price', w: '100px', render: r => <span className="tabular-nums text-ink-soft">{r.last_price != null ? formatNumber(r.last_price, 2) : '—'}</span> }
        ]} />

      {/* Monthly Budgets */}
      <Card className="p-4">
        <SectionHeader icon="savings" title="Monthly Budgets"
          action={canCreate && <Button size="sm" variant="secondary" icon="add" onClick={() => { const d = new Date(); setBudgetEdit({ year: d.getFullYear(), month: d.getMonth() + 1, department: 'All' }) }}>New Budget</Button>} />
        <p className="-mt-1 mb-3 text-xs text-ink-faint">Monthly spend budget per department (or All for the whole warehouse). Shown live on the procurement form and dashboard.</p>
        {budgets.length === 0 ? (
          <p className="rounded-xl border border-dashed border-surface-line px-3 py-3 text-sm text-ink-faint">No budgets set.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-surface-line">
            <div className="grid grid-cols-[1fr_1fr_130px_80px] gap-2 border-b border-surface-line bg-surface-sunken px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              <span>Month</span><span>Department</span><span className="text-right">Budget (BDT)</span><span className="text-right">Action</span>
            </div>
            {budgets.map((b, i) => (
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
        {openings.length === 0 ? (
          <p className="rounded-xl border border-dashed border-surface-line px-3 py-3 text-sm text-ink-faint">No opening balance / adjustments recorded.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-surface-line">
            {openings.map((o, i) => (
              <div key={o.id} className={'grid grid-cols-[120px_1fr_130px] items-center gap-2 px-3 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                <span className="text-ink-soft">{formatDate(o.adjustment_date)}</span>
                <span className="text-ink">{o.remarks || '—'}</span>
                <span className={'text-right font-semibold tabular-nums ' + (Number(o.amount) < 0 ? 'text-bad' : 'text-ink')}>{formatNumber(o.amount, 2)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {edit && <MasterForm kind={edit.kind} rec={edit.rec} clientId={currentClientId!} cats={cats} notify={notify}
        onClose={() => setEdit(null)} onDone={() => { setEdit(null); refreshCats(); refreshItems() }} />}
      {budgetEdit && <BudgetForm rec={budgetEdit} clientId={currentClientId!} notify={notify}
        onClose={() => setBudgetEdit(null)} onDone={() => { setBudgetEdit(null); refreshBudgets() }} />}
      {opening && <OpeningBalanceForm clientId={currentClientId!} notify={notify} onClose={() => setOpening(false)} onDone={() => { setOpening(false); refreshOpenings() }} />}
      <ConfirmDelete open={!!del} onClose={() => setDel(null)} name={del?.label}
        onConfirm={async () => {
          const res = await supabase.from(del!.table).delete().eq('id', del!.rec.id)
          if (!res.error) { setDel(null); refreshCats(); refreshItems(); refreshBudgets() }
          return res
        }} />
    </div>
  )
}

interface MasterPerms { canCreate: boolean; canEdit: boolean; canDelete: boolean }
function MasterCard<R extends { id: string; name: string | null; is_active: boolean | null }>({ icon, title, hint, rows, perms, cols, onNew, onEdit, onToggle, onDelete }: {
  icon: string; title: string; hint: string; rows: R[]; perms: MasterPerms
  cols: { h: string; w: string; render: (r: R) => ReactNode }[]
  onNew: () => void; onEdit: (r: R) => void; onToggle: (r: R) => void; onDelete: (r: R) => void
}) {
  const template = `${cols.map(c => c.w).join(' ')} 90px 96px`
  return (
    <Card className="p-4">
      <SectionHeader icon={icon} title={title}
        action={perms.canCreate && <Button size="sm" variant="secondary" icon="add" onClick={onNew}>New</Button>} />
      <p className="-mt-1 mb-3 text-xs text-ink-faint">{hint}</p>
      <div className="overflow-x-auto">
        <div className="min-w-[560px] overflow-hidden rounded-xl border border-surface-line">
          <div className="grid gap-2 border-b border-surface-line bg-surface-sunken px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft" style={{ gridTemplateColumns: template }}>
            {cols.map(c => <span key={c.h}>{c.h}</span>)}<span>Status</span><span className="text-right">Action</span>
          </div>
          {rows.length === 0 ? <p className="p-4 text-sm text-ink-faint">Nothing yet.</p> : rows.map((r, i) => (
            <div key={r.id} className={'grid items-center gap-2 px-3 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')} style={{ gridTemplateColumns: template }}>
              {cols.map(c => <span key={c.h} className={'min-w-0 truncate ' + (r.is_active === false ? 'text-ink-faint line-through' : 'text-ink')}>{c.render(r)}</span>)}
              <span><StatusBadge status={r.is_active !== false ? 'active' : 'inactive'} /></span>
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

type MasterKind = 'category' | 'item'
type MasterTable = 'finance_expense_categories' | 'finance_items'
const TABLES: Record<MasterKind, MasterTable> = { category: 'finance_expense_categories', item: 'finance_items' }
const TITLES: Record<MasterKind, string> = { category: 'Category', item: 'Item' }

type MasterRec = Partial<FinanceItem & ExpenseCategory>
function MasterForm({ kind, rec, clientId, cats, notify, onClose, onDone }: {
  kind: MasterKind; rec: MasterRec; clientId: string; cats: ExpenseCategory[]
  notify: (kind: 'success' | 'error', msg: string) => void; onClose: () => void; onDone: () => void
}) {
  const [r, setR] = useState<MasterRec>(rec)
  const [saving, setSaving] = useState(false)
  const set = (patch: MasterRec) => setR(x => ({ ...x, ...patch }))
  const save = async () => {
    if (!r.name?.trim()) { notify('error', 'Enter a name'); return }
    setSaving(true)
    const name = r.name!.trim(), is_active = r.is_active ?? true
    const res = kind === 'category'
      ? (r.id
          ? await supabase.from('finance_expense_categories').update({ name, is_active, code: r.code?.trim() || null }).eq('id', r.id)
          : await supabase.from('finance_expense_categories').insert({  name, is_active, code: r.code?.trim() || null }))
      : (r.id
          ? await supabase.from('finance_items').update({ name, is_active, category_id: r.category_id || null, unit: r.unit?.trim() || null }).eq('id', r.id)
          : await supabase.from('finance_items').insert({  name, is_active, category_id: r.category_id || null, unit: r.unit?.trim() || null }))
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
          {kind === 'item' && <>
            <Field label="Category"><Select value={r.category_id ?? ''} onChange={e => set({ category_id: e.target.value })}><option value="">—</option>{cats.filter(c => c.is_active !== false).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
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

function BudgetForm({ rec, clientId, notify, onClose, onDone }: {
  rec: Partial<Tables<'finance_budgets'>>; clientId: string
  notify: (kind: 'success' | 'error', msg: string) => void; onClose: () => void; onDone: () => void
}) {
  const [b, setB] = useState<{ month: string; department: string; amount: number | string }>({ month: `${rec.year}-${String(rec.month).padStart(2, '0')}`, department: rec.department || 'All', amount: rec.amount ?? '' })
  const [saving, setSaving] = useState(false)
  const save = async () => {
    const [y, m] = (b.month || '').split('-').map(Number)
    if (!y || !m) { notify('error', 'Pick a month'); return }
    if (!(Number(b.amount) >= 0)) { notify('error', 'Enter a budget amount'); return }
    setSaving(true)
    const payload = {  year: y, month: m, department: b.department || 'All', amount: Number(b.amount) }
    const res = rec.id
      ? await supabase.from('finance_budgets').update(payload).eq('id', rec.id)
      : await supabase.from('finance_budgets').upsert(payload, { onConflict: 'year,month,department' })
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

function OpeningBalanceForm({ clientId, notify, onClose, onDone }: {
  clientId: string; notify: (kind: 'success' | 'error', msg: string) => void; onClose: () => void; onDone: () => void
}) {
  const [o, setO] = useState<{ adjustment_date: string; amount: number | string; remarks: string }>({ adjustment_date: today(), amount: '', remarks: 'Opening Balance' })
  const [saving, setSaving] = useState(false)
  const save = async () => {
    const amt = Number(o.amount)
    if (!amt) { notify('error', 'Enter the opening balance amount'); return }
    setSaving(true)
    const { error } = await supabase.from('finance_balance_adjustments').insert({  adjustment_date: o.adjustment_date || today(), amount: amt, remarks: o.remarks?.trim() || 'Opening Balance' })
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

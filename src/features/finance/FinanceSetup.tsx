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
import { Field, Input } from '@/components/ui/Field'
import { ConfirmDelete } from '@/components/ui/ConfirmDelete'
import { formatNumber, formatDate } from '@/lib/utils'
import { SectionHeader } from './components/FinanceUI'

const today = () => new Date().toISOString().slice(0, 10)

// The three behaviours a head can drive on the voucher form. Kept in sync with
// Expenses.tsx `applyHead`.
const MODES: { value: string; label: string; hint: string }[] = [
  { value: 'single', label: 'Single amount', hint: 'One amount, no breakdown (Fuel, Stationery, Rent).' },
  { value: 'purchase', label: 'Store / Consumables Purchase', hint: 'Several items bought across shops; each line is a shop memo (shop + memo no + amount). No qty/rate, no single vendor bill.' },
  { value: 'itemised', label: 'Itemised (qty × rate)', hint: 'Primes a qty × rate breakdown grid (Dinner per head, labour per unit).' },
  { value: 'handover', label: 'Fund handover', hint: 'Single amount, no vendor bill, handed-over/received signatures (Courier handover).' }
]

// Finance master data. The Expense Head master is the proper, managed source of
// expense heads — vouchers pick from the active heads here rather than typing a
// category inline — and each head configures how the voucher form adapts when
// it's selected. Opening balance seeds the cash-book's brought-down figure.
export function FinanceSetup() {
  const { currentClientId, can } = useAuth()
  const notify = useUI(s => s.notify)
  const canCreate = can('finance.create'), canEdit = can('finance.edit'), canDelete = can('finance.delete')
  const { data: heads, refresh } = useCollection('finance_expense_categories', { order: 'name', ascending: true })
  const { data: openings, refresh: refreshOpenings } = useCollection('finance_balance_adjustments', { order: 'adjustment_date', ascending: true })
  const [editing, setEditing] = useState<any>(null)
  const [deleting, setDeleting] = useState<any>(null)
  const [opening, setOpening] = useState(false)

  const toggleActive = async (h: any) => {
    const { error } = await supabase.from('finance_expense_categories').update({ is_active: !h.is_active }).eq('id', h.id)
    if (error) { notify('error', error.message); return }
    notify('success', `${h.name} ${h.is_active ? 'deactivated' : 'activated'}`); refresh()
  }

  const modeLabel = (v: string) => MODES.find(m => m.value === v)?.label ?? 'Single amount'

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <Card className="p-4">
        <SectionHeader icon="sell" title="Expense Heads"
          action={canCreate && <Button size="sm" variant="secondary" icon="add" onClick={() => setEditing({ code: '', name: '', is_active: true, voucher_mode: 'single', default_line_signature: false, default_sign_labels: '', owner_copy_required: false })}>New Head</Button>} />
        <div className="overflow-x-auto">
          <div className="min-w-[640px] overflow-hidden rounded-xl border border-surface-line">
            <div className="grid grid-cols-[100px_1fr_130px_120px_80px_80px] gap-2 border-b border-surface-line bg-surface-sunken px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              <span>Code</span><span>Name</span><span>Voucher Behaviour</span><span>Options</span><span>Status</span><span className="text-right">Action</span>
            </div>
            {(heads as any[]).length === 0 ? (
              <p className="p-4 text-sm text-ink-faint">No expense heads yet. Add the heads your warehouse spends under (e.g. Accommodation Rent, Fuel, Labour, Courier, Stationery) — vouchers will pick from these.</p>
            ) : (heads as any[]).map((h, i) => (
              <div key={h.id} className={'grid grid-cols-[100px_1fr_130px_120px_80px_80px] items-center gap-2 px-3 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                <span className="font-mono text-xs text-ink-soft">{h.code || '—'}</span>
                <span className={'font-medium ' + (h.is_active ? 'text-ink' : 'text-ink-faint line-through')}>{h.name}</span>
                <span className="text-xs text-ink-soft">{modeLabel(h.voucher_mode)}</span>
                <span className="flex flex-wrap gap-1">
                  {h.default_line_signature && <Badge tone="neutral">Per-line sign</Badge>}
                  {h.owner_copy_required && <Badge tone="neutral">Owner copy</Badge>}
                  {!h.default_line_signature && !h.owner_copy_required && <span className="text-ink-faint">—</span>}
                </span>
                <span><Badge tone={h.is_active ? 'positive' : 'neutral'}>{h.is_active ? 'Active' : 'Inactive'}</Badge></span>
                <span className="flex items-center justify-end gap-1">
                  {canEdit && <button title={h.is_active ? 'Deactivate' : 'Activate'} className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-sunken hover:text-ink" onClick={() => toggleActive(h)}><Icon name={h.is_active ? 'toggle_on' : 'toggle_off'} className="text-[18px]" /></button>}
                  {canEdit && <button title="Edit" className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-sunken hover:text-ink" onClick={() => setEditing(h)}><Icon name="edit" className="text-[18px]" /></button>}
                  {canDelete && <button title="Delete" className="rounded-lg p-1.5 text-ink-faint hover:bg-bad/10 hover:text-bad" onClick={() => setDeleting(h)}><Icon name="delete" className="text-[18px]" /></button>}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <SectionHeader icon="account_balance_wallet" title="Opening Balance"
          action={canCreate && <Button size="sm" variant="secondary" icon="add" onClick={() => setOpening(true)}>Set Opening Balance</Button>} />
        <p className="-mt-1 mb-3 text-xs text-ink-faint">
          The cash-in-hand carried into the module before any tracked receipt. Recorded as a balance adjustment; it seeds the cash book's brought-down figure.
        </p>
        {(openings as any[]).length === 0 ? (
          <p className="rounded-xl border border-dashed border-surface-line px-3 py-3 text-sm text-ink-faint">No opening balance / adjustments recorded.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-surface-line">
            <div className="grid grid-cols-[120px_1fr_130px] gap-2 border-b border-surface-line bg-surface-sunken px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              <span>Date</span><span>Remarks</span><span className="text-right">Amount (BDT)</span>
            </div>
            {(openings as any[]).map((o, i) => (
              <div key={o.id} className={'grid grid-cols-[120px_1fr_130px] items-center gap-2 px-3 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                <span className="text-ink-soft">{formatDate(o.adjustment_date)}</span>
                <span className="text-ink">{o.remarks || '—'}</span>
                <span className={'text-right font-semibold ' + (Number(o.amount) < 0 ? 'text-bad' : 'text-ink')}>{formatNumber(o.amount, 2)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {editing && <HeadForm record={editing.id ? editing : null} draft={editing} clientId={currentClientId!} notify={notify} onClose={() => setEditing(null)} onDone={() => { setEditing(null); refresh() }} />}
      {opening && <OpeningBalanceForm clientId={currentClientId!} notify={notify} onClose={() => setOpening(false)} onDone={() => { setOpening(false); refreshOpenings() }} />}
      <ConfirmDelete open={!!deleting} onClose={() => setDeleting(null)} name={deleting ? `Expense Head · ${deleting.name}` : undefined}
        onConfirm={async () => await supabase.from('finance_expense_categories').delete().eq('id', deleting.id)}
        onUndo={deleting ? async () => { await supabase.from('finance_expense_categories').insert({ client_id: currentClientId!, name: deleting.name, code: deleting.code, is_active: deleting.is_active, voucher_mode: deleting.voucher_mode, default_line_signature: deleting.default_line_signature, default_sign_labels: deleting.default_sign_labels, owner_copy_required: deleting.owner_copy_required }); refresh() } : undefined} />
    </div>
  )
}

function HeadForm({ record, draft, clientId, notify, onClose, onDone }: any) {
  const [h, setH] = useState<any>(record ?? draft)
  const [saving, setSaving] = useState(false)
  const set = (patch: any) => setH((x: any) => ({ ...x, ...patch }))
  const save = async () => {
    if (!h.name?.trim()) { notify('error', 'Enter the head name'); return }
    setSaving(true)
    const payload = {
      client_id: clientId, name: h.name.trim(), code: h.code?.trim() || null, is_active: h.is_active ?? true,
      voucher_mode: h.voucher_mode || 'single', default_line_signature: !!h.default_line_signature,
      default_sign_labels: h.default_sign_labels?.trim() || null, owner_copy_required: !!h.owner_copy_required
    }
    const res = record
      ? await supabase.from('finance_expense_categories').update(payload).eq('id', record.id)
      : await supabase.from('finance_expense_categories').insert(payload)
    setSaving(false)
    if (res.error) { notify('error', res.error.message); return }
    notify('success', `Expense head ${record ? 'updated' : 'added'}`); onDone()
  }
  return (
    <Modal open onClose={onClose} title={`${record ? 'Edit' : 'New'} Expense Head`} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Code"><Input value={h.code ?? ''} onChange={e => set({ code: e.target.value })} placeholder="e.g. FUEL, RENT" /></Field>
          <Field label="Name" required><Input value={h.name ?? ''} onChange={e => set({ name: e.target.value })} placeholder="e.g. Fuel, Accommodation Rent" /></Field>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-semibold text-ink">Voucher behaviour</p>
          <p className="mb-2.5 text-xs text-ink-faint">How the voucher form adapts when this head is picked. Everything stays overridable on the voucher itself.</p>
          <div className="space-y-2">
            {MODES.map(m => (
              <label key={m.value} className={'flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-sm ' + ((h.voucher_mode || 'single') === m.value ? 'border-brand-400 bg-brand-50 dark:bg-brand-500/10' : 'border-surface-line hover:bg-surface-sunken')}>
                <input type="radio" name="voucher_mode" className="mt-0.5" checked={(h.voucher_mode || 'single') === m.value} onChange={() => set({ voucher_mode: m.value })} />
                <span><span className="font-medium text-ink">{m.label}</span><span className="mt-0.5 block text-xs text-ink-soft">{m.hint}</span></span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2.5 rounded-xl border border-surface-line p-3">
          <label className="flex items-start gap-2 text-sm text-ink-soft">
            <input type="checkbox" className="mt-0.5" checked={!!h.default_line_signature} onChange={e => set({ default_line_signature: e.target.checked })} />
            <span>Per-line signature — add a signature column per breakdown line (e.g. each labourer signs). Turns on the voucher slip.</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-ink-soft">
            <input type="checkbox" className="mt-0.5" checked={!!h.owner_copy_required} onChange={e => set({ owner_copy_required: e.target.checked })} />
            <span>Owner / recipient copy required — reminds you to keep a signed copy (e.g. accommodation owner).</span>
          </label>
          <Field label="Default signature labels (comma separated)">
            <Input value={h.default_sign_labels ?? ''} onChange={e => set({ default_sign_labels: e.target.value })} placeholder="Leave blank to use the standard labels" />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" checked={h.is_active ?? true} onChange={e => set({ is_active: e.target.checked })} />
          Active — available for new vouchers
        </label>

        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button icon="save" loading={saving} onClick={save}>{record ? 'Update' : 'Add'}</Button>
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
    const { error } = await supabase.from('finance_balance_adjustments').insert({
      client_id: clientId, adjustment_date: o.adjustment_date || today(), amount: amt, remarks: o.remarks?.trim() || 'Opening Balance'
    })
    setSaving(false)
    if (error) { notify('error', error.message); return }
    notify('success', 'Opening balance recorded'); onDone()
  }
  return (
    <Modal open onClose={onClose} title="Set Opening Balance">
      <div className="space-y-4">
        <p className="text-xs text-ink-faint">Enter the cash-in-hand at the start. Use a negative amount only to correct/reduce the running balance.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Date" required><Input type="date" value={o.adjustment_date} onChange={e => setO({ ...o, adjustment_date: e.target.value })} /></Field>
          <Field label="Amount (BDT)" required><Input type="number" value={o.amount} onChange={e => setO({ ...o, amount: e.target.value })} placeholder="0.00" /></Field>
        </div>
        <Field label="Remarks"><Input value={o.remarks} onChange={e => setO({ ...o, remarks: e.target.value })} placeholder="Opening Balance" /></Field>
        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button icon="save" loading={saving} onClick={save}>Save</Button>
        </div>
      </div>
    </Modal>
  )
}

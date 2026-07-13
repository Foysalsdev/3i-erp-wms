import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { useCollection } from '@/hooks/useCollection'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Field, Input, Select } from '@/components/ui/Field'
import { formatNumber, formatDate } from '@/lib/utils'
import { StatCard, SectionHeader } from './components/FinanceUI'
import { isCredit, payeeKey, earliestDueDate } from './financeCash'

const today = () => new Date().toISOString().slice(0, 10)
const PAY_METHODS = ['Cash', 'Bank', 'bKash', 'Nagad', 'Card']
const daysOverdue = (dueDate: string) => Math.floor((Date.parse(today()) - Date.parse(dueDate)) / 86400000)

// Finance → Dues: accounts payable for Credit purchases. Outstanding per
// vendor/payee (free-text name, no master list) = Σ credit purchases − Σ
// recorded payments. Paying settles the due (and shows up in the Cash Book).
export function VendorDues() {
  const { data: rawExpenses } = useCollection('finance_expenses', { order: 'expense_date' })
  const { data: payments, refresh } = useCollection('finance_vendor_payments', { order: 'payment_date', ascending: false })
  const { currentClientId, can } = useAuth()
  const notify = useUI(s => s.notify)
  const canCreate = can('finance.create')
  const [paying, setPaying] = useState<{ payee_name?: string | null; amount?: number } | null>(null)
  const expenses = useMemo(() => rawExpenses.filter(e => !e.deleted_at && !e.is_draft), [rawExpenses])

  const rows = useMemo(() => {
    const credit = new Map<string, number>(), paid = new Map<string, number>(), display = new Map<string, string>()
    expenses.forEach(e => {
      const k = payeeKey(e.payee_name)
      if (isCredit(e) && k) { credit.set(k, (credit.get(k) ?? 0) + (Number(e.amount) || 0)); if (!display.has(k)) display.set(k, e.payee_name!.trim()) }
    })
    ;payments.forEach(p => {
      const k = payeeKey(p.payee_name)
      if (k) { paid.set(k, (paid.get(k) ?? 0) + (Number(p.amount) || 0)); if (!display.has(k)) display.set(k, p.payee_name!.trim()) }
    })
    const due = earliestDueDate(expenses, payments)
    const keys = new Set<string>([...credit.keys(), ...paid.keys()])
    return [...keys].map(k => ({
      key: k, name: display.get(k) || k, credit: credit.get(k) ?? 0, paid: paid.get(k) ?? 0,
      outstanding: (credit.get(k) ?? 0) - (paid.get(k) ?? 0), dueDate: due.get(k)
    })).sort((a, b) => b.outstanding - a.outstanding)
  }, [expenses, payments])

  const totalOutstanding = rows.reduce((s, r) => s + (r.outstanding > 0.004 ? r.outstanding : 0), 0)
  const duePayees = rows.filter(r => r.outstanding > 0.004).length
  const overdueCount = rows.filter(r => r.outstanding > 0.004 && r.dueDate && r.dueDate < today()).length
  const recent = payments.slice(0, 12)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon="request_quote" tone={totalOutstanding > 0.004 ? 'bad' : 'brand'} label="Total Payable" value={`${formatNumber(totalOutstanding, 2)} BDT`} />
        <StatCard icon="store" label="Vendors/Payees with dues" value={formatNumber(duePayees)} />
        <StatCard icon="event_busy" tone={overdueCount > 0 ? 'bad' : 'brand'} label="Overdue" value={formatNumber(overdueCount)} />
        <StatCard icon="payments" tone="ok" label="Paid (all time)" value={`${formatNumber(payments.reduce((s, p) => s + (Number(p.amount) || 0), 0), 2)} BDT`} />
      </div>

      <Card className="p-4">
        <SectionHeader icon="account_balance" title="Outstanding by vendor/payee" />
        <div className="overflow-x-auto">
          <div className="min-w-[640px] overflow-hidden rounded-xl border border-surface-line">
            <div className="grid grid-cols-[1fr_120px_120px_130px_140px_120px] gap-2 border-b border-surface-line bg-surface-sunken px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              <span>Vendor/Payee</span><span className="text-right">Credit Purchases</span><span className="text-right">Paid</span><span className="text-right">Outstanding</span><span>Due Date</span><span className="text-right">Action</span>
            </div>
            {rows.length === 0 ? <p className="p-4 text-sm text-ink-faint">No credit purchases yet. An expense with Payment = Credit shows here as a due.</p> :
              rows.map((r, i) => {
                const overdue = r.outstanding > 0.004 && !!r.dueDate && r.dueDate < today()
                return (
                  <div key={r.key} className={'grid grid-cols-[1fr_120px_120px_130px_140px_120px] items-center gap-2 px-3 py-2.5 text-sm tabular-nums ' + (i ? 'border-t border-surface-line' : '') + (overdue ? ' bg-bad/5' : '')}>
                    <span className="font-medium text-ink">{r.name}</span>
                    <span className="text-right text-ink-soft">{formatNumber(r.credit, 2)}</span>
                    <span className="text-right text-ink-soft">{formatNumber(r.paid, 2)}</span>
                    <span className={'text-right font-semibold ' + (r.outstanding > 0.004 ? 'text-bad' : 'text-ok')}>{formatNumber(r.outstanding, 2)}</span>
                    <span>{r.dueDate
                      ? <Badge tone={overdue ? 'negative' : 'neutral'}>{overdue ? `Overdue ${daysOverdue(r.dueDate)}d` : formatDate(r.dueDate)}</Badge>
                      : <span className="text-ink-faint">—</span>}</span>
                    <span className="text-right">
                      {canCreate && r.outstanding > 0.004 && <Button size="sm" variant="secondary" onClick={() => setPaying({ payee_name: r.name, amount: r.outstanding })}>Record Payment</Button>}
                    </span>
                  </div>
                )
              })}
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <SectionHeader icon="receipt_long" title="Recent payments"
          action={canCreate && <Button size="sm" variant="secondary" icon="add" onClick={() => setPaying({ payee_name: '', amount: undefined })}>Record Payment</Button>} />
        <div className="overflow-hidden rounded-xl border border-surface-line">
          {recent.length === 0 ? <p className="p-3 text-sm text-ink-faint">No payments recorded.</p> : recent.map((p, i) => (
            <div key={p.id} className={'flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
              <span className="min-w-0 truncate text-ink">{formatDate(p.payment_date)} · {p.payee_name || '—'}<span className="text-ink-faint">{p.method ? ` · ${p.method}` : ''}{p.remarks ? ` · ${p.remarks}` : ''}</span></span>
              <span className="shrink-0 font-semibold tabular-nums text-ink">{formatNumber(p.amount, 2)}</span>
            </div>
          ))}
        </div>
      </Card>

      {paying && <PaymentForm draft={paying} clientId={currentClientId!} notify={notify}
        onClose={() => setPaying(null)} onDone={() => { setPaying(null); refresh() }} />}
    </div>
  )
}

function PaymentForm({ draft, clientId, notify, onClose, onDone }: {
  draft: { payee_name?: string | null; amount?: number }; clientId: string
  notify: (kind: 'success' | 'error', msg: string) => void; onClose: () => void; onDone: () => void
}) {
  const [p, setP] = useState<{ payee_name: string; payment_date: string; amount: number | ''; method: string; remarks: string }>({ payee_name: draft.payee_name || '', payment_date: today(), amount: draft.amount ?? '', method: 'Cash', remarks: '' })
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!p.payee_name?.trim()) { notify('error', 'Enter the vendor/payee name'); return }
    if (!(Number(p.amount) > 0)) { notify('error', 'Enter a payment amount'); return }
    setSaving(true)
    const { error } = await supabase.from('finance_vendor_payments').insert({
       payee_name: p.payee_name.trim(), payment_date: p.payment_date || today(),
      amount: Number(p.amount), method: p.method || null, remarks: p.remarks?.trim() || null
    })
    setSaving(false)
    if (error) { notify('error', error.message); return }
    notify('success', 'Payment recorded'); onDone()
  }
  return (
    <Modal open onClose={onClose} title="Record Vendor/Payee Payment">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Vendor / Payee" required><Input value={p.payee_name} onChange={e => setP({ ...p, payee_name: e.target.value })} /></Field>
          <Field label="Date" required><Input type="date" value={p.payment_date} onChange={e => setP({ ...p, payment_date: e.target.value })} /></Field>
          <Field label="Amount (BDT)" required><Input type="number" value={p.amount} onChange={e => setP({ ...p, amount: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="0.00" /></Field>
          <Field label="Method">
            <Select value={p.method} onChange={e => setP({ ...p, method: e.target.value })}>{PAY_METHODS.map(m => <option key={m} value={m}>{m}</option>)}</Select>
          </Field>
          <Field label="Remarks" className="sm:col-span-2"><Input value={p.remarks} onChange={e => setP({ ...p, remarks: e.target.value })} placeholder="Optional" /></Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button icon="save" loading={saving} onClick={save}>Save Payment</Button>
        </div>
      </div>
    </Modal>
  )
}

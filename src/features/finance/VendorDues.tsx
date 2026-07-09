import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { useCollection } from '@/hooks/useCollection'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Field, Input, Select } from '@/components/ui/Field'
import { formatNumber, formatDate } from '@/lib/utils'
import { StatCard, SectionHeader } from './components/FinanceUI'
import { isCredit } from './financeCash'

const today = () => new Date().toISOString().slice(0, 10)
const PAY_METHODS = ['Cash', 'Bank', 'bKash', 'Nagad', 'Card']

// Finance → Dues: accounts payable for Credit purchases. Outstanding per vendor =
// Σ credit purchases − Σ recorded payments. Paying a vendor is the cash outflow
// that settles the due (and shows up in the Cash Book).
export function VendorDues() {
  const { data: expenses } = useCollection('finance_expenses', { order: 'expense_date' })
  const { data: payments, refresh } = useCollection('finance_vendor_payments', { order: 'payment_date', ascending: false })
  const { data: vendors } = useCollection('finance_vendors', { order: 'name', ascending: true })
  const { currentClientId, can } = useAuth()
  const notify = useUI(s => s.notify)
  const canCreate = can('finance.create')
  const [paying, setPaying] = useState<any>(null)
  const vendorName = (id?: string) => (vendors as any[]).find(v => v.id === id)?.name || '—'

  const rows = useMemo(() => {
    const credit = new Map<string, number>(), paid = new Map<string, number>()
    ;(expenses as any[]).forEach(e => { if (isCredit(e) && e.vendor_id) credit.set(e.vendor_id, (credit.get(e.vendor_id) ?? 0) + (Number(e.amount) || 0)) })
    ;(payments as any[]).forEach(p => { if (p.vendor_id) paid.set(p.vendor_id, (paid.get(p.vendor_id) ?? 0) + (Number(p.amount) || 0)) })
    const ids = new Set<string>([...credit.keys(), ...paid.keys()])
    return [...ids].map(id => ({ vendor_id: id, name: vendorName(id), credit: credit.get(id) ?? 0, paid: paid.get(id) ?? 0, outstanding: (credit.get(id) ?? 0) - (paid.get(id) ?? 0) }))
      .sort((a, b) => b.outstanding - a.outstanding)
  }, [expenses, payments, vendors])

  const totalOutstanding = rows.reduce((s, r) => s + (r.outstanding > 0.004 ? r.outstanding : 0), 0)
  const dueVendors = rows.filter(r => r.outstanding > 0.004).length
  const recent = (payments as any[]).slice(0, 12)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard icon="request_quote" tone={totalOutstanding > 0.004 ? 'bad' : 'brand'} label="Total Payable" value={`${formatNumber(totalOutstanding, 2)} BDT`} />
        <StatCard icon="store" label="Vendors with dues" value={formatNumber(dueVendors)} />
        <StatCard icon="payments" tone="ok" label="Paid (all time)" value={`${formatNumber((payments as any[]).reduce((s, p) => s + (Number(p.amount) || 0), 0), 2)} BDT`} />
      </div>

      <Card className="p-4">
        <SectionHeader icon="account_balance" title="Outstanding by vendor" />
        <div className="overflow-x-auto">
          <div className="min-w-[560px] overflow-hidden rounded-xl border border-surface-line">
            <div className="grid grid-cols-[1fr_120px_120px_130px_120px] gap-2 border-b border-surface-line bg-surface-sunken px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              <span>Vendor</span><span className="text-right">Credit Purchases</span><span className="text-right">Paid</span><span className="text-right">Outstanding</span><span className="text-right">Action</span>
            </div>
            {rows.length === 0 ? <p className="p-4 text-sm text-ink-faint">No credit purchases yet. A procurement with Payment = Credit shows here as a vendor due.</p> :
              rows.map((r, i) => (
                <div key={r.vendor_id} className={'grid grid-cols-[1fr_120px_120px_130px_120px] items-center gap-2 px-3 py-2.5 text-sm tabular-nums ' + (i ? 'border-t border-surface-line' : '')}>
                  <span className="font-medium text-ink">{r.name}</span>
                  <span className="text-right text-ink-soft">{formatNumber(r.credit, 2)}</span>
                  <span className="text-right text-ink-soft">{formatNumber(r.paid, 2)}</span>
                  <span className={'text-right font-semibold ' + (r.outstanding > 0.004 ? 'text-bad' : 'text-ok')}>{formatNumber(r.outstanding, 2)}</span>
                  <span className="text-right">
                    {canCreate && r.outstanding > 0.004 && <Button size="sm" variant="secondary" onClick={() => setPaying({ vendor_id: r.vendor_id, name: r.name, amount: r.outstanding })}>Record Payment</Button>}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <SectionHeader icon="receipt_long" title="Recent payments"
          action={canCreate && <Button size="sm" variant="secondary" icon="add" onClick={() => setPaying({ vendor_id: '', name: '', amount: undefined })}>Record Payment</Button>} />
        <div className="overflow-hidden rounded-xl border border-surface-line">
          {recent.length === 0 ? <p className="p-3 text-sm text-ink-faint">No payments recorded.</p> : recent.map((p, i) => (
            <div key={p.id} className={'flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
              <span className="min-w-0 truncate text-ink">{formatDate(p.payment_date)} · {vendorName(p.vendor_id)}<span className="text-ink-faint">{p.method ? ` · ${p.method}` : ''}{p.remarks ? ` · ${p.remarks}` : ''}</span></span>
              <span className="shrink-0 font-semibold tabular-nums text-ink">{formatNumber(p.amount, 2)}</span>
            </div>
          ))}
        </div>
      </Card>

      {paying && <PaymentForm draft={paying} vendors={vendors} clientId={currentClientId!} notify={notify}
        onClose={() => setPaying(null)} onDone={() => { setPaying(null); refresh() }} />}
    </div>
  )
}

function PaymentForm({ draft, vendors, clientId, notify, onClose, onDone }: any) {
  const [p, setP] = useState<any>({ vendor_id: draft.vendor_id || '', payment_date: today(), amount: draft.amount ?? '', method: 'Cash', remarks: '' })
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!p.vendor_id) { notify('error', 'Select a vendor'); return }
    if (!(Number(p.amount) > 0)) { notify('error', 'Enter a payment amount'); return }
    setSaving(true)
    const { error } = await supabase.from('finance_vendor_payments').insert({
      client_id: clientId, vendor_id: p.vendor_id, payment_date: p.payment_date || today(),
      amount: Number(p.amount), method: p.method || null, remarks: p.remarks?.trim() || null
    })
    setSaving(false)
    if (error) { notify('error', error.message); return }
    notify('success', 'Payment recorded'); onDone()
  }
  return (
    <Modal open onClose={onClose} title="Record Vendor Payment">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Vendor" required>
            <Select value={p.vendor_id} onChange={e => setP({ ...p, vendor_id: e.target.value })}>
              <option value="">Select…</option>
              {(vendors as any[]).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </Select>
          </Field>
          <Field label="Date" required><Input type="date" value={p.payment_date} onChange={e => setP({ ...p, payment_date: e.target.value })} /></Field>
          <Field label="Amount (BDT)" required><Input type="number" value={p.amount} onChange={e => setP({ ...p, amount: e.target.value })} placeholder="0.00" /></Field>
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

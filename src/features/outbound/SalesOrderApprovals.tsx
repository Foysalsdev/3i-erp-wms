import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { useCollection } from '@/hooks/useCollection'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ActionMenu } from '@/components/ui/ActionMenu'
import { BulkActionBar } from '@/components/ui/BulkActionBar'
import { Modal } from '@/components/ui/Modal'
import { Field, Textarea } from '@/components/ui/Field'
import { SearchBar } from '@/components/shared/SearchBar'
import { formatNumber, formatDate } from '@/lib/utils'
import { NotesPanel } from '@/features/masters/components/Panels'
import { OrderLinesPreview, type ProductMini } from './OutboundSalesOrders'
import type { Tables } from '@/types/database.types'

type SalesOrder = Tables<'sales_orders'>
type CustomerMini = Pick<Tables<'customers'>, 'id' | 'customer_code' | 'name'>
type Notify = (kind: 'success' | 'error' | 'info', msg: string) => void

const paymentTone = (s: string) => s === 'paid' ? 'positive' : s === 'partial' ? 'info' : 'neutral'

// Dedicated review queue for orders sales has submitted (status 'pending').
// Kept separate from the main Sales Order list because approval is a
// distinct access (outbound.approve, e.g. Warehouse Manager) from general
// order editing (outbound.edit, e.g. Sales) — see OutboundPage.tsx gating.
// Stock only becomes committed once an order leaves 'pending' (see
// lib/stockAvailability.ts's PENDING_INVOICE_STATUSES starting at 'approved'),
// so a stray/junk order sitting here never blocks anyone else from ordering
// the same stock — exactly why the hold has to wait for this step.
export function SalesOrderApprovals() {
  const { data, loading, refresh } = useCollection('sales_orders', { order: 'created_at' })
  const { currentClientId, session } = useAuth()
  const notify = useUI(s => s.notify)
  const [q, setQ] = useState('')
  const [customers, setCustomers] = useState<CustomerMini[]>([])
  const [products, setProducts] = useState<ProductMini[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [reviewing, setReviewing] = useState<SalesOrder | null>(null)
  const [rejecting, setRejecting] = useState<SalesOrder | null>(null)

  useEffect(() => {
    if (!currentClientId) return
    supabase.from('customers').select('id,customer_code,name').eq('client_id', currentClientId).then(({ data }) => setCustomers(data ?? []))
    supabase.from('products').select('id,material_code,name').eq('client_id', currentClientId).then(({ data }) => setProducts(data ?? []))
  }, [currentClientId])

  const customerName = (id: string | null) => { const c = customers.find(x => x.id === id); return c ? `${c.customer_code} — ${c.name}` : '—' }

  const rows = useMemo(() => {
    const pending = data.filter(r => r.status === 'pending')
    if (!q.trim()) return pending
    const t = q.toLowerCase()
    return pending.filter(r => String(r.so_no ?? '').toLowerCase().includes(t) || customerName(r.customer_id).toLowerCase().includes(t))
  }, [data, q, customers])

  const approveOne = async (r: SalesOrder) => {
    const { error } = await supabase.from('sales_orders')
      .update({ status: 'approved', approved_by: session?.user.id ?? null, approved_at: new Date().toISOString() })
      .eq('id', r.id)
    if (error) notify('error', error.message)
    else { notify('success', `${r.so_no} approved — ready for picking`); refresh() }
  }

  const toggleOne = (id: string) => setChecked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = (ids: string[]) => setChecked(prev => {
    const allIn = ids.every(id => prev.has(id))
    const n = new Set(prev)
    ids.forEach(id => allIn ? n.delete(id) : n.add(id))
    return n
  })
  const selectedRows = rows.filter(r => checked.has(r.id))
  const bulkApprove = async () => {
    const ids = selectedRows.map(r => r.id)
    if (!ids.length) return
    const { error } = await supabase.from('sales_orders')
      .update({ status: 'approved', approved_by: session?.user.id ?? null, approved_at: new Date().toISOString() })
      .in('id', ids)
    if (error) notify('error', error.message)
    else { notify('success', `${ids.length} order(s) approved`); setChecked(new Set()); refresh() }
  }

  const columns: Column<SalesOrder>[] = [
    { key: 'so_no', header: 'SO No', accessor: r => r.so_no, sortable: true, className: 'font-medium' },
    { key: 'customer', header: 'Customer', accessor: r => customerName(r.customer_id), sortable: true },
    { key: 'order_date', header: 'Date', accessor: r => r.order_date, render: r => formatDate(r.order_date), sortable: true },
    { key: 'qty', header: 'Qty', accessor: r => r.total_qty, render: r => formatNumber(r.total_qty), className: 'text-right', sortable: true },
    { key: 'amount', header: 'Amount', accessor: r => r.total_amount, render: r => formatNumber(r.total_amount), className: 'text-right', sortable: true },
    { key: 'payment', header: 'Payment', render: r => (
      <div className="flex items-center gap-1.5">
        <Badge tone={paymentTone(r.payment_status ?? 'unpaid')}>{r.payment_status ?? 'unpaid'}</Badge>
        {Number(r.deposited_amount) > 0 && <span className="text-xs text-ink-soft">{formatNumber(r.deposited_amount)}</span>}
      </div>
    ) },
    {
      key: '__actions', header: '', className: 'w-px whitespace-nowrap',
      render: r => (
        <div className="flex justify-end" onClick={e => e.stopPropagation()}>
          <ActionMenu items={[
            { icon: 'visibility', label: 'Review', onClick: () => setReviewing(r) },
            { icon: 'how_to_reg', label: 'Approve', onClick: () => approveOne(r) },
            { icon: 'block', label: 'Reject', tone: '!text-bad hover:!text-bad hover:!bg-bad/10', onClick: () => setRejecting(r) }
          ]} />
        </div>
      )
    }
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-72"><SearchBar value={q} onChange={setQ} placeholder="Search SO or customer…" /></div>
        <span className="text-sm text-ink-soft">{rows.length} order{rows.length === 1 ? '' : 's'} awaiting approval</span>
      </div>

      <BulkActionBar count={selectedRows.length} onClear={() => setChecked(new Set())} actions={[
        { icon: 'how_to_reg', label: 'Approve selected', onClick: bulkApprove }
      ]} />

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DataTable fill columns={columns} rows={rows} loading={loading} rowKey={r => r.id}
          emptyTitle="Nothing waiting on approval" emptyIcon="task_alt"
          emptyHint="Orders sales submits stay here until approved or rejected — they never reach the warehouse before that."
          selection={{ selected: checked, onToggle: toggleOne, onToggleAll: toggleAll }}
          expand={{ render: (r: SalesOrder) => <OrderLinesPreview so={r} products={products} onView={() => setReviewing(r)} /> }} />
      </Card>

      {reviewing && (
        <ReviewModal so={reviewing} customerName={customerName(reviewing.customer_id)} products={products}
          onApprove={() => { approveOne(reviewing); setReviewing(null) }}
          onReject={() => { setRejecting(reviewing); setReviewing(null) }}
          onClose={() => setReviewing(null)} />
      )}

      {rejecting && (
        <RejectModal so={rejecting} notify={notify}
          onClose={() => setRejecting(null)} onDone={() => { setRejecting(null); refresh() }} />
      )}
    </div>
  )
}

// The "small cart" — order header + line items + the running note/comment
// thread — everything an approver needs before deciding, in one place.
function ReviewModal({ so, customerName, products, onApprove, onReject, onClose }: {
  so: SalesOrder; customerName: string; products: ProductMini[]
  onApprove: () => void; onReject: () => void; onClose: () => void
}) {
  const [items, setItems] = useState<Tables<'sales_order_items'>[]>([])
  useEffect(() => { supabase.from('sales_order_items').select('*').eq('so_id', so.id).then(({ data }) => setItems(data ?? [])) }, [so.id])
  const productLabel = (id: string | null) => { const p = products.find(x => x.id === id); return p ? `${p.material_code} — ${p.name}` : id ?? '—' }

  const Stat = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="min-w-0"><p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{label}</p><div className="mt-0.5 text-sm font-medium text-ink break-words">{value}</div></div>
  )

  return (
    <Modal open onClose={onClose} title={`Review — ${so.so_no}`} size="lg">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-surface-line bg-surface-sunken/40 p-4 sm:grid-cols-3">
          <Stat label="Customer" value={customerName} />
          <Stat label="Order Date" value={formatDate(so.order_date)} />
          <Stat label="Customer PO" value={so.reference_no ?? '—'} />
          <Stat label="Total Qty" value={formatNumber(so.total_qty)} />
          <Stat label="Total Amount" value={formatNumber(so.total_amount)} />
          <Stat label="Payment" value={
            <span className="flex items-center gap-1.5">
              <Badge tone={paymentTone(so.payment_status ?? 'unpaid')}>{so.payment_status ?? 'unpaid'}</Badge>
              {Number(so.deposited_amount) > 0 && <span>{formatNumber(so.deposited_amount)} deposited{so.deposited_date ? ` (${formatDate(so.deposited_date)})` : ''}</span>}
            </span>
          } />
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Order (cart)</p>
          <div className="overflow-hidden rounded-xl border border-surface-line">
            {items.length === 0 ? <p className="p-3 text-sm text-ink-faint">No items</p> :
              items.map((it, i) => (
                <div key={it.id} className={'flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                  <span className="min-w-0 truncate text-ink">{productLabel(it.product_id)}</span>
                  <span className="shrink-0 text-ink-soft">{formatNumber(it.qty)} × {formatNumber(it.unit_price)} = <b className="text-ink">{formatNumber(it.line_total)}</b></span>
                </div>
              ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Notes</p>
          <NotesPanel entityType="sales_orders" entityId={so.id} />
        </div>

        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="danger" icon="block" onClick={onReject}>Reject</Button>
          <Button icon="how_to_reg" onClick={onApprove}>Approve</Button>
        </div>
      </div>
    </Modal>
  )
}

// Rejection always records a reason — the reject action itself, not the
// freeform Notes thread, is the one-time structured "why" for the decision.
function RejectModal({ so, notify, onClose, onDone }: { so: SalesOrder; notify: Notify; onClose: () => void; onDone: () => void }) {
  const { session } = useAuth()
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    if (!reason.trim()) { notify('error', 'A rejection reason is required'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('sales_orders').update({
        status: 'rejected', rejected_by: session?.user.id ?? null, rejected_at: new Date().toISOString(), rejection_reason: reason.trim()
      }).eq('id', so.id)
      if (error) throw error
      notify('success', `${so.so_no} rejected`)
      onDone()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not reject order')
    } finally { setSaving(false) }
  }
  return (
    <Modal open onClose={onClose} title={`Reject — ${so.so_no}`} size="md">
      <div className="space-y-4">
        <Field label="Reason" required>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is this order being rejected? Sales will see this." autoFocus />
        </Field>
        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" icon="block" loading={saving} onClick={submit}>Reject Order</Button>
        </div>
      </div>
    </Modal>
  )
}

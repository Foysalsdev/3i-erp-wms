import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { useCollection } from '@/hooks/useCollection'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { ActionMenu } from '@/components/ui/ActionMenu'
import { ConfirmDelete } from '@/components/ui/ConfirmDelete'
import { SearchBar } from '@/components/shared/SearchBar'
import { formatNumber, formatDate } from '@/lib/utils'
import { downloadBillVoucherPDF } from '@/pdf/FinancePDF'
import { useAutoOpen } from '@/hooks/useAutoOpen'
import { StatCard, SectionHeader } from './components/FinanceUI'
import { ProcurementForm } from './ProcurementForm'

const today = () => new Date().toISOString().slice(0, 10)

// Finance → Procurement: daily-operation purchases. Each row is one bill/vendor
// with its items; the fast entry form lives in ProcurementForm.
export function Expenses() {
  const { data, loading, refresh } = useCollection('finance_expenses', { order: 'created_at', ascending: false })
  const { data: vendors, refresh: refreshVendors } = useCollection('finance_vendors', { order: 'name', ascending: true })
  const { data: items, refresh: refreshItems } = useCollection('finance_items', { order: 'name', ascending: true })
  const { data: categories } = useCollection('finance_expense_categories', { order: 'name', ascending: true })
  const { currentClientId, can, isPlatformAdmin } = useAuth()
  const notify = useUI(s => s.notify)
  const canCreate = can('finance.create'), canEdit = can('finance.edit')
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  useAutoOpen(() => { setEditing(null); setModal(true) })
  const [viewing, setViewing] = useState<any>(null)
  const [deleting, setDeleting] = useState<any>(null)

  const vendorName = (id?: string) => (vendors as any[]).find(v => v.id === id)?.name
  const refreshMasters = () => { refreshVendors(); refreshItems() }

  const fetchLines = async (expId: string) => {
    const [{ data: bills }, { data: extra }] = await Promise.all([
      supabase.from('finance_expense_bills').select('*').eq('expense_id', expId).order('created_at'),
      supabase.from('finance_additional_expenses').select('*').eq('expense_id', expId).order('created_at')
    ])
    const __items = (bills ?? []).map((b: any) => ({ item_id: b.item_id || '', name: b.bill_ref || '', category_id: b.category_id || '', unit: b.unit || '', qty: b.qty != null ? Number(b.qty) : undefined, rate: b.rate != null ? Number(b.rate) : undefined }))
    const __addl = (extra ?? []).map((a: any) => ({ expense_type: a.expense_type || '', amount: a.amount != null ? Number(a.amount) : undefined }))
    return { __items, __addl }
  }

  const openView = async (r: any) => setViewing({ ...r, ...(await fetchLines(r.id)) })
  const openEdit = async (r: any) => { setEditing({ ...r, ...(await fetchLines(r.id)) }); setModal(true) }
  const duplicate = async (r: any) => {
    const { __items, __addl } = await fetchLines(r.id)
    setEditing({ procurement_type: r.procurement_type, department: r.department, payment_mode: r.payment_mode, vendor_id: r.vendor_id, expense_date: today(), __items, __addl })
    setModal(true)
  }

  const printBill = async (r: any) => {
    try {
      const { __items, __addl } = await fetchLines(r.id)
      const lines = [
        ...__items.map((it: any) => ({ particulars: it.name || '—', unit: it.unit || undefined, qty: it.qty ?? undefined, rate: it.rate ?? undefined, amount: (Number(it.qty) || 0) * (Number(it.rate) || 0) })),
        ...__addl.map((a: any) => ({ particulars: a.expense_type || 'Additional', amount: Number(a.amount) || 0 }))
      ]
      await downloadBillVoucherPDF({
        title: r.procurement_type || 'Procurement',
        billRef: r.doc_no || r.id.slice(0, 8).toUpperCase(),
        date: formatDate(r.expense_date),
        payee: vendorName(r.vendor_id) || r.payee_name || undefined,
        purpose: [r.department, r.description].filter(Boolean).join(' · ') || undefined,
        lines: lines.length ? lines : [{ particulars: 'Procurement', amount: Number(r.amount) || 0 }],
        lessDeduction: 0,
        signLabels: ['Prepared By', 'Verified By', 'Approved By', 'Head Office']
      })
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not generate the PDF')
    }
  }

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return data as any[]
    return (data as any[]).filter(r =>
      String(r.doc_no ?? '').toLowerCase().includes(t) ||
      String(vendorName(r.vendor_id) ?? r.payee_name ?? '').toLowerCase().includes(t) ||
      String(r.department ?? '').toLowerCase().includes(t) ||
      String(r.procurement_type ?? '').toLowerCase().includes(t))
  }, [data, q, vendors])

  const columns = [
    { key: 'doc_no', header: 'Procurement No', render: (r: any) => <span className="font-medium">{r.doc_no || '—'}</span> },
    { key: 'expense_date', header: 'Date', render: (r: any) => formatDate(r.expense_date), sortable: true },
    { key: 'procurement_type', header: 'Type', render: (r: any) => r.procurement_type || '—' },
    { key: 'vendor', header: 'Vendor', render: (r: any) => vendorName(r.vendor_id) || r.payee_name || '—' },
    { key: 'department', header: 'Department', render: (r: any) => r.department || '—' },
    { key: 'payment_mode', header: 'Payment', render: (r: any) => r.payment_mode || '—' },
    { key: 'amount', header: 'Total (BDT)', accessor: (r: any) => formatNumber(r.amount, 2), className: 'text-right' },
    {
      key: '__a', header: '', className: 'w-px whitespace-nowrap',
      render: (r: any) => (
        <div className="flex justify-end" onClick={e => e.stopPropagation()}>
          <ActionMenu items={[
            { icon: 'visibility', label: 'View', onClick: () => openView(r) },
            { icon: 'receipt_long', label: 'Generate PDF', onClick: () => printBill(r) },
            ...(canCreate ? [{ icon: 'content_copy', label: 'Duplicate', onClick: () => duplicate(r) }] : []),
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
        <div className="w-full sm:w-72"><SearchBar value={q} onChange={setQ} placeholder="Search procurement no, vendor, department…" /></div>
        <span className="text-sm text-ink-soft">{rows.length} records</span>
        {canCreate && <Button className="ml-auto" icon="add" onClick={() => { setEditing(null); setModal(true) }}>New Procurement</Button>}
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DataTable fill columns={columns} rows={rows} loading={loading} rowKey={(r: any) => r.id}
          onRowClick={canEdit ? openEdit : openView} emptyTitle="No procurement recorded yet" />
      </Card>

      {modal && (
        <ProcurementForm record={editing} clientId={currentClientId!} vendors={vendors} items={items} categories={categories}
          onMastersChanged={refreshMasters} notify={notify} onClose={() => setModal(false)} onDone={() => { setModal(false); refresh() }} />
      )}

      {viewing && (
        <ProcurementOverview p={viewing} vendorName={vendorName(viewing.vendor_id) || viewing.payee_name} canEdit={canEdit}
          onEdit={() => { const r = viewing; setViewing(null); openEdit(r) }}
          onPrint={() => printBill(viewing)} onClose={() => setViewing(null)} />
      )}

      <ConfirmDelete open={!!deleting} onClose={() => setDeleting(null)}
        name={deleting ? `Procurement · ${deleting.doc_no || formatDate(deleting.expense_date)}` : undefined}
        onConfirm={async () => {
          const res = await supabase.from('finance_expenses').delete().eq('id', deleting.id)
          if (!res.error) { setDeleting(null); refresh() }
          return res
        }} />
    </div>
  )
}

function ProcurementOverview({ p, vendorName, canEdit, onEdit, onPrint, onClose }: any) {
  const items: any[] = p.__items ?? []
  const addl: any[] = p.__addl ?? []
  const subtotal = items.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.rate) || 0), 0)
  const addlTotal = addl.reduce((s, a) => s + (Number(a.amount) || 0), 0)
  return (
    <Modal open onClose={onClose} title={`Procurement — ${p.doc_no || ''}`} size="lg">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard icon="calendar_month" label="Date" value={formatDate(p.expense_date)} />
          <StatCard icon="local_shipping" label="Vendor" value={vendorName || '—'} />
          <StatCard icon="sell" label="Type" value={p.procurement_type || '—'} />
          <StatCard icon="account_balance" label="Payment" value={p.payment_mode || '—'} />
          <StatCard icon="apartment" label="Department" value={p.department || '—'} />
          <StatCard icon="payments" tone="bad" label="Total" value={`${formatNumber(p.amount, 2)} BDT`} />
        </div>
        <div>
          <SectionHeader icon="inventory_2" title="Items" />
          <div className="overflow-hidden rounded-xl border border-surface-line">
            {items.length === 0 ? <p className="p-3 text-sm text-ink-faint">No items</p> : items.map((it, i) => (
              <div key={i} className={'flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                <span className="text-ink">{it.name || '—'}<span className="text-ink-faint"> · {it.qty ?? ''} {it.unit ?? ''} × {formatNumber(it.rate, 2)}</span></span>
                <span className="font-semibold tabular-nums text-ink">{formatNumber((Number(it.qty) || 0) * (Number(it.rate) || 0), 2)}</span>
              </div>
            ))}
          </div>
        </div>
        {addl.length > 0 && <div>
          <SectionHeader icon="add_card" title="Additional Expenses" />
          <div className="overflow-hidden rounded-xl border border-surface-line">
            {addl.map((a, i) => (
              <div key={i} className={'flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                <span className="text-ink">{a.expense_type || '—'}</span><span className="font-semibold tabular-nums text-ink">{formatNumber(a.amount, 2)}</span>
              </div>
            ))}
          </div>
        </div>}
        <div className="flex flex-col items-end gap-1 text-sm">
          <div className="flex w-full max-w-xs justify-between"><span className="text-ink-soft">Subtotal</span><span className="tabular-nums">{formatNumber(subtotal, 2)}</span></div>
          <div className="flex w-full max-w-xs justify-between"><span className="text-ink-soft">Additional</span><span className="tabular-nums">{formatNumber(addlTotal, 2)}</span></div>
          <div className="flex w-full max-w-xs justify-between border-t border-surface-line pt-1"><span className="font-semibold">Grand Total</span><span className="font-bold tabular-nums text-brand-700 dark:text-brand-300">{formatNumber(p.amount, 2)} BDT</span></div>
        </div>
        {p.description && <p className="text-sm text-ink-soft"><span className="text-ink-faint">Remarks: </span>{p.description}</p>}
        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="secondary" icon="receipt_long" onClick={onPrint}>Generate PDF</Button>
          {canEdit && <Button icon="edit" onClick={onEdit}>Edit</Button>}
        </div>
      </div>
    </Modal>
  )
}

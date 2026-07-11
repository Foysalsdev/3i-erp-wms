import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { useCollection } from '@/hooks/useCollection'
import { nextDocNumber } from '@/hooks/useDocNumber'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ActionMenu } from '@/components/ui/ActionMenu'
import { ConfirmDelete } from '@/components/ui/ConfirmDelete'
import { SearchBar } from '@/components/shared/SearchBar'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { formatNumber, formatDate } from '@/lib/utils'
import type { ReqLine } from '@/pdf/FinancePDF'
import { SUBMITTED_TO, type FundReceipt } from './financeCash'
import type { Tables } from '@/types/database.types'
import { downloadCSV, downloadReportPDF, ReportToolbar, type RepCol } from '@/features/reports/export'
import { useAutoOpen } from '@/hooks/useAutoOpen'
import { useRememberedField } from '@/hooks/useRememberedField'
import { SectionHeader, StatCard, FinancePanel } from './components/FinanceUI'
import { LineGrid, type LineColumn } from './components/LineGrid'
import { ExpenseForm } from './ExpenseForm'

const today = () => new Date().toISOString().slice(0, 10)
type Requisition = Tables<'finance_requisitions'>
type RequisitionLine = Tables<'finance_requisition_lines'>
type ReqView = Requisition & { __lines?: RequisitionLine[] }
type Notify = (kind: 'success' | 'error', msg: string) => void

const monthOf = (d: string) => (d ?? '').slice(0, 7)
const blankLine = (): ReqLine => ({ purpose: '', unit: '', qty: undefined, remarks: '', amount: undefined })
const REQ_COLUMNS: LineColumn[] = [
  { key: 'purpose', label: 'Purpose', width: '1fr', required: true, placeholder: 'e.g. Fuel for delivery vehicle' },
  { key: 'unit', label: 'Unit', width: '90px', placeholder: 'Ltr' },
  { key: 'qty', label: 'Qty', width: '70px', type: 'number' },
  { key: 'remarks', label: 'Note', width: '1fr' },
  { key: 'amount', label: 'Amount (BDT)', width: '120px', type: 'number', align: 'right', required: true }
]

export function Requisitions() {
  const { data, loading, refresh } = useCollection('finance_requisitions', { order: 'created_at' })
  const { data: allReceipts, refresh: refreshReceipts } = useCollection('finance_fund_receipts', { order: 'receipt_date' })
  const { currentClientId, can, isPlatformAdmin } = useAuth()
  const notify = useUI(s => s.notify)
  // Split by DB operation: RLS requires finance.create for inserts (new
  // requisitions, fund receipts) and finance.edit for updates — a role with
  // only one of the two should only see the actions that will actually pass.
  const canCreate = can('finance.create')
  const canEdit = can('finance.edit')
  const [q, setQ] = useState('')
  const [month, setMonth] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<ReqView | null>(null)
  useAutoOpen(() => { setEditing(null); setModal(true) })
  const [viewing, setViewing] = useState<ReqView | null>(null)
  const [deleting, setDeleting] = useState<Requisition | null>(null)
  const [converting, setConverting] = useState<{ req: Requisition; line: RequisitionLine } | null>(null)

  const receiptsFor = (reqId: string) => allReceipts.filter(r => r.requisition_id === reqId)
  const receivedTotal = (reqId: string) => receiptsFor(reqId).reduce((s, r) => s + (Number(r.amount) || 0), 0)

  const fetchLines = async (reqId: string) => {
    const { data: lines } = await supabase.from('finance_requisition_lines').select('*').eq('requisition_id', reqId).order('created_at')
    return lines ?? []
  }

  const openView = async (r: Requisition) => setViewing({ ...r, __lines: await fetchLines(r.id) })
  const openEdit = async (r: Requisition) => { const lines = await fetchLines(r.id); setEditing({ ...r, __lines: lines }); setModal(true) }

  const printReq = async (r: Requisition) => {
    try {
      const lines = await fetchLines(r.id)
      const { downloadRequisitionPDF } = await import('@/pdf/FinancePDF')  // lazy: pdf chunk loads on demand
      await downloadRequisitionPDF({
        docNo: r.req_no,
        meta: [
          { label: 'Requisition No', value: r.req_no },
          { label: 'Date', value: formatDate(r.req_date) },
          { label: 'Sent By', value: r.sender_name || '' },
          { label: 'Submitted To', value: SUBMITTED_TO },
          ...(r.remarks ? [{ label: 'Note', value: r.remarks, wide: true }] : [])
        ],
        lines: lines.map(l => ({ purpose: l.purpose, unit: l.unit ?? undefined, qty: l.qty ? Number(l.qty) : undefined, remarks: l.remarks ?? undefined, amount: Number(l.amount) || 0 })),
        grandTotal: Number(r.grand_total) || 0
      })
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not generate PDF — check the company logo URL in Settings')
    }
  }

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return data.filter(r =>
      (!month || monthOf(r.req_date) === month) &&
      (!t || String(r.req_no ?? '').toLowerCase().includes(t) || String(r.sender_name ?? '').toLowerCase().includes(t)))
  }, [data, q, month])

  // Filtered rows also drive the CSV / letterhead-PDF export (merged from the
  // old Registers tab).
  const exportCols: RepCol[] = [
    { key: 'no', header: 'Requisition No', width: '24%' }, { key: 'date', header: 'Date', width: '16%' },
    { key: 'sender', header: 'Sent By', width: '28%' }, { key: 'requested', header: 'Requested (BDT)', align: 'right', width: '16%' },
    { key: 'received', header: 'Received (BDT)', align: 'right', width: '16%' }
  ]
  const exportRows = useMemo(() => rows.map(r => ({
    no: r.req_no, date: formatDate(r.req_date), sender: r.sender_name || '—',
    requested: (Number(r.grand_total) || 0).toFixed(2), received: receivedTotal(r.id).toFixed(2)
  })), [rows, allReceipts])
  const exportTotal = rows.reduce((s, r) => s + (Number(r.grand_total) || 0), 0)
  const exportSubtitle = `Total requested ${formatNumber(exportTotal, 2)} BDT · ${rows.length} entries${month ? ` · ${month}` : ''}`

  const columns: Column<Requisition>[] = [
    { key: 'req_no', header: 'Requisition No', accessor: r => r.req_no, sortable: true, className: 'font-medium' },
    { key: 'req_date', header: 'Date', render: r => formatDate(r.req_date) },
    { key: 'sender_name', header: 'Sent By', render: r => r.sender_name || '—' },
    { key: 'grand_total', header: 'Requested', accessor: r => formatNumber(r.grand_total, 2), className: 'text-right' },
    { key: 'received', header: 'Received', render: r => formatNumber(receivedTotal(r.id), 2), className: 'text-right' },
    {
      key: '__a', header: '', className: 'w-px whitespace-nowrap',
      render: r => (
        <div className="flex justify-end" onClick={e => e.stopPropagation()}>
          <ActionMenu items={[
            { icon: 'visibility', label: 'View', onClick: () => openView(r) },
            { icon: 'print', label: 'Print', onClick: () => printReq(r) },
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
        <div className="w-full sm:w-60"><SearchBar value={q} onChange={setQ} placeholder="Search requisition…" /></div>
        <input type="month" className="fiori-input w-40" value={month} onChange={e => setMonth(e.target.value)} />
        {month && <button onClick={() => setMonth('')} className="text-xs text-ink-faint hover:text-ink">Clear</button>}
        <ReportToolbar count={rows.length} onCSV={() => downloadCSV('Requisition Register', exportCols, exportRows)} onPDF={() => downloadReportPDF('Requisition Register', exportSubtitle, exportCols, exportRows)} />
        {canCreate && <Button className="ml-auto" icon="add" onClick={() => { setEditing(null); setModal(true) }}>New Requisition</Button>}
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DataTable fill columns={columns} rows={rows} loading={loading} rowKey={r => r.id}
          onRowClick={canEdit ? openEdit : openView} emptyTitle="No requisitions yet" />
      </Card>

      {modal && (
        <ReqForm record={editing} clientId={currentClientId!} notify={notify}
          onClose={() => setModal(false)} onDone={() => { setModal(false); refresh() }} />
      )}

      {viewing && (
        <ReqOverview req={viewing} receipts={receiptsFor(viewing.id)} clientId={currentClientId!} canCreate={canCreate} canEdit={canEdit} notify={notify}
          onEdit={() => { const r = viewing; setViewing(null); openEdit(r) }}
          onPrint={() => printReq(viewing)}
          onReceiptAdded={() => { refreshReceipts(); openView(viewing) }}
          onConvertLine={(l: RequisitionLine) => setConverting({ req: viewing, line: l })}
          onClose={() => setViewing(null)} />
      )}

      {converting && (
        <ExpenseForm clientId={currentClientId!} items={[]} categories={[]} recentPayees={[]}
          record={{
            expense_type: 'Others', expense_date: today(), payment_mode: 'Cash', department: 'Warehouse',
            amount: Number(converting.line.amount) || undefined, doc_type: 'vendor_voucher',
            description: `${converting.line.purpose}${converting.req.req_no ? ` — from Requisition ${converting.req.req_no}` : ''}`
          }}
          notify={notify} onClose={() => setConverting(null)} onDone={() => setConverting(null)} />
      )}

      <ConfirmDelete open={!!deleting} onClose={() => setDeleting(null)}
        name={deleting ? `Requisition · ${deleting.req_no}` : undefined}
        onConfirm={async () => {
          const res = await supabase.from('finance_requisitions').delete().eq('id', deleting!.id)
          if (!res.error) { setDeleting(null); refresh() }
          return res
        }} />
    </div>
  )
}

function ReqForm({ record, clientId, notify, onClose, onDone }: {
  record: ReqView | null; clientId: string; notify: Notify; onClose: () => void; onDone: () => void
}) {
  const [rememberedSender, rememberSender] = useRememberedField('sender_name')
  const [h, setH] = useState<Partial<Requisition>>(record ?? { req_date: today(), sender_name: rememberedSender })
  const [lines, setLines] = useState<ReqLine[]>(record?.__lines?.length
    ? record.__lines.map(l => ({ purpose: l.purpose, unit: l.unit ?? '', qty: l.qty != null ? Number(l.qty) : undefined, remarks: l.remarks ?? '', amount: l.amount != null ? Number(l.amount) : undefined }))
    : [blankLine()])
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<Requisition>) => setH(x => ({ ...x, ...patch }))
  const grandTotal = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)

  const save = async () => {
    const valid = lines.filter(l => l.purpose.trim())
    if (!valid.length) { notify('error', 'Add at least one line with a purpose'); return }
    if (h.sender_name) rememberSender(h.sender_name)
    setSaving(true)
    try {
      const header = { client_id: clientId, req_date: h.req_date || today(), sender_name: h.sender_name || null, grand_total: grandTotal, remarks: h.remarks || null }
      let reqId = record?.id
      if (record) {
        const { error } = await supabase.from('finance_requisitions').update(header).eq('id', record.id)
        if (error) throw error
      } else {
        const req_no = await nextDocNumber(clientId, 'FREQ')
        if (!req_no) throw new Error('Could not generate requisition number')
        const { data, error } = await supabase.from('finance_requisitions').insert({ ...header, req_no }).select('id').single()
        if (error) throw error
        reqId = data.id
      }
      if (!reqId) throw new Error('Requisition id missing after save')
      await supabase.from('finance_requisition_lines').delete().eq('requisition_id', reqId)
      const payload = valid.map(l => ({
        client_id: clientId, requisition_id: reqId, purpose: l.purpose.trim(),
        amount: Number(l.amount) || 0, unit: l.unit || null, qty: l.qty ? Number(l.qty) : null, remarks: l.remarks || null
      }))
      const { error: lineErr } = await supabase.from('finance_requisition_lines').insert(payload)
      if (lineErr) throw lineErr
      notify('success', `Requisition ${record ? 'updated' : 'created'}`)
      onDone()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not save requisition')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`${record ? 'Edit' : 'New'} Operating Cost Requisition`} size="xl">
      <div className="space-y-4">
        {record && <div className="rounded-lg bg-surface-sunken px-3 py-2 text-sm"><span className="text-ink-faint">Requisition No: </span><span className="font-semibold">{record.req_no}</span></div>}
        <FinancePanel icon="assignment" title="Requisition Details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Date" required><Input type="date" value={h.req_date ?? ''} onChange={e => set({ req_date: e.target.value })} /></Field>
            <Field label="Sent By"><Input value={h.sender_name ?? ''} onChange={e => set({ sender_name: e.target.value })} placeholder="Deputy Manager name" /></Field>
            <Field label="Note" className="sm:col-span-2"><Textarea value={h.remarks ?? ''} onChange={e => set({ remarks: e.target.value })} /></Field>
          </div>
        </FinancePanel>

        <div>
          <SectionHeader icon="list_alt" title="Cost Purpose Lines"
            action={<Button size="sm" variant="secondary" icon="add" onClick={() => setLines(ls => [...ls, blankLine()])}>Add Line</Button>} />
          <LineGrid columns={REQ_COLUMNS} rows={lines} onChange={ls => setLines(ls as ReqLine[])} blank={blankLine}
            totalKey="amount" footerLabel="Grand Total (BDT)" minRows={1} />
        </div>

        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button icon="save" loading={saving} onClick={save}>{record ? 'Update' : 'Create'}</Button>
        </div>
      </div>
    </Modal>
  )
}

function ReqOverview({ req, receipts, clientId, canCreate, canEdit, notify, onEdit, onPrint, onReceiptAdded, onConvertLine, onClose }: {
  req: ReqView; receipts: FundReceipt[]; clientId: string; canCreate: boolean; canEdit: boolean; notify: Notify
  onEdit: () => void; onPrint: () => void; onReceiptAdded: () => void; onConvertLine: (l: RequisitionLine) => void; onClose: () => void
}) {
  const lines: RequisitionLine[] = req.__lines ?? []
  const [addingReceipt, setAddingReceipt] = useState(false)
  const receivedTotal = receipts.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const fullyReceived = receivedTotal >= Number(req.grand_total) - 0.004
  return (
    <Modal open onClose={onClose} title={`Requisition — ${req.req_no}`} size="lg">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon="calendar_month" label="Date" value={formatDate(req.req_date)} />
          <StatCard icon="person" label="Sent By" value={req.sender_name || '—'} />
          <StatCard icon="account_balance_wallet" label="Requested" value={`${formatNumber(req.grand_total, 2)} BDT`} />
          <StatCard icon="payments" tone="ok" label="Received" value={`${formatNumber(receivedTotal, 2)} BDT`} />
        </div>

        <div>
          <SectionHeader icon="list_alt" title="Cost Purpose Lines (pre-planning — nothing here is committed until converted to an Expense)" />
          <div className="overflow-hidden rounded-xl border border-surface-line">
            {lines.length === 0 ? <p className="p-3 text-sm text-ink-faint">No lines</p> :
              lines.map((l, i) => (
                <div key={l.id ?? i} className={'flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                  <span className="min-w-0 truncate text-ink">{l.purpose}{l.unit || l.qty ? <span className="text-ink-faint"> · {l.qty ?? ''} {l.unit ?? ''}</span> : null}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="font-semibold text-ink">{formatNumber(l.amount, 2)}</span>
                    {canCreate && <button type="button" onClick={() => onConvertLine(l)}
                      className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">Convert to Expense</button>}
                  </span>
                </div>
              ))}
          </div>
        </div>

        <div>
          <SectionHeader icon="payments" tone="ok" title="Fund Received"
            action={canCreate && !addingReceipt && (fullyReceived
              ? <span className="text-xs font-medium text-ok">Fully received</span>
              : <Button size="sm" variant="secondary" icon="add" onClick={() => setAddingReceipt(true)}>Add Receipt</Button>)} />
          {addingReceipt && (
            <AddReceiptRow requisitionId={req.id} clientId={clientId} notify={notify}
              remaining={Number(req.grand_total) - receivedTotal}
              onDone={() => { setAddingReceipt(false); onReceiptAdded() }} onCancel={() => setAddingReceipt(false)} />
          )}
          <div className="overflow-hidden rounded-xl border border-surface-line">
            {receipts.length === 0 && !addingReceipt ? <p className="p-3 text-sm text-ink-faint">No fund received yet</p> :
              receipts.map((r, i) => (
                <div key={r.id ?? i} className={'flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                  <span className="text-ink">{formatDate(r.receipt_date)}{r.remarks ? <span className="text-ink-faint"> · {r.remarks}</span> : null}</span>
                  <span className="font-semibold text-ink">{formatNumber(r.amount, 2)}</span>
                </div>
              ))}
          </div>
        </div>

        {req.remarks && <div><SectionHeader icon="sticky_note_2" title="Note" /><p className="-mt-1 text-sm text-ink-soft">{req.remarks}</p></div>}

        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="secondary" icon="print" onClick={onPrint}>Print</Button>
          {canEdit && <Button icon="edit" onClick={onEdit}>Edit</Button>}
        </div>
      </div>
    </Modal>
  )
}

function AddReceiptRow({ requisitionId, clientId, notify, remaining, onDone, onCancel }: {
  requisitionId: string; clientId: string; notify: Notify; remaining: number; onDone: () => void; onCancel: () => void
}) {
  const [date, setDate] = useState(today())
  const [amount, setAmount] = useState('')
  const [remarks, setRemarks] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!Number(amount)) { notify('error', 'Enter a receipt amount'); return }
    // A requisition can't receive more than it asked for — the balance
    // stays with 3i Logistics, it doesn't roll into a new requisition here.
    if (Number(amount) > remaining + 0.004) { notify('error', `Cannot exceed the requisition's remaining amount (${formatNumber(remaining, 2)} BDT)`); return }
    setSaving(true)
    const { error } = await supabase.from('finance_fund_receipts').insert({
      client_id: clientId, requisition_id: requisitionId, receipt_date: date, amount: Number(amount), remarks: remarks || null
    })
    setSaving(false)
    if (error) { notify('error', error.message); return }
    notify('success', 'Fund receipt recorded')
    onDone()
  }

  return (
    <div className="mb-2 rounded-lg border border-surface-line bg-surface-sunken/40 p-2">
      <div className="grid grid-cols-[130px_120px_1fr_auto_auto] items-center gap-2">
        <input className="fiori-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
        <input className="fiori-input" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" max={remaining} />
        <input className="fiori-input" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Remarks (optional)" />
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button size="sm" loading={saving} onClick={save}>Save</Button>
      </div>
      <p className="mt-1.5 text-xs text-ink-faint">Remaining on this requisition: {formatNumber(remaining, 2)} BDT</p>
    </div>
  )
}

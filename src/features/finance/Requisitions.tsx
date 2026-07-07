import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { useCollection } from '@/hooks/useCollection'
import { nextDocNumber } from '@/hooks/useDocNumber'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ActionMenu } from '@/components/ui/ActionMenu'
import { ConfirmDelete } from '@/components/ui/ConfirmDelete'
import { SearchBar } from '@/components/shared/SearchBar'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { formatNumber, formatDate } from '@/lib/utils'
import { downloadRequisitionPDF, SUBMITTED_TO, type ReqLine } from '@/pdf/FinancePDF'
import { useAutoOpen } from '@/hooks/useAutoOpen'
import { useRememberedField } from '@/hooks/useRememberedField'

const today = () => new Date().toISOString().slice(0, 10)
const blankLine = (): ReqLine => ({ purpose: '', unit: '', qty: undefined, remarks: '', amount: 0 })

export function Requisitions() {
  const { data, loading, refresh } = useCollection('finance_requisitions', { order: 'created_at' })
  const { data: allReceipts, refresh: refreshReceipts } = useCollection('finance_fund_receipts', { order: 'receipt_date' })
  const { currentClientId, can, isPlatformAdmin, clients } = useAuth()
  const clientName = clients.find((c: any) => c.id === currentClientId)?.name ?? ''
  const notify = useUI(s => s.notify)
  const canEdit = can('finance.create') || can('finance.edit')
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  useAutoOpen(() => { setEditing(null); setModal(true) })
  const [viewing, setViewing] = useState<any>(null)
  const [deleting, setDeleting] = useState<any>(null)

  const receiptsFor = (reqId: string) => (allReceipts as any[]).filter(r => r.requisition_id === reqId)
  const receivedTotal = (reqId: string) => receiptsFor(reqId).reduce((s, r) => s + (Number(r.amount) || 0), 0)

  const fetchLines = async (reqId: string) => {
    const { data: lines } = await supabase.from('finance_requisition_lines').select('*').eq('requisition_id', reqId).order('created_at')
    return lines ?? []
  }

  const openView = async (r: any) => setViewing({ ...r, __lines: await fetchLines(r.id) })
  const openEdit = async (r: any) => { const lines = await fetchLines(r.id); setEditing({ ...r, __lines: lines }); setModal(true) }

  const printReq = async (r: any) => {
    try {
      const lines = await fetchLines(r.id)
      await downloadRequisitionPDF({
        client: clientName, docNo: r.req_no,
        meta: [
          { label: 'Submitted To', value: SUBMITTED_TO },
          { label: 'Requisition No', value: r.req_no },
          { label: 'Date', value: formatDate(r.req_date) },
          { label: 'Sent By', value: r.sender_name || '' },
          ...(r.remarks ? [{ label: 'Remarks', value: r.remarks }] : [])
        ],
        lines: lines.map((l: any) => ({ purpose: l.purpose, unit: l.unit, qty: l.qty ? Number(l.qty) : undefined, remarks: l.remarks, amount: Number(l.amount) || 0 })),
        grandTotal: Number(r.grand_total) || 0
      })
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not generate PDF — check the company logo URL in Settings')
    }
  }

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    const list = !t ? (data as any[]) : (data as any[]).filter(r => String(r.req_no ?? '').toLowerCase().includes(t) || String(r.sender_name ?? '').toLowerCase().includes(t))
    return list
  }, [data, q])

  const columns = [
    { key: 'req_no', header: 'Requisition No', accessor: (r: any) => r.req_no, sortable: true, className: 'font-medium' },
    { key: 'req_date', header: 'Date', render: (r: any) => formatDate(r.req_date) },
    { key: 'sender_name', header: 'Sent By', render: (r: any) => r.sender_name || '—' },
    { key: 'grand_total', header: 'Requested', accessor: (r: any) => formatNumber(r.grand_total, 2), className: 'text-right' },
    { key: 'received', header: 'Received', render: (r: any) => formatNumber(receivedTotal(r.id), 2), className: 'text-right' },
    {
      key: '__a', header: '', className: 'w-px whitespace-nowrap',
      render: (r: any) => (
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
        <div className="w-full sm:w-72"><SearchBar value={q} onChange={setQ} placeholder="Search requisition…" /></div>
        <span className="text-sm text-ink-soft">{rows.length} records</span>
        {canEdit && <Button className="ml-auto" icon="add" onClick={() => { setEditing(null); setModal(true) }}>New Requisition</Button>}
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DataTable fill columns={columns} rows={rows} loading={loading} rowKey={(r: any) => r.id}
          onRowClick={canEdit ? openEdit : openView} emptyTitle="No requisitions yet" />
      </Card>

      {modal && (
        <ReqForm record={editing} clientId={currentClientId!} notify={notify}
          onClose={() => setModal(false)} onDone={() => { setModal(false); refresh() }} />
      )}

      {viewing && (
        <ReqOverview req={viewing} receipts={receiptsFor(viewing.id)} clientId={currentClientId!} canEdit={canEdit} notify={notify}
          onEdit={() => { const r = viewing; setViewing(null); openEdit(r) }}
          onPrint={() => printReq(viewing)}
          onReceiptAdded={() => { refreshReceipts(); openView(viewing).then(v => setViewing(v)) }}
          onClose={() => setViewing(null)} />
      )}

      <ConfirmDelete open={!!deleting} onClose={() => setDeleting(null)}
        name={deleting ? `Requisition · ${deleting.req_no}` : undefined}
        onConfirm={async () => {
          const res = await supabase.from('finance_requisitions').delete().eq('id', deleting.id)
          if (!res.error) { setDeleting(null); refresh() }
          return res
        }} />
    </div>
  )
}

function ReqForm({ record, clientId, notify, onClose, onDone }: any) {
  const [rememberedSender, rememberSender] = useRememberedField('sender_name')
  const [h, setH] = useState<any>(record ?? { req_date: today(), sender_name: rememberedSender })
  const [lines, setLines] = useState<ReqLine[]>(record?.__lines?.length ? record.__lines : [blankLine()])
  const [saving, setSaving] = useState(false)
  const set = (patch: any) => setH((x: any) => ({ ...x, ...patch }))
  const setLine = (i: number, patch: Partial<ReqLine>) => setLines(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l))
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Date" required><Input type="date" value={h.req_date ?? ''} onChange={e => set({ req_date: e.target.value })} /></Field>
          <Field label="Sent By"><Input value={h.sender_name ?? ''} onChange={e => set({ sender_name: e.target.value })} placeholder="Deputy Manager name" /></Field>
          <Field label="Remarks" className="sm:col-span-2"><Textarea value={h.remarks ?? ''} onChange={e => set({ remarks: e.target.value })} /></Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Cost Purpose Lines</p>
            <Button size="sm" variant="secondary" icon="add" onClick={() => setLines(ls => [...ls, blankLine()])}>Add Line</Button>
          </div>
          <div className="overflow-hidden rounded-xl border border-surface-line">
            <div className="grid grid-cols-[1fr_90px_70px_1fr_120px_32px] gap-2 border-b border-surface-line bg-surface-sunken/60 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              <span>Purpose *</span><span>Unit</span><span>Qty</span><span>Remarks</span><span className="text-right">Amount (BDT) *</span><span />
            </div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_90px_70px_1fr_120px_32px] items-center gap-2 border-b border-surface-line px-2 py-1.5 last:border-b-0">
                <input className="fiori-input" value={l.purpose} onChange={e => setLine(i, { purpose: e.target.value })} placeholder="e.g. Fuel for delivery vehicle" />
                <input className="fiori-input" value={l.unit ?? ''} onChange={e => setLine(i, { unit: e.target.value })} placeholder="Ltr" />
                <input className="fiori-input" type="number" value={l.qty ?? ''} onChange={e => setLine(i, { qty: e.target.value === '' ? undefined : Number(e.target.value) })} />
                <input className="fiori-input" value={l.remarks ?? ''} onChange={e => setLine(i, { remarks: e.target.value })} />
                <input className="fiori-input text-right" type="number" value={l.amount ?? ''} onChange={e => setLine(i, { amount: Number(e.target.value) || 0 })} />
                <button type="button" className="flex items-center justify-center text-ink-faint hover:text-bad" onClick={() => setLines(ls => ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls)}>
                  <Icon name="close" className="text-[18px]" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-end text-sm"><span className="text-ink-faint">Grand Total:&nbsp;</span><span className="font-semibold text-ink">{formatNumber(grandTotal, 2)} BDT</span></div>
        </div>

        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button icon="save" loading={saving} onClick={save}>{record ? 'Update' : 'Create'}</Button>
        </div>
      </div>
    </Modal>
  )
}

function ReqOverview({ req, receipts, clientId, canEdit, notify, onEdit, onPrint, onReceiptAdded, onClose }: any) {
  const lines: any[] = req.__lines ?? []
  const [addingReceipt, setAddingReceipt] = useState(false)
  const receivedTotal = receipts.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0)
  const Stat = ({ label, value }: any) => (
    <div className="min-w-0"><p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{label}</p><div className="mt-0.5 text-sm font-medium text-ink break-words">{value}</div></div>
  )
  return (
    <Modal open onClose={onClose} title={`Requisition — ${req.req_no}`} size="lg">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-surface-line bg-surface-sunken/40 p-4 sm:grid-cols-3">
          <Stat label="Date" value={formatDate(req.req_date)} />
          <Stat label="Sent By" value={req.sender_name || '—'} />
          <Stat label="Requested" value={`${formatNumber(req.grand_total, 2)} BDT`} />
          <Stat label="Received" value={`${formatNumber(receivedTotal, 2)} BDT`} />
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Cost Purpose Lines</p>
          <div className="overflow-hidden rounded-xl border border-surface-line">
            {lines.length === 0 ? <p className="p-3 text-sm text-ink-faint">No lines</p> :
              lines.map((l, i) => (
                <div key={l.id ?? i} className={'flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                  <span className="min-w-0 truncate text-ink">{l.purpose}{l.unit || l.qty ? <span className="text-ink-faint"> · {l.qty ?? ''} {l.unit ?? ''}</span> : null}</span>
                  <span className="shrink-0 font-semibold text-ink">{formatNumber(l.amount, 2)}</span>
                </div>
              ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Fund Received</p>
            {canEdit && !addingReceipt && <Button size="sm" variant="secondary" icon="add" onClick={() => setAddingReceipt(true)}>Add Receipt</Button>}
          </div>
          {addingReceipt && (
            <AddReceiptRow requisitionId={req.id} clientId={clientId} notify={notify}
              onDone={() => { setAddingReceipt(false); onReceiptAdded() }} onCancel={() => setAddingReceipt(false)} />
          )}
          <div className="overflow-hidden rounded-xl border border-surface-line">
            {receipts.length === 0 && !addingReceipt ? <p className="p-3 text-sm text-ink-faint">No fund received yet</p> :
              receipts.map((r: any, i: number) => (
                <div key={r.id ?? i} className={'flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
                  <span className="text-ink">{formatDate(r.receipt_date)}{r.remarks ? <span className="text-ink-faint"> · {r.remarks}</span> : null}</span>
                  <span className="font-semibold text-ink">{formatNumber(r.amount, 2)}</span>
                </div>
              ))}
          </div>
        </div>

        {req.remarks && <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">Remarks</p><p className="text-sm text-ink-soft">{req.remarks}</p></div>}

        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="secondary" icon="print" onClick={onPrint}>Print</Button>
          {canEdit && <Button icon="edit" onClick={onEdit}>Edit</Button>}
        </div>
      </div>
    </Modal>
  )
}

function AddReceiptRow({ requisitionId, clientId, notify, onDone, onCancel }: any) {
  const [date, setDate] = useState(today())
  const [amount, setAmount] = useState('')
  const [remarks, setRemarks] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!Number(amount)) { notify('error', 'Enter a receipt amount'); return }
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
    <div className="mb-2 grid grid-cols-[130px_120px_1fr_auto_auto] items-center gap-2 rounded-lg border border-surface-line bg-surface-sunken/40 p-2">
      <input className="fiori-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
      <input className="fiori-input" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" />
      <input className="fiori-input" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Remarks (optional)" />
      <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      <Button size="sm" loading={saving} onClick={save}>Save</Button>
    </div>
  )
}

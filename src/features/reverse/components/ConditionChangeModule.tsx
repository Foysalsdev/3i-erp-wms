import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { nextDocNumber } from '@/hooks/useDocNumber'
import { useInboundData } from '@/features/inbound/hooks'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ActionMenu, type MenuItem } from '@/components/ui/ActionMenu'
import { ConfirmDelete } from '@/components/ui/ConfirmDelete'
import { Field, Input, Textarea, Select } from '@/components/ui/Field'
import { Combobox } from '@/components/ui/Combobox'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/States'
import { formatDate, formatNumber } from '@/lib/utils'

// Stock conditions a returned/refurbished unit can move between. `scrap` is a
// write-off (outbound only) and is therefore a valid *destination* only.
const CONDITIONS = [
  { id: 'good', label: 'Good' },
  { id: 'damaged', label: 'Damaged' },
  { id: 'quarantine', label: 'Quarantine' }
]
const TO_CONDITIONS_WITH_SCRAP = [...CONDITIONS, { id: 'scrap', label: 'Scrap (write-off)' }]

export interface CCConfig {
  key: string
  table: string
  itemTable: string
  itemFK: string           // FK column on the item table
  docType: string          // doc number type
  postRpc: string
  postParam: string
  title: string
  singular: string
  icon: string
  dateField: string
  fromDefault: string
  toDefault: string
  allowScrap?: boolean     // expose Scrap as a destination (inspection)
  showCost?: boolean       // repair cost column (refurbishment)
  linkSalesReturn?: boolean // allow loading lines from a posted sales return
}

interface Line {
  product_id?: string; location_id?: string
  from_status: string; to_status: string
  qty?: number | string; repair_cost?: number | string; reason?: string
}

const tone = (s: string) => s === 'posted' ? 'positive' : s === 'cancelled' ? 'negative' : 'neutral'
const today = () => new Date().toISOString().slice(0, 10)

export function ConditionChangeModule({ config }: { config: CCConfig }) {
  const { clientId, products, warehouses, locations } = useInboundData()
  const { can, isPlatformAdmin } = useAuth()
  const notify = useUI(s => s.notify)
  const canEdit = can('reverse.create') || can('reverse.edit')
  const canPost = can('reverse.post')

  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [deleting, setDeleting] = useState<any>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const prodMap = useMemo(() => Object.fromEntries(products.map(p => [p.id, p.sub ? `${p.label} — ${p.sub}` : p.label])), [products])
  const whMap = useMemo(() => Object.fromEntries(warehouses.map(w => [w.id, w.label])), [warehouses])

  const load = () => {
    if (!clientId) return
    setLoading(true)
    supabase.from(config.table as any).select('*').eq('client_id', clientId).order('created_at', { ascending: false })
      .then(({ data }) => { setDocs(data ?? []); setLoading(false) })
  }
  useEffect(load, [clientId, config.table])

  const openEdit = async (doc: any, readOnly: boolean) => {
    const { data } = await supabase.from(config.itemTable as any).select('*').eq(config.itemFK, doc.id)
    setEditing({ ...doc, __items: data ?? [], __readOnly: readOnly || doc.status !== 'draft' })
    setModal(true)
  }

  const post = async (doc: any) => {
    if (doc.status !== 'draft') { notify('info', 'Already posted'); return }
    if (!doc.warehouse_id) { notify('error', 'Set a warehouse before posting'); return }
    setBusy(doc.id)
    try {
      const { error } = await (supabase as any).rpc(config.postRpc, { [config.postParam]: doc.id })
      if (error) throw error
      notify('success', `${doc.doc_no ?? config.singular} posted — stock conditions updated`)
      load()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not post')
    } finally { setBusy(null) }
  }

  const del = async (doc: any) => {
    const res = await supabase.from(config.table as any).delete().eq('id', doc.id)
    if (!res.error) { setDeleting(null); load() }
    return res
  }

  const rowActions = (r: any): MenuItem[] => [
    { icon: 'visibility', label: 'View', onClick: () => openEdit(r, true) },
    ...(canEdit && r.status === 'draft' ? [{ icon: 'edit', label: 'Edit', onClick: () => openEdit(r, false) }] : []),
    ...(canPost && r.status === 'draft' ? [{ icon: 'task_alt', label: busy === r.id ? 'Posting…' : 'Post', tone: '!text-ok hover:!text-ok hover:!bg-ok/10', onClick: () => post(r) }] : []),
    ...(isPlatformAdmin ? [{ icon: 'delete', label: 'Delete', tone: '!text-bad hover:!text-bad hover:!bg-bad/10', onClick: () => setDeleting(r) }] : [])
  ]

  const columns = [
    { key: 'doc_no', header: 'Document No', accessor: (r: any) => r.doc_no, sortable: true, className: 'font-medium' },
    { key: 'date', header: 'Date', render: (r: any) => formatDate(r[config.dateField]) },
    { key: 'wh', header: 'Warehouse', render: (r: any) => whMap[r.warehouse_id]?.split(' — ')[0] ?? '—' },
    { key: 'status', header: 'Status', render: (r: any) => <Badge tone={tone(r.status)}>{r.status}</Badge> },
    { key: '__actions', header: '', className: 'w-px whitespace-nowrap text-right',
      render: (r: any) => <div className="flex justify-end" onClick={e => e.stopPropagation()}><ActionMenu items={rowActions(r)} /></div> }
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-soft">{docs.length} {config.title.toLowerCase()}(s)</span>
        {canEdit && <Button icon="add" onClick={() => { setEditing(null); setModal(true) }}>New {config.singular}</Button>}
      </div>
      <Card className="overflow-hidden">
        {loading ? <Spinner /> : <DataTable columns={columns} rows={docs} rowKey={(r: any) => r.id}
          onRowClick={(r: any) => openEdit(r, true)} emptyTitle={`No ${config.title.toLowerCase()} yet`} />}
      </Card>

      {modal && (
        <CCForm config={config} record={editing} clientId={clientId!} products={products} warehouses={warehouses}
          locations={locations} prodMap={prodMap}
          onClose={() => setModal(false)} onDone={() => { setModal(false); load() }} />
      )}

      <ConfirmDelete open={!!deleting} onClose={() => setDeleting(null)}
        name={deleting ? `${config.singular} · ${deleting.doc_no}` : undefined}
        onConfirm={() => del(deleting)} />
    </div>
  )
}

function CCForm({ config, record, clientId, products, warehouses, locations, prodMap, onClose, onDone }: any) {
  const notify = useUI(s => s.notify)
  const readOnly = !!record?.__readOnly
  const [h, setH] = useState<any>(record ?? { [config.dateField]: today() })
  const [lines, setLines] = useState<Line[]>(
    (record?.__items ?? []).map((r: any) => ({
      product_id: r.product_id, location_id: r.location_id, from_status: r.from_status, to_status: r.to_status,
      qty: r.qty, repair_cost: r.repair_cost, reason: r.reason
    })))
  const [saving, setSaving] = useState(false)
  const [salesReturns, setSalesReturns] = useState<any[]>([])
  const set = (patch: any) => setH((x: any) => ({ ...x, ...patch }))
  const toOptions = config.allowScrap ? TO_CONDITIONS_WITH_SCRAP : CONDITIONS
  const locForWh = locations.filter((l: any) => !h.warehouse_id || l.extra === h.warehouse_id)

  useEffect(() => {
    if (!config.linkSalesReturn || !clientId) return
    supabase.from('sales_returns' as any).select('id,doc_no,warehouse_id').eq('client_id', clientId).eq('status', 'posted')
      .order('created_at', { ascending: false }).then(({ data }: any) => setSalesReturns(data ?? []))
  }, [clientId])

  const updateLine = (i: number, patch: Partial<Line>) => setLines(ls => ls.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  const addLine = () => setLines(ls => [...ls, { from_status: config.fromDefault, to_status: config.toDefault, qty: '' }])
  const removeLine = (i: number) => setLines(ls => ls.filter((_, idx) => idx !== i))

  // Pull the lines of a posted sales return as a starting point for inspection.
  const loadFromSrn = async (srnId: string) => {
    const srn = salesReturns.find(s => s.id === srnId)
    const { data } = await supabase.from('sales_return_items' as any).select('*').eq('srn_id', srnId)
    set({ srn_id: srnId, warehouse_id: h.warehouse_id || srn?.warehouse_id || '' })
    setLines((data ?? []).map((r: any) => ({
      product_id: r.product_id, location_id: r.location_id,
      from_status: r.stock_status || config.fromDefault, to_status: config.toDefault, qty: r.qty, reason: r.reason
    })))
  }

  const save = async () => {
    if (!h.warehouse_id) { notify('error', 'Warehouse is required'); return }
    const valid = lines.filter(l => l.product_id && Number(l.qty) > 0)
    if (!valid.length) { notify('error', 'Add at least one line with a product and quantity'); return }
    const noop = valid.find(l => l.from_status === l.to_status)
    if (noop) { notify('error', 'From and To condition must differ on every line'); return }
    setSaving(true)
    try {
      const hdr: any = {
        client_id: clientId, warehouse_id: h.warehouse_id,
        [config.dateField]: h[config.dateField] || today(), remarks: h.remarks || null, status: 'draft'
      }
      if (config.linkSalesReturn) hdr.srn_id = h.srn_id || null
      let docId = record?.id
      if (record) {
        const { error } = await (supabase as any).from(config.table).update(hdr).eq('id', record.id)
        if (error) throw error
        await (supabase as any).from(config.itemTable).delete().eq(config.itemFK, record.id)
      } else {
        hdr.doc_no = await nextDocNumber(clientId, config.docType)
        const { data, error } = await supabase.from(config.table as any).insert(hdr).select('id').single()
        if (error) throw error
        docId = (data as any).id
      }
      const rows = valid.map(l => {
        const row: any = {
          client_id: clientId, [config.itemFK]: docId, product_id: l.product_id,
          location_id: l.location_id || null, from_status: l.from_status, to_status: l.to_status,
          qty: Number(l.qty) || 0, reason: l.reason || null
        }
        if (config.showCost) row.repair_cost = Number(l.repair_cost) || 0
        return row
      })
      const { error: ie } = await supabase.from(config.itemTable as any).insert(rows)
      if (ie) throw ie
      notify('success', `${config.singular} saved as draft`)
      onDone()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not save')
    } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title={`${record ? (readOnly ? 'View' : 'Edit') : 'New'} ${config.title}${record?.doc_no ? ' · ' + record.doc_no : ''}`} size="xl">
      <div className="space-y-4">
        {readOnly && <div className="flex items-center gap-2"><Badge tone={tone(record.status)}>{record.status}</Badge>
          {record.status === 'posted' && <span className="text-xs text-ink-soft">Posted documents are read-only.</span>}</div>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Warehouse" required>
            <Combobox value={h.warehouse_id ?? ''} disabled={readOnly}
              options={warehouses.map((w: any) => ({ id: w.id, label: w.label, sub: w.sub }))}
              placeholder="Search warehouse…" onChange={(v: string) => set({ warehouse_id: v })} />
          </Field>
          <Field label="Date"><Input type="date" disabled={readOnly} value={(h[config.dateField] ?? '').slice(0, 10)} onChange={e => set({ [config.dateField]: e.target.value })} /></Field>
          {config.linkSalesReturn && !readOnly && (
            <Field label="Load from Sales Return">
              <Combobox value={h.srn_id ?? ''} options={salesReturns.map(s => ({ id: s.id, label: s.doc_no }))}
                placeholder="Optional — pull returned lines" onChange={(v: string) => loadFromSrn(v)} />
            </Field>
          )}
        </div>

        <div>
          <p className="fiori-label">Line Items</p>
          <div className="overflow-x-auto rounded-lg border border-surface-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-line bg-surface-sunken text-left text-xs font-semibold text-ink-soft">
                  <th className="px-2 py-2 min-w-[220px]">Product</th>
                  <th className="px-2 py-2 min-w-[140px]">Location</th>
                  <th className="px-2 py-2 min-w-[120px]">From</th>
                  <th className="px-2 py-2 min-w-[140px]">To</th>
                  <th className="px-2 py-2 w-20 text-right">Qty</th>
                  {config.showCost && <th className="px-2 py-2 w-24 text-right">Repair Cost</th>}
                  <th className="px-2 py-2 min-w-[140px]">Reason</th>
                  {!readOnly && <th className="px-2 py-2 w-8" />}
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 && (
                  <tr><td colSpan={config.showCost ? 8 : 7} className="px-3 py-4 text-center text-xs text-ink-faint">No lines yet.</td></tr>
                )}
                {lines.map((l, i) => (
                  <tr key={i} className="border-b border-surface-line last:border-0">
                    <td className="px-2 py-1.5">
                      <Combobox value={l.product_id ?? ''} disabled={readOnly}
                        options={products.map((p: any) => ({ id: p.id, label: p.label, sub: p.sub }))}
                        placeholder="Search product…" onChange={(v: string) => updateLine(i, { product_id: v })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <Combobox value={l.location_id ?? ''} disabled={readOnly}
                        options={locForWh.map((loc: any) => ({ id: loc.id, label: loc.label }))}
                        placeholder="—" onChange={(v: string) => updateLine(i, { location_id: v })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <Select value={l.from_status} disabled={readOnly} onChange={e => updateLine(i, { from_status: e.target.value })}>
                        {CONDITIONS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </Select>
                    </td>
                    <td className="px-2 py-1.5">
                      <Select value={l.to_status} disabled={readOnly} onChange={e => updateLine(i, { to_status: e.target.value })}>
                        {toOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </Select>
                    </td>
                    <td className="px-2 py-1.5"><Input type="number" min={0} className="text-right" disabled={readOnly} value={l.qty ?? ''} onChange={e => updateLine(i, { qty: e.target.value })} /></td>
                    {config.showCost && <td className="px-2 py-1.5"><Input type="number" min={0} className="text-right" disabled={readOnly} value={l.repair_cost ?? ''} onChange={e => updateLine(i, { repair_cost: e.target.value })} /></td>}
                    <td className="px-2 py-1.5"><Input disabled={readOnly} value={l.reason ?? ''} onChange={e => updateLine(i, { reason: e.target.value })} /></td>
                    {!readOnly && <td className="px-2 py-1.5 text-center"><button onClick={() => removeLine(i)} className="text-ink-faint hover:text-bad"><Icon name="close" className="text-[18px]" /></button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!readOnly && <button onClick={addLine} className="mt-2 flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"><Icon name="add" className="text-[18px]" /> Add line</button>}
          <p className="mt-1 text-right text-xs text-ink-soft">Total qty: {formatNumber(lines.reduce((s, l) => s + (Number(l.qty) || 0), 0))}</p>
        </div>

        <Field label="Remarks"><Textarea disabled={readOnly} value={h.remarks ?? ''} onChange={e => set({ remarks: e.target.value })} /></Field>

        {!readOnly && (
          <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button icon="save" loading={saving} onClick={save}>{record ? 'Update' : 'Save Draft'}</Button>
          </div>
        )}
      </div>
    </Modal>
  )
}

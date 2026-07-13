import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { nextDocNumber } from '@/hooks/useDocNumber'
import { useInboundData, STATUS_TONE } from '../hooks'
import type { DocConfig, ExtraField } from '../docConfigs'
import { ItemsEditor, type LineItem } from './ItemsEditor'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Combobox } from '@/components/ui/Combobox'
import { Icon } from '@/components/ui/Icon'
import { ActionMenu, type MenuItem } from '@/components/ui/ActionMenu'
import { formatDate } from '@/lib/utils'

// The engine serves many document tables (grns, putaways, returns, ...)
// through one config, so a row is a dynamic record: known workflow columns
// typed, everything else reachable through the index signature.
export type DocRecord = {
  id: string; doc_no: string | null; status: string
  warehouse_id?: string | null; created_at?: string
} & Record<string, unknown>
const cell = (r: DocRecord, k: string) => r[k] as string | number | null | undefined
const str = (v: unknown) => (v == null ? '' : String(v))

// `permModule` lets the same document engine power different sidebar modules
// (inbound, outbound, reverse) while gating actions on that module's RBAC keys.
export function DocModule({ config, permModule = 'inbound' }: { config: DocConfig; permModule?: string }) {
  const { clientId, suppliers, customers, warehouses, products, locations, transporters, vehicles, drivers } = useInboundData()
  const { can, clients, currentClientId, isPlatformAdmin } = useAuth()
  const notify = useUI(s => s.notify)
  const clientName = clients.find(c => c.id === currentClientId)?.name ?? ''
  const canEdit = can(`${permModule}.create`) || can(`${permModule}.edit`)
  const canPost = can(`${permModule}.post`)

  const [docs, setDocs] = useState<DocRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'list' | 'editor'>('list')
  const [readOnly, setReadOnly] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [header, setHeader] = useState<Partial<DocRecord>>({})
  const [items, setItems] = useState<LineItem[]>([])
  const [sources, setSources] = useState<{ id: string; doc_no: string | number | null | undefined }[]>([])
  const [saving, setSaving] = useState(false)

  const prodMap = useMemo(() => Object.fromEntries(products.map(p => [p.id, p.label])), [products])
  const party = config.party
  const partyField = party === 'customer' ? 'customer_id' : 'supplier_id'
  const partyOpts = party === 'customer' ? customers : suppliers
  const partyLabel = config.partyLabel ?? (party === 'customer' ? 'Customer' : 'Supplier')
  const partyMap = useMemo(() => Object.fromEntries(partyOpts.map(o => [o.id, o.sub ? `${o.label} — ${o.sub}` : o.label])), [partyOpts])
  const relList = (r?: string) => r === 'transport_vendors' ? transporters : r === 'vehicles' ? vehicles : r === 'drivers' ? drivers : r === 'warehouses' ? warehouses : r === 'customers' ? customers : []
  const relMap = (r?: string) => Object.fromEntries(relList(r).map(o => [o.id, o.sub ? `${o.label} — ${o.sub}` : o.label]))
  const showExtra = (f: ExtraField, src: Partial<DocRecord>) => !f.showWhen || src[f.showWhen.field] === f.showWhen.equals

  const load = () => {
    if (!clientId) return
    setLoading(true)
    // config-driven table names: the typed client can't take a 100-table union
    // (TS2589), so the from() boundary stays dynamic while rows are DocRecord.
    supabase.from(config.table as any).select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setDocs((data ?? []) as unknown as DocRecord[]); setLoading(false) })
  }
  useEffect(load, [clientId, config.table])

  // load source docs (e.g. posted POs) for "load from"
  useEffect(() => {
    if (!clientId || !config.source) return
    const numberField = config.source.numberField ?? 'doc_no'
    supabase.from(config.source.table as any).select(`id,${numberField}`).in('status', config.source.statuses)
      .order('created_at', { ascending: false })
      .then(({ data }) => setSources(((data ?? []) as unknown as DocRecord[]).map(r => ({ id: r.id, doc_no: cell(r, numberField) }))))
  }, [clientId, config])

  const openNew = () => { setEditId(null); setReadOnly(false); setHeader({ status: 'draft' }); setItems([]); setMode('editor') }

  const openDoc = async (doc: DocRecord, ro: boolean) => {
    setEditId(doc.id); setReadOnly(ro || doc.status !== 'draft'); setHeader(doc)
    const { data } = await supabase.from(config.itemTable as any).select('*').eq(config.itemFK, doc.id)
    setItems(((data ?? []) as unknown as DocRecord[]).map((r) => ({
      product_id: r.product_id as string, qty: cell(r, config.qtyField) as number, unit_price: r.unit_price as number,
      location_id: r.location_id as string | undefined, from_location_id: r.from_location_id as string | undefined, to_location_id: r.to_location_id as string | undefined,
      stock_status: (r.stock_status as string) ?? 'good', reason: r.reason as string | undefined, direction: r.direction as 'in' | 'out' | undefined
    })))
    setMode('editor')
  }

  const loadFromSource = async (srcId: string) => {
    if (!config.source || !srcId) return
    const { data } = await supabase.from(config.source.itemTable as any).select('*').eq(config.source.itemFk ?? config.source.fk, srcId)
    const { data: sh } = await supabase.from(config.source.table as any).select('*').eq('id', srcId).single<DocRecord>()
    setHeader(h => ({ ...h, [config.source!.fk]: srcId,
      warehouse_id: h.warehouse_id || sh?.warehouse_id || '',
      ...(party && sh?.[partyField] ? { [partyField]: sh[partyField] } : {}) }))
    setItems(((data ?? []) as unknown as DocRecord[]).map(r => ({
      product_id: r.product_id as string, qty: (r.received_qty ?? r.qty) as number, unit_price: (r.unit_price as number) ?? 0,
      location_id: r.location_id as string | undefined, to_location_id: r.location_id as string | undefined, stock_status: (r.stock_status as string) ?? 'good'
    })))
  }

  const buildItemRow = (docId: string, li: LineItem) => {
    const row: Record<string, unknown> = {  [config.itemFK]: docId, product_id: li.product_id, [config.qtyField]: Number(li.qty || 0) }
    if (config.itemCols.price) row.unit_price = Number(li.unit_price || 0)
    if (config.itemCols.location) row.location_id = li.location_id || null
    if (config.itemCols.condition) row.stock_status = li.stock_status || 'good'
    if (config.itemCols.fromTo) { row.from_location_id = li.from_location_id || null; row.to_location_id = li.to_location_id || null }
    if (config.itemCols.reason) row.reason = li.reason || null
    if (config.itemCols.direction) row.direction = li.direction || 'out'
    return row
  }

  const save = async () => {
    if (!header.warehouse_id) { notify('error', 'Warehouse is required'); return }
    const valid = items.filter(i => i.product_id && Number(i.qty) > 0)
    if (!valid.length) { notify('error', 'Add at least one line item'); return }
    setSaving(true)
    let docId = editId
    const hdr: Record<string, unknown> = {
       warehouse_id: header.warehouse_id,
      [config.dateField]: header[config.dateField] || new Date().toISOString().slice(0, 10),
      remarks: header.remarks || null, status: 'draft'
    }
    if (party) hdr[partyField] = header[partyField] || null
    if (config.hasExpected) hdr.expected_date = header.expected_date || null
    if (config.source) hdr[config.source.fk] = header[config.source.fk] || null
    config.extraFields?.forEach(f => { hdr[f.name] = header[f.name] || null })

    if (!docId) {
      hdr.doc_no = await nextDocNumber(clientId!, config.docType)
      if (!hdr.doc_no) { notify('error', `Could not generate the ${config.singular} number`); setSaving(false); return }
      const { data, error } = await supabase.from(config.table as any).insert(hdr).select('id').single<{ id: string }>()
      if (error) { notify('error', error.message); setSaving(false); return }
      docId = data.id
    } else {
      const { error } = await supabase.from(config.table as any).update(hdr).eq('id', docId)
      if (error) { notify('error', error.message); setSaving(false); return }
      await supabase.from(config.itemTable as any).delete().eq(config.itemFK, docId)
    }
    const rows = valid.map(li => buildItemRow(docId!, li))
    const { error: ie } = await supabase.from(config.itemTable as any).insert(rows)
    setSaving(false)
    if (ie) { notify('error', ie.message); return }
    notify('success', `${config.singular} saved`)
    setMode('list'); load()
  }

  const post = async (doc: DocRecord) => {
    if (config.postRpc) {
      // Public wrappers (see migration 18) expose the app.post_* routines to PostgREST.
      const { error } = await (supabase as any).rpc(config.postRpc, { [config.postParam!]: doc.id })
      if (error) { notify('error', error.message); return }
    } else {
      const { error } = await supabase.from(config.table as any).update({ status: 'posted' }).eq('id', doc.id)
      if (error) { notify('error', error.message); return }
    }
    notify('success', `${doc.doc_no} posted`); load()
  }

  const printDoc = async (doc: DocRecord) => {
    try {
      const { data } = await supabase.from(config.itemTable as any).select('*').eq(config.itemFK, doc.id)
      const lines = ((data ?? []) as unknown as DocRecord[]).map(r => ({ name: prodMap[r.product_id as string] ?? String(r.product_id), qty: Number(cell(r, config.qtyField)), price: Number(r.unit_price ?? 0) }))
      const extraMeta = (config.extraFields ?? []).filter(f => doc[f.name] && showExtra(f, doc))
        .map(f => ({ label: f.label, value: f.kind === 'relation' ? (relMap(f.relation)[str(doc[f.name])] ?? str(doc[f.name])) : str(doc[f.name]) }))
      const baseMeta = [
        { label: 'Date', value: formatDate(str(cell(doc, config.dateField))) },
        { label: 'Status', value: doc.status },
        ...(party ? [{ label: partyLabel, value: partyMap[str(doc[partyField])] ?? '—' }] : []),
        { label: 'Warehouse', value: warehouses.find(w => w.id === doc.warehouse_id)?.label ?? '—' }
      ]
      if (config.pdfKind === 'gatepass') {
        const ref = config.source ? sources.find(s => s.id === doc[config.source!.fk])?.doc_no : undefined
        const meta = [...baseMeta.filter(m => m.label !== 'Status'), ...extraMeta, ...(ref ? [{ label: 'Delivery Challan', value: str(ref) }] : [])]
        const { downloadGatePassPDF } = await import('@/pdf/GatePassPDF')  // lazy: pdf chunk loads on demand
        await downloadGatePassPDF({ client: clientName, docNo: doc.doc_no ?? '', meta, lines })
      } else {
        const { downloadDocPDF } = await import('@/pdf/DocumentPDF')  // lazy: pdf chunk loads on demand
        await downloadDocPDF({ client: clientName, title: config.title, docNo: doc.doc_no ?? '', meta: [...baseMeta, ...extraMeta], lines, showPrice: config.showPrice })
      }
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not generate PDF')
    }
  }

  const del = async (doc: DocRecord) => {
    const { error } = await supabase.from(config.table as any).delete().eq('id', doc.id)
    if (error) { notify('error', error.message); return }
    notify('success', 'Deleted'); load()
  }

  if (mode === 'editor') {
    return (
      <div className="space-y-4">
        <button onClick={() => setMode('list')} className="flex items-center gap-1 text-sm text-ink-soft hover:text-brand-700"><Icon name="arrow_back" className="text-[18px]" /> Back</button>
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-ink">{editId ? (readOnly ? 'View' : 'Edit') : 'New'} {config.title}{header.doc_no ? ` · ${header.doc_no}` : ''}</h2>
            {readOnly && <Badge tone={STATUS_TONE[header.status ?? 'draft']}>{header.status}</Badge>}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {party && (
              <Field label={partyLabel}><Combobox value={str(header[partyField])} disabled={readOnly} options={partyOpts.map(o => ({ id: o.id, label: o.label, sub: o.sub }))} mruKey={`party-${party}`} placeholder={`Search ${partyLabel.toLowerCase()}…`} onChange={v => setHeader({ ...header, [partyField]: v })} /></Field>
            )}
            <Field label="Warehouse" required><Combobox value={header.warehouse_id ?? ''} disabled={readOnly} options={warehouses.map(w => ({ id: w.id, label: w.label, sub: w.sub }))} mruKey="warehouse" placeholder="Search warehouse…" onChange={v => setHeader({ ...header, warehouse_id: v })} /></Field>
            <Field label="Date"><Input type="date" disabled={readOnly} value={str(header[config.dateField]).slice(0, 10)} onChange={e => setHeader({ ...header, [config.dateField]: e.target.value })} /></Field>
            {config.hasExpected && <Field label="Expected Date"><Input type="date" disabled={readOnly} value={str(header.expected_date).slice(0, 10)} onChange={e => setHeader({ ...header, expected_date: e.target.value })} /></Field>}
            {config.source && !readOnly && !editId && (
              <Field label={config.source.label}><Combobox value={str(header[config.source.fk])} options={sources.map(s => ({ id: s.id, label: str(s.doc_no) }))} placeholder="Search…" onChange={v => loadFromSource(v)} /></Field>
            )}
            {config.extraFields?.filter(f => showExtra(f, header)).map(f => (
              <Field key={f.name} label={f.label}>
                {f.kind === 'text'
                  ? <Input disabled={readOnly} value={str(header[f.name])} onChange={e => setHeader({ ...header, [f.name]: e.target.value })} />
                  : <Combobox value={str(header[f.name])} disabled={readOnly}
                      options={f.kind === 'relation' ? relList(f.relation).map(o => ({ id: o.id, label: o.label, sub: o.sub })) : (f.options ?? []).map(o => ({ id: o, label: o }))}
                      onChange={v => setHeader({ ...header, [f.name]: v })} />}
              </Field>
            ))}
          </div>
          <Field label="Remarks"><Textarea disabled={readOnly} value={str(header.remarks)} onChange={e => setHeader({ ...header, remarks: e.target.value })} /></Field>
          <div>
            <p className="fiori-label">Line Items</p>
            <ItemsEditor items={items} setItems={setItems} products={products}
              locations={locations.filter(l => !header.warehouse_id || l.extra === header.warehouse_id)}
              cols={config.itemCols} disabled={readOnly} />
          </div>
          {!readOnly && <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
            <Button variant="ghost" onClick={() => setMode('list')}>Cancel</Button>
            <Button icon="save" loading={saving} onClick={save}>Save Draft</Button>
          </div>}
        </Card>
      </div>
    )
  }

  const columns: Column<DocRecord>[] = [
    { key: 'doc_no', header: 'Document No', accessor: r => r.doc_no, sortable: true, className: 'font-medium' },
    { key: 'date', header: 'Date', render: r => formatDate(cell(r, config.dateField) as string), sortable: true, accessor: r => cell(r, config.dateField) as string },
    ...(party ? [{ key: 'party', header: partyLabel, render: (r: DocRecord) => partyMap[r[partyField] as string]?.split(' — ')[1] ?? '—' }] : []),
    { key: 'wh', header: 'Warehouse', render: r => warehouses.find(w => w.id === r.warehouse_id)?.label?.split(' — ')[0] ?? '—' },
    { key: 'status', header: 'Status', render: r => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> },
    { key: '__actions', header: 'Action', className: 'w-px whitespace-nowrap text-right', render: r => (
      <div className="flex justify-end" onClick={e => e.stopPropagation()}>
        <ActionMenu items={rowActions(r)} />
      </div>
    ) }
  ]

  // Per-row actions, collapsed into the shared 3-dot (kebab) menu.
  const rowActions = (r: DocRecord): MenuItem[] => [
    { icon: 'visibility', label: 'View', onClick: () => openDoc(r, true) },
    ...(canEdit && r.status === 'draft' ? [{ icon: 'edit', label: 'Edit', onClick: () => openDoc(r, false) }] : []),
    { icon: 'print', label: 'Print', onClick: () => printDoc(r) },
    ...(canPost && r.status === 'draft' ? [{ icon: 'task_alt', label: 'Post', tone: '!text-ok hover:!text-ok hover:!bg-ok/10', onClick: () => post(r) }] : []),
    ...(isPlatformAdmin ? [{ icon: 'delete', label: 'Delete', tone: '!text-bad hover:!text-bad hover:!bg-bad/10', onClick: () => del(r) }] : [])
  ]


  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-soft">{docs.length} {config.title.toLowerCase()}(s)</span>
        {canEdit && <Button icon="add" onClick={openNew}>New {config.singular}</Button>}
      </div>
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DataTable fill loading={loading} columns={columns} rows={docs} rowKey={r => r.id} onRowClick={r => openDoc(r, true)} emptyTitle={`No ${config.title.toLowerCase()} yet`} />
      </Card>
    </div>
  )
}

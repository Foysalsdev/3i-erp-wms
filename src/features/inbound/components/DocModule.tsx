import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { nextDocNumber } from '@/hooks/useDocNumber'
import { useInboundData, STATUS_TONE } from '../hooks'
import type { DocConfig } from '../docConfigs'
import { ItemsEditor, type LineItem } from './ItemsEditor'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Combobox } from '@/components/ui/Combobox'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/States'
import { formatDate, cn } from '@/lib/utils'
import { downloadDocPDF } from '@/pdf/DocumentPDF'
import { downloadGatePassPDF } from '@/pdf/GatePassPDF'

export function DocModule({ config }: { config: DocConfig }) {
  const { clientId, suppliers, customers, warehouses, products, locations, transporters, vehicles, drivers } = useInboundData()
  const { can, clients, currentClientId } = useAuth()
  const notify = useUI(s => s.notify)
  const clientName = clients.find(c => c.id === currentClientId)?.name ?? ''
  const canEdit = can('inbound.create') || can('inbound.edit')
  const canPost = can('inbound.post')

  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'list' | 'editor'>('list')
  const [readOnly, setReadOnly] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [header, setHeader] = useState<any>({})
  const [items, setItems] = useState<LineItem[]>([])
  const [sources, setSources] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  const prodMap = useMemo(() => Object.fromEntries(products.map(p => [p.id, p.label])), [products])
  const party = config.party
  const partyField = party === 'customer' ? 'customer_id' : 'supplier_id'
  const partyOpts = party === 'customer' ? customers : suppliers
  const partyLabel = config.partyLabel ?? (party === 'customer' ? 'Customer' : 'Supplier')
  const partyMap = useMemo(() => Object.fromEntries(partyOpts.map(o => [o.id, o.sub ? `${o.label} — ${o.sub}` : o.label])), [partyOpts])
  const relList = (r?: string) => r === 'transport_vendors' ? transporters : r === 'vehicles' ? vehicles : r === 'drivers' ? drivers : r === 'warehouses' ? warehouses : r === 'customers' ? customers : []
  const relMap = (r?: string) => Object.fromEntries(relList(r).map(o => [o.id, o.sub ? `${o.label} — ${o.sub}` : o.label]))
  const showExtra = (f: any, src: any) => !f.showWhen || src[f.showWhen.field] === f.showWhen.equals

  const load = () => {
    if (!clientId) return
    setLoading(true)
    supabase.from(config.table as any).select('*').eq('client_id', clientId).order('created_at', { ascending: false })
      .then(({ data }) => { setDocs(data ?? []); setLoading(false) })
  }
  useEffect(load, [clientId, config.table])

  // load source docs (e.g. posted POs) for "load from"
  useEffect(() => {
    if (!clientId || !config.source) return
    supabase.from(config.source.table as any).select('id,doc_no').eq('client_id', clientId).in('status', config.source.statuses)
      .order('created_at', { ascending: false }).then(({ data }) => setSources(data ?? []))
  }, [clientId, config])

  const openNew = () => { setEditId(null); setReadOnly(false); setHeader({ status: 'draft' }); setItems([]); setMode('editor') }

  const openDoc = async (doc: any, ro: boolean) => {
    setEditId(doc.id); setReadOnly(ro || doc.status !== 'draft'); setHeader(doc)
    const { data } = await supabase.from(config.itemTable as any).select('*').eq(config.itemFK, doc.id)
    setItems((data ?? []).map((r: any) => ({
      product_id: r.product_id, qty: r[config.qtyField], unit_price: r.unit_price,
      location_id: r.location_id, from_location_id: r.from_location_id, to_location_id: r.to_location_id,
      stock_status: r.stock_status ?? 'good', reason: r.reason, direction: r.direction
    })))
    setMode('editor')
  }

  const loadFromSource = async (srcId: string) => {
    if (!config.source || !srcId) return
    const { data } = await supabase.from(config.source.itemTable as any).select('*').eq(config.source.fk, srcId)
    const { data: sh } = await supabase.from(config.source.table as any).select('*').eq('id', srcId).single()
    setHeader((h: any) => ({ ...h, [config.source!.fk]: srcId,
      warehouse_id: h.warehouse_id || (sh as any)?.warehouse_id || '',
      ...(party && (sh as any)?.[partyField] ? { [partyField]: (sh as any)[partyField] } : {}) }))
    setItems((data ?? []).map((r: any) => ({
      product_id: r.product_id, qty: r.received_qty ?? r.qty, unit_price: r.unit_price ?? 0,
      location_id: r.location_id, to_location_id: r.location_id, stock_status: r.stock_status ?? 'good'
    })))
  }

  const buildItemRow = (docId: string, li: LineItem) => {
    const row: any = { client_id: clientId, [config.itemFK]: docId, product_id: li.product_id, [config.qtyField]: Number(li.qty || 0) }
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
    const hdr: any = {
      client_id: clientId, warehouse_id: header.warehouse_id,
      [config.dateField]: header[config.dateField] || new Date().toISOString().slice(0, 10),
      remarks: header.remarks || null, status: 'draft'
    }
    if (party) hdr[partyField] = header[partyField] || null
    if (config.hasExpected) hdr.expected_date = header.expected_date || null
    if (config.source) hdr[config.source.fk] = header[config.source.fk] || null
    config.extraFields?.forEach(f => { hdr[f.name] = header[f.name] || null })

    if (!docId) {
      hdr.doc_no = await nextDocNumber(clientId!, config.docType)
      const { data, error } = await supabase.from(config.table as any).insert(hdr).select('id').single()
      if (error) { notify('error', error.message); setSaving(false); return }
      docId = (data as any).id
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

  const post = async (doc: any) => {
    if (config.postRpc) {
      const { error } = await (supabase as any).schema('app').rpc(config.postRpc, { [config.postParam!]: doc.id })
      if (error) { notify('error', error.message); return }
    } else {
      const { error } = await supabase.from(config.table as any).update({ status: 'posted' }).eq('id', doc.id)
      if (error) { notify('error', error.message); return }
    }
    notify('success', `${doc.doc_no} posted`); load()
  }

  const printDoc = async (doc: any) => {
    const { data } = await supabase.from(config.itemTable as any).select('*').eq(config.itemFK, doc.id)
    const lines = (data ?? []).map((r: any) => ({ name: prodMap[r.product_id] ?? r.product_id, qty: Number(r[config.qtyField]), price: Number(r.unit_price ?? 0) }))
    const extraMeta = (config.extraFields ?? []).filter(f => doc[f.name] && showExtra(f, doc))
      .map(f => ({ label: f.label, value: f.kind === 'relation' ? (relMap(f.relation)[doc[f.name]] ?? doc[f.name]) : String(doc[f.name]) }))
    const baseMeta = [
      { label: 'Date', value: formatDate(doc[config.dateField]) },
      { label: 'Status', value: doc.status },
      ...(party ? [{ label: partyLabel, value: partyMap[doc[partyField]] ?? '—' }] : []),
      { label: 'Warehouse', value: warehouses.find(w => w.id === doc.warehouse_id)?.label ?? '—' }
    ]
    if (config.pdfKind === 'gatepass') {
      const ref = config.source ? sources.find(s => s.id === doc[config.source!.fk])?.doc_no : undefined
      const meta = [...baseMeta.filter(m => m.label !== 'Status'), ...extraMeta, ...(ref ? [{ label: 'Delivery Challan', value: ref }] : [])]
      downloadGatePassPDF({ client: clientName, docNo: doc.doc_no ?? '', meta, lines })
    } else {
      downloadDocPDF({ client: clientName, title: config.title, docNo: doc.doc_no ?? '', meta: [...baseMeta, ...extraMeta], lines, showPrice: config.showPrice })
    }
    notify('info', 'Generating PDF…')
  }

  const del = async (doc: any) => {
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
            {readOnly && <Badge tone={STATUS_TONE[header.status]}>{header.status}</Badge>}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {party && (
              <Field label={partyLabel}><Combobox value={header[partyField] ?? ''} disabled={readOnly} options={partyOpts.map(o => ({ id: o.id, label: o.label, sub: o.sub }))} placeholder={`Search ${partyLabel.toLowerCase()}…`} onChange={v => setHeader({ ...header, [partyField]: v })} /></Field>
            )}
            <Field label="Warehouse" required><Combobox value={header.warehouse_id ?? ''} disabled={readOnly} options={warehouses.map(w => ({ id: w.id, label: w.label, sub: w.sub }))} placeholder="Search warehouse…" onChange={v => setHeader({ ...header, warehouse_id: v })} /></Field>
            <Field label="Date"><Input type="date" disabled={readOnly} value={(header[config.dateField] ?? '').slice(0, 10)} onChange={e => setHeader({ ...header, [config.dateField]: e.target.value })} /></Field>
            {config.hasExpected && <Field label="Expected Date"><Input type="date" disabled={readOnly} value={(header.expected_date ?? '').slice(0, 10)} onChange={e => setHeader({ ...header, expected_date: e.target.value })} /></Field>}
            {config.source && !readOnly && !editId && (
              <Field label={config.source.label}><Combobox value={header[config.source.fk] ?? ''} options={sources.map(s => ({ id: s.id, label: s.doc_no }))} placeholder="Search…" onChange={v => loadFromSource(v)} /></Field>
            )}
            {config.extraFields?.filter(f => showExtra(f, header)).map(f => (
              <Field key={f.name} label={f.label}>
                {f.kind === 'text'
                  ? <Input disabled={readOnly} value={header[f.name] ?? ''} onChange={e => setHeader({ ...header, [f.name]: e.target.value })} />
                  : <Combobox value={header[f.name] ?? ''} disabled={readOnly}
                      options={f.kind === 'relation' ? relList(f.relation).map(o => ({ id: o.id, label: o.label, sub: o.sub })) : (f.options ?? []).map(o => ({ id: o, label: o }))}
                      onChange={v => setHeader({ ...header, [f.name]: v })} />}
              </Field>
            ))}
          </div>
          <Field label="Remarks"><Textarea disabled={readOnly} value={header.remarks ?? ''} onChange={e => setHeader({ ...header, remarks: e.target.value })} /></Field>
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

  const columns = [
    { key: 'doc_no', header: 'Document No', accessor: (r: any) => r.doc_no, sortable: true, className: 'font-medium' },
    { key: 'date', header: 'Date', render: (r: any) => formatDate(r[config.dateField]), sortable: true, accessor: (r: any) => r[config.dateField] },
    ...(party ? [{ key: 'party', header: partyLabel, render: (r: any) => partyMap[r[partyField]]?.split(' — ')[1] ?? '—' }] : []),
    { key: 'wh', header: 'Warehouse', render: (r: any) => warehouses.find(w => w.id === r.warehouse_id)?.label?.split(' — ')[0] ?? '—' },
    { key: 'status', header: 'Status', render: (r: any) => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> },
    { key: '__a', header: 'Action', className: 'w-px whitespace-nowrap', render: (r: any) => (
      <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
        <Act icon="visibility" label="View" onClick={() => openDoc(r, true)} />
        {canEdit && r.status === 'draft' && <Act icon="edit" label="Edit" onClick={() => openDoc(r, false)} />}
        <Act icon="print" label="Print" onClick={() => printDoc(r)} />
        {canPost && r.status === 'draft' && <Act icon="task_alt" label="Post" tone="hover:text-ok" onClick={() => post(r)} />}
        {canEdit && r.status === 'draft' && <Act icon="delete" label="Delete" tone="hover:text-bad" onClick={() => del(r)} />}
      </div>
    ) }
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-soft">{docs.length} {config.title.toLowerCase()}(s)</span>
        {canEdit && <Button icon="add" onClick={openNew}>New {config.singular}</Button>}
      </div>
      <Card className="overflow-hidden">
        {loading ? <Spinner /> : <DataTable columns={columns} rows={docs} rowKey={(r: any) => r.id} onRowClick={r => openDoc(r, true)} emptyTitle={`No ${config.title.toLowerCase()} yet`} />}
      </Card>
    </div>
  )
}

function Act({ icon, label, tone, onClick }: { icon: string; label: string; tone?: string; onClick: () => void }) {
  return <button title={label} aria-label={label} onClick={onClick}
    className={cn('rounded-md p-1.5 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-brand-700', tone)}>
    <Icon name={icon} className="text-[18px]" /></button>
}

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
import { SearchBar } from '@/components/shared/SearchBar'
import { formatDate, formatNumber } from '@/lib/utils'

const CONDITIONS = [{ id: 'good', label: 'Good' }, { id: 'damaged', label: 'Damaged' }, { id: 'quarantine', label: 'Quarantine' }]
const tone = (s: string) => s === 'posted' ? 'positive' : s === 'cancelled' ? 'negative' : 'neutral'
const today = () => new Date().toISOString().slice(0, 10)

interface CountLine { product_id?: string; location_id?: string; stock_status: string; system_qty: number; counted_qty?: number | string }

// Cycle Count (partial, periodic) and Physical Verification (full stock take)
// share one document + posting routine, distinguished by countType. Posting
// drives on-hand to the counted quantity via COUNT_ADJUST ledger movements.
export function CountTab({ countType, title, singular }: { countType: 'cycle' | 'physical'; title: string; singular: string }) {
  const { clientId, products, warehouses, locations } = useInboundData()
  const { can, isPlatformAdmin } = useAuth()
  const notify = useUI(s => s.notify)
  const canEdit = can('inventory.create') || can('inventory.adjust') || can('inventory.edit')
  const canPost = can('inventory.adjust') || can('inventory.post')

  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [deleting, setDeleting] = useState<any>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const whMap = useMemo(() => Object.fromEntries(warehouses.map(w => [w.id, w.label])), [warehouses])
  const filteredDocs = useMemo(() => {
    if (!q.trim()) return docs
    const t = q.toLowerCase()
    return docs.filter(r => [r.doc_no, whMap[r.warehouse_id], r.status].some(v => String(v ?? '').toLowerCase().includes(t)))
  }, [docs, whMap, q])

  const load = () => {
    if (!clientId) return
    setLoading(true)
    supabase.from('stock_counts' as any).select('*').eq('client_id', clientId).eq('count_type', countType)
      .order('created_at', { ascending: false })
      .then(({ data }: any) => { setDocs(data ?? []); setLoading(false) })
  }
  useEffect(load, [clientId, countType])

  const openEdit = async (doc: any, readOnly: boolean) => {
    const { data } = await supabase.from('stock_count_items' as any).select('*').eq('count_id', doc.id)
    setEditing({ ...doc, __items: data ?? [], __readOnly: readOnly || doc.status !== 'draft' })
    setModal(true)
  }

  const post = async (doc: any) => {
    if (doc.status !== 'draft') { notify('info', 'Already posted'); return }
    setBusy(doc.id)
    try {
      const { error } = await (supabase as any).rpc('post_stock_count', { p_count: doc.id })
      if (error) throw error
      notify('success', `${doc.doc_no ?? singular} posted — variances adjusted into stock`)
      load()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not post count')
    } finally { setBusy(null) }
  }

  const rowActions = (r: any): MenuItem[] => [
    { icon: 'visibility', label: 'View', onClick: () => openEdit(r, true) },
    ...(canEdit && r.status === 'draft' ? [{ icon: 'edit', label: 'Edit', onClick: () => openEdit(r, false) }] : []),
    ...(canPost && r.status === 'draft' ? [{ icon: 'task_alt', label: busy === r.id ? 'Posting…' : 'Post', tone: '!text-ok hover:!text-ok hover:!bg-ok/10', onClick: () => post(r) }] : []),
    ...(isPlatformAdmin ? [{ icon: 'delete', label: 'Delete', tone: '!text-bad hover:!text-bad hover:!bg-bad/10', onClick: () => setDeleting(r) }] : [])
  ]

  const columns = [
    { key: 'doc_no', header: 'Document No', accessor: (r: any) => r.doc_no, sortable: true, className: 'font-medium' },
    { key: 'date', header: 'Date', accessor: (r: any) => r.count_date, render: (r: any) => formatDate(r.count_date), sortable: true },
    { key: 'wh', header: 'Warehouse', accessor: (r: any) => whMap[r.warehouse_id] ?? '', render: (r: any) => whMap[r.warehouse_id]?.split(' — ')[0] ?? '—', sortable: true },
    { key: 'status', header: 'Status', accessor: (r: any) => r.status, render: (r: any) => <Badge tone={tone(r.status)}>{r.status}</Badge>, sortable: true },
    { key: '__actions', header: '', className: 'w-px whitespace-nowrap text-right',
      render: (r: any) => <div className="flex justify-end" onClick={e => e.stopPropagation()}><ActionMenu items={rowActions(r)} /></div> }
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-72"><SearchBar value={q} onChange={setQ} placeholder={`Search ${title.toLowerCase()}…`} /></div>
        <span className="text-sm text-ink-soft">{filteredDocs.length} {title.toLowerCase()}(s)</span>
        {canEdit && <Button className="ml-auto" icon="add" onClick={() => { setEditing(null); setModal(true) }}>New {singular}</Button>}
      </div>
      <Card className="overflow-hidden">
        {loading ? <Spinner /> : <DataTable columns={columns} rows={filteredDocs} rowKey={(r: any) => r.id}
          onRowClick={(r: any) => openEdit(r, true)} emptyTitle={`No ${title.toLowerCase()} yet`} />}
      </Card>

      {modal && (
        <CountForm countType={countType} title={title} singular={singular} record={editing}
          clientId={clientId!} products={products} warehouses={warehouses} locations={locations}
          onClose={() => setModal(false)} onDone={() => { setModal(false); load() }} />
      )}

      <ConfirmDelete open={!!deleting} onClose={() => setDeleting(null)}
        name={deleting ? `${singular} · ${deleting.doc_no}` : undefined}
        onConfirm={async () => {
          const res = await supabase.from('stock_counts' as any).delete().eq('id', deleting.id)
          if (!res.error) { setDeleting(null); load() }
          return res
        }} />
    </div>
  )
}

function CountForm({ countType, title, singular, record, clientId, products, warehouses, locations, onClose, onDone }: any) {
  const notify = useUI(s => s.notify)
  const readOnly = !!record?.__readOnly
  const [h, setH] = useState<any>(record ?? { count_date: today() })
  const [lines, setLines] = useState<CountLine[]>(
    (record?.__items ?? []).map((r: any) => ({
      product_id: r.product_id, location_id: r.location_id, stock_status: r.stock_status,
      system_qty: Number(r.system_qty), counted_qty: r.counted_qty
    })))
  const [saving, setSaving] = useState(false)
  const [loadingStock, setLoadingStock] = useState(false)
  const set = (patch: any) => setH((x: any) => ({ ...x, ...patch }))
  const prodMap = useMemo(() => Object.fromEntries(products.map((p: any) => [p.id, p])), [products])
  const locForWh = locations.filter((l: any) => !h.warehouse_id || l.extra === h.warehouse_id)

  const updateLine = (i: number, patch: Partial<CountLine>) => setLines(ls => ls.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  const addLine = () => setLines(ls => [...ls, { stock_status: 'good', system_qty: 0, counted_qty: '' }])
  const removeLine = (i: number) => setLines(ls => ls.filter((_, idx) => idx !== i))

  // Snapshot the current on-hand stock for the chosen warehouse as count lines.
  const loadStock = async () => {
    if (!h.warehouse_id) { notify('error', 'Choose a warehouse first'); return }
    setLoadingStock(true)
    const { data } = await supabase.from('inventory_stock')
      .select('product_id, location_id, stock_status, quantity')
      .eq('client_id', clientId).eq('warehouse_id', h.warehouse_id)
    setLines((data ?? []).map((r: any) => ({
      product_id: r.product_id, location_id: r.location_id, stock_status: r.stock_status,
      system_qty: Number(r.quantity), counted_qty: Number(r.quantity)
    })))
    setLoadingStock(false)
  }

  const save = async () => {
    if (!h.warehouse_id) { notify('error', 'Warehouse is required'); return }
    const valid = lines.filter(l => l.product_id)
    if (!valid.length) { notify('error', 'Add at least one line (or load stock)'); return }
    // A blank count is NOT zero: posting would write the whole system qty off
    // as variance. Force an explicit counted figure on every line.
    if (valid.some(l => String(l.counted_qty ?? '').trim() === '' || !Number.isFinite(Number(l.counted_qty)))) {
      notify('error', 'Every line needs a Counted Qty — enter the actual count (0 only if truly none found)'); return
    }
    setSaving(true)
    try {
      const hdr: any = {
        client_id: clientId, warehouse_id: h.warehouse_id, count_type: countType,
        count_date: h.count_date || today(), remarks: h.remarks || null, status: 'draft'
      }
      let docId = record?.id
      if (record) {
        const { error } = await (supabase as any).from('stock_counts').update(hdr).eq('id', record.id)
        if (error) throw error
        await (supabase as any).from('stock_count_items').delete().eq('count_id', record.id)
      } else {
        hdr.doc_no = await nextDocNumber(clientId, 'CNT')
        const { data, error } = await supabase.from('stock_counts' as any).insert(hdr).select('id').single()
        if (error) throw error
        docId = (data as any).id
      }
      const rows = valid.map(l => ({
        client_id: clientId, count_id: docId, product_id: l.product_id, location_id: l.location_id || null,
        stock_status: l.stock_status, system_qty: Number(l.system_qty) || 0, counted_qty: Number(l.counted_qty) || 0
      }))
      const { error: ie } = await supabase.from('stock_count_items' as any).insert(rows)
      if (ie) throw ie
      notify('success', `${singular} saved as draft`)
      onDone()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not save count')
    } finally { setSaving(false) }
  }

  const variance = (l: CountLine) => (Number(l.counted_qty) || 0) - (Number(l.system_qty) || 0)

  return (
    <Modal open onClose={onClose} title={`${record ? (readOnly ? 'View' : 'Edit') : 'New'} ${title}${record?.doc_no ? ' · ' + record.doc_no : ''}`} size="xl">
      <div className="space-y-4">
        {readOnly && <div className="flex items-center gap-2"><Badge tone={tone(record.status)}>{record.status}</Badge>
          {record.status === 'posted' && <span className="text-xs text-ink-soft">Posted counts are read-only.</span>}</div>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Warehouse" required>
            <Combobox value={h.warehouse_id ?? ''} disabled={readOnly}
              options={warehouses.map((w: any) => ({ id: w.id, label: w.label, sub: w.sub }))}
              placeholder="Search warehouse…" onChange={(v: string) => set({ warehouse_id: v })} />
          </Field>
          <Field label="Count Date"><Input type="date" disabled={readOnly} value={(h.count_date ?? '').slice(0, 10)} onChange={e => set({ count_date: e.target.value })} /></Field>
          {!readOnly && <div className="flex items-end"><Button variant="secondary" icon="download" loading={loadingStock} onClick={loadStock}>Load current stock</Button></div>}
        </div>

        <div>
          <p className="fiori-label">Count Lines</p>
          <div className="overflow-x-auto rounded-lg border border-surface-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-line bg-surface-sunken text-left text-xs font-semibold text-ink-soft">
                  <th className="px-2 py-2 min-w-[220px]">Product</th>
                  <th className="px-2 py-2 min-w-[140px]">Location</th>
                  <th className="px-2 py-2 min-w-[120px]">Condition</th>
                  <th className="px-2 py-2 w-20 text-right">System</th>
                  <th className="px-2 py-2 w-24 text-right">Counted</th>
                  <th className="px-2 py-2 w-20 text-right">Variance</th>
                  {!readOnly && <th className="px-2 py-2 w-8" />}
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 && (
                  <tr><td colSpan={readOnly ? 6 : 7} className="px-3 py-4 text-center text-xs text-ink-faint">No lines yet — add a line or load current stock.</td></tr>
                )}
                {lines.map((l, i) => {
                  const v = variance(l)
                  return (
                    <tr key={i} className="border-b border-surface-line last:border-0">
                      <td className="px-2 py-1.5">
                        <Combobox value={l.product_id ?? ''} disabled={readOnly}
                          options={products.map((p: any) => ({ id: p.id, label: p.label, sub: p.sub }))}
                          placeholder="Search product…" onChange={(val: string) => updateLine(i, { product_id: val })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <Combobox value={l.location_id ?? ''} disabled={readOnly}
                          options={locForWh.map((loc: any) => ({ id: loc.id, label: loc.label }))}
                          placeholder="—" onChange={(val: string) => updateLine(i, { location_id: val })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <Select value={l.stock_status} disabled={readOnly} onChange={e => updateLine(i, { stock_status: e.target.value })}>
                          {CONDITIONS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </Select>
                      </td>
                      <td className="px-2 py-1.5 text-right text-ink-soft">{formatNumber(l.system_qty)}</td>
                      <td className="px-2 py-1.5"><Input type="number" step="any" min={0} className="text-right" disabled={readOnly} value={l.counted_qty ?? ''} onChange={e => updateLine(i, { counted_qty: e.target.value })} /></td>
                      <td className={`px-2 py-1.5 text-right font-medium ${v > 0 ? 'text-green-600' : v < 0 ? 'text-orange-600' : 'text-ink-faint'}`}>{v > 0 ? '+' : ''}{formatNumber(v)}</td>
                      {!readOnly && <td className="px-2 py-1.5 text-center"><button onClick={() => removeLine(i)} className="text-ink-faint hover:text-bad"><Icon name="close" className="text-[18px]" /></button></td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {!readOnly && <button onClick={addLine} className="mt-2 flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"><Icon name="add" className="text-[18px]" /> Add line</button>}
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

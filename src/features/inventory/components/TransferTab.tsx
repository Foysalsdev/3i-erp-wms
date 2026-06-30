import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Combobox } from '@/components/ui/Combobox'
import { StockMovementHistory } from './StockMovementHistory'

const CONDITIONS = [{ id: 'good', label: 'Good' }, { id: 'damaged', label: 'Damaged' }, { id: 'quarantine', label: 'Quarantine' }]

// Inter-warehouse / inter-location stock transfer. Posts a paired TRANSFER
// movement (out of source, into destination) so the ledger and on-hand stay
// consistent across both locations.
export function TransferTab() {
  const { can } = useAuth()
  const [open, setOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-soft">Move stock between warehouses or locations — recorded as paired TRANSFER movements.</span>
        {can('inventory.adjust') && <Button className="ml-auto" icon="swap_horiz" onClick={() => setOpen(true)}>New Transfer</Button>}
      </div>
      <StockMovementHistory key={reloadKey} movementTypes={['TRANSFER']} emptyTitle="No transfers recorded yet" />
      {open && <TransferModal onClose={() => setOpen(false)} onDone={() => { setOpen(false); setReloadKey(k => k + 1) }} />}
    </div>
  )
}

function TransferModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const clientId = useAuth(s => s.currentClientId)
  const notify = useUI(s => s.notify)
  const [products, setProducts] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState<any>({ stock_status: 'good', qty: '' })
  const set = (patch: any) => setF((x: any) => ({ ...x, ...patch }))

  useEffect(() => {
    if (!clientId) return
    supabase.from('products').select('id,name,material_code').eq('client_id', clientId).then(({ data }) => setProducts(data ?? []))
    supabase.from('warehouses').select('id,name,code').eq('client_id', clientId).then(({ data }) => setWarehouses(data ?? []))
    supabase.from('locations').select('id,location_code,warehouse_id').eq('client_id', clientId).then(({ data }) => setLocations(data ?? []))
  }, [clientId])

  const fromLocs = locations.filter(l => l.warehouse_id === f.from_warehouse_id)
  const toLocs = locations.filter(l => l.warehouse_id === f.to_warehouse_id)

  const save = async () => {
    const qty = Number(f.qty)
    if (!f.product_id || !f.from_warehouse_id || !f.to_warehouse_id || !(qty > 0)) {
      notify('error', 'Product, source, destination and a positive quantity are required'); return
    }
    if (f.from_warehouse_id === f.to_warehouse_id && (f.from_location_id || null) === (f.to_location_id || null)) {
      notify('error', 'Source and destination must differ'); return
    }
    setSaving(true)
    try {
      const prod = products.find(p => p.id === f.product_id)
      const ref = `Transfer ${prod?.material_code ?? ''}`.trim()
      // 1) remove from source
      const out = await (supabase as any).rpc('post_stock_movement', {
        p_client: clientId, p_product: f.product_id, p_warehouse: f.from_warehouse_id,
        p_location: f.from_location_id || null, p_stock_status: f.stock_status,
        p_qty_in: 0, p_qty_out: qty, p_movement_type: 'TRANSFER', p_reference_type: 'TRANSFER',
        p_reference_no: ref, p_remarks: f.remarks || 'Stock transfer (out)'
      })
      if (out.error) throw out.error
      // 2) add to destination
      const inn = await (supabase as any).rpc('post_stock_movement', {
        p_client: clientId, p_product: f.product_id, p_warehouse: f.to_warehouse_id,
        p_location: f.to_location_id || null, p_stock_status: f.stock_status,
        p_qty_in: qty, p_qty_out: 0, p_movement_type: 'TRANSFER', p_reference_type: 'TRANSFER',
        p_reference_no: ref, p_remarks: f.remarks || 'Stock transfer (in)'
      })
      if (inn.error) throw inn.error
      notify('success', 'Stock transfer posted')
      onDone()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not post transfer')
    } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title="New Stock Transfer" size="lg">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Product" required className="sm:col-span-2">
          <Combobox value={f.product_id} placeholder="Search product…"
            options={products.map(p => ({ id: p.id, label: p.material_code, sub: p.name }))}
            onChange={v => set({ product_id: v })} />
        </Field>
        <Field label="From Warehouse" required>
          <Combobox value={f.from_warehouse_id} placeholder="Source warehouse…"
            options={warehouses.map(w => ({ id: w.id, label: w.code, sub: w.name }))}
            onChange={v => set({ from_warehouse_id: v, from_location_id: '' })} />
        </Field>
        <Field label="From Location">
          <Combobox value={f.from_location_id} placeholder="Source location…"
            options={fromLocs.map(l => ({ id: l.id, label: l.location_code }))}
            onChange={v => set({ from_location_id: v })} />
        </Field>
        <Field label="To Warehouse" required>
          <Combobox value={f.to_warehouse_id} placeholder="Destination warehouse…"
            options={warehouses.map(w => ({ id: w.id, label: w.code, sub: w.name }))}
            onChange={v => set({ to_warehouse_id: v, to_location_id: '' })} />
        </Field>
        <Field label="To Location">
          <Combobox value={f.to_location_id} placeholder="Destination location…"
            options={toLocs.map(l => ({ id: l.id, label: l.location_code }))}
            onChange={v => set({ to_location_id: v })} />
        </Field>
        <Field label="Condition"><Combobox value={f.stock_status} allowClear={false} options={CONDITIONS} onChange={v => set({ stock_status: v })} /></Field>
        <Field label="Quantity" required><Input type="number" step="any" min={0} value={f.qty} onChange={e => set({ qty: e.target.value })} /></Field>
        <Field label="Remarks" className="sm:col-span-2"><Textarea value={f.remarks ?? ''} onChange={e => set({ remarks: e.target.value })} /></Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button icon="swap_horiz" loading={saving} onClick={save}>Post Transfer</Button>
      </div>
    </Modal>
  )
}

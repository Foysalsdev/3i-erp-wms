import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Modal } from '@/components/ui/Modal'
import { Field, Select, Input, Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'

// Posts a stock movement via the atomic server-side function app.post_stock_movement.
export function StockAdjustModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const clientId = useAuth(s => s.currentClientId)
  const notify = useUI(s => s.notify)
  const [products, setProducts] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState<any>({ stock_status: 'good', direction: 'in', movement_type: 'ADJUST', qty: '' })

  useEffect(() => {
    if (!open || !clientId) return
    supabase.from('products').select('id,name,material_code').eq('client_id', clientId).then(({ data }) => setProducts(data ?? []))
    supabase.from('warehouses').select('id,name,code').eq('client_id', clientId).then(({ data }) => setWarehouses(data ?? []))
  }, [open, clientId])
  useEffect(() => {
    if (!f.warehouse_id) { setLocations([]); return }
    supabase.from('locations').select('id,location_code').eq('warehouse_id', f.warehouse_id).then(({ data }) => setLocations(data ?? []))
  }, [f.warehouse_id])

  const save = async () => {
    if (!f.product_id || !f.warehouse_id || !f.qty) { notify('error', 'Product, warehouse and quantity required'); return }
    setSaving(true)
    const qty = Number(f.qty)
    const { error } = await (supabase as any).schema('app').rpc('post_stock_movement', {
      p_client: clientId, p_product: f.product_id, p_warehouse: f.warehouse_id,
      p_location: f.location_id || null, p_stock_status: f.stock_status,
      p_qty_in: f.direction === 'in' ? qty : 0, p_qty_out: f.direction === 'out' ? qty : 0,
      p_movement_type: f.movement_type, p_reference_type: 'MANUAL', p_remarks: f.remarks || null
    })
    setSaving(false)
    if (error) { notify('error', error.message); return }
    notify('success', 'Stock movement posted'); setF({ stock_status: 'good', direction: 'in', movement_type: 'ADJUST', qty: '' }); onDone()
  }

  return (
    <Modal open={open} onClose={onClose} title="Post Stock Movement">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Product" required className="sm:col-span-2">
          <Select value={f.product_id ?? ''} onChange={e => setF((x: any) => ({ ...x, product_id: e.target.value }))}>
            <option value="">Select product…</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.material_code} — {p.name}</option>)}
          </Select>
        </Field>
        <Field label="Warehouse" required>
          <Select value={f.warehouse_id ?? ''} onChange={e => setF((x: any) => ({ ...x, warehouse_id: e.target.value }))}>
            <option value="">Select…</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
          </Select>
        </Field>
        <Field label="Location">
          <Select value={f.location_id ?? ''} onChange={e => setF((x: any) => ({ ...x, location_id: e.target.value }))}>
            <option value="">—</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.location_code}</option>)}
          </Select>
        </Field>
        <Field label="Direction" required>
          <Select value={f.direction} onChange={e => setF((x: any) => ({ ...x, direction: e.target.value }))}>
            <option value="in">Stock In (+)</option><option value="out">Stock Out (−)</option>
          </Select>
        </Field>
        <Field label="Quantity" required><Input type="number" step="any" value={f.qty} onChange={e => setF((x: any) => ({ ...x, qty: e.target.value }))} /></Field>
        <Field label="Condition"><Select value={f.stock_status} onChange={e => setF((x: any) => ({ ...x, stock_status: e.target.value }))}>
          <option value="good">Good</option><option value="damaged">Damaged</option><option value="quarantine">Quarantine</option></Select></Field>
        <Field label="Movement Type"><Select value={f.movement_type} onChange={e => setF((x: any) => ({ ...x, movement_type: e.target.value }))}>
          {['ADJUST', 'GRN', 'PUTAWAY', 'PICK', 'DELIVERY', 'RETURN', 'TRANSFER'].map(m => <option key={m}>{m}</option>)}</Select></Field>
        <Field label="Remarks" className="sm:col-span-2"><Textarea value={f.remarks ?? ''} onChange={e => setF((x: any) => ({ ...x, remarks: e.target.value }))} /></Field>
      </div>
      <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button icon="check" loading={saving} onClick={save}>Post Movement</Button></div>
    </Modal>
  )
}
